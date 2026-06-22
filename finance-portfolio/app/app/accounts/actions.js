"use server";

import pool from '@/lib/db';
import { analyzeStockImage } from '@/lib/ai-service';
import { revalidatePath } from 'next/cache';

// 전체 계좌 및 관련 주식 목록 조회
export async function getAccounts() {
  try {
    const { rows: accounts } = await pool.query('SELECT * FROM account ORDER BY id DESC');
    const { rows: stockItems } = await pool.query('SELECT * FROM stock_item');

    // 계좌에 주식 항목들을 매핑
    return accounts.map(acc => {
      const items = stockItems.filter(item => item.account_id === acc.id);
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: parseFloat(acc.balance || 0),
        institution: acc.institution || '',
        accountType: acc.account_type || '',
        baseDate: acc.base_date || '',
        stockItems: items.map(item => ({
          id: item.id,
          name: item.name,
          amount: parseFloat(item.amount || 0),
          category: item.category || '성장자산',
          lastMonthChange: parseFloat(item.last_month_change || 0),
          changeVal: parseFloat(item.change_val || 0),
          note: item.note || ''
        })),
        createdAt: acc.created_at,
        updatedAt: acc.updated_at
      };
    });
  } catch (err) {
    console.error("[Actions] Failed to get accounts:", err);
    throw new Error("DB_READ_ERROR");
  }
}

// 계좌 생성
export async function createAccount({ name, type, balance, institution, accountType, category, note, baseDate, stockName }) {
  if (!name || !type) {
    throw new Error("INVALID_INPUT");
  }
  let conn;
  try {
    const initialBalance = type === 'SAVINGS' ? parseFloat(balance || 0) : 0;
    
    conn = await pool.connect();
    await conn.query('BEGIN');

    const result = await conn.query(
      'INSERT INTO account (name, type, balance, institution, account_type, base_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, type, initialBalance, institution || '', accountType || '', baseDate || '']
    );
    const newAccountId = result.rows[0].id;

    // SAVINGS 타입이면 하나의 stock_item을 함께 생성하여 테이블과 연동
    if (type === 'SAVINGS') {
      const finalStockName = stockName || name;
      await conn.query(
        'INSERT INTO stock_item (name, amount, account_id, category, note) VALUES ($1, $2, $3, $4, $5)',
        [finalStockName, initialBalance, newAccountId, category || '현금자산', note || '']
      );
    }

    await conn.query('COMMIT');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Actions] Failed to create account:", err);
    throw new Error("DB_WRITE_ERROR");
  } finally {
    if (conn) conn.release();
  }
}

// 계좌 삭제
export async function deleteAccount(id) {
  try {
    await pool.query('DELETE FROM account WHERE id = $1', [id]);
    revalidatePath('/accounts');
  } catch (err) {
    console.error("[Actions] Failed to delete account:", err);
    throw new Error("DB_DELETE_ERROR");
  }
}

// 적금계좌 정보 전체 갱신 (계좌명, 잔액, 구분, 비고, 기준일, 기관명, 계좌종류, 종목명)
export async function updateSavingsAccount(id, { name, balance, category, note, baseDate, institution, accountType, stockName }) {
  let conn;
  try {
    // 계좌 유형 검사
    const { rows } = await pool.query('SELECT type FROM account WHERE id = $1', [id]);
    if (rows.length === 0) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }
    if (rows[0].type !== 'SAVINGS') {
      throw new Error("INVALID_ACCOUNT_TYPE");
    }

    const updatedBalance = parseFloat(balance || 0);

    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1) account name, balance, base_date, institution, account_type 갱신
    await conn.query(`
      UPDATE account 
      SET name = $1, balance = $2, base_date = $3, institution = $4, account_type = $5 
      WHERE id = $6
    `, [name, updatedBalance, baseDate || '', institution || '', accountType || '', id]);

    // 2) 매핑된 단일 stock_item 갱신 (종목명, 금액, 구분, 비고)
    await conn.query(`
      UPDATE stock_item 
      SET name = $1, amount = $2, category = $3, note = $4
      WHERE account_id = $5
    `, [stockName || '', updatedBalance, category || '현금자산', note || '', id]);

    await conn.query('COMMIT');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Actions] Failed to update savings account:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 이미지 분석 및 주식 항목 현행화 (트랜잭션 적용)
export async function uploadAndAnalyzeImage(accountId, formData) {
  const file = formData.get('file');
  if (!file || file.size === 0) {
    throw new Error("EMPTY_FILE");
  }

  let conn;
  try {
    // 계좌 유형 검사
    const { rows } = await pool.query('SELECT type FROM account WHERE id = $1', [accountId]);
    if (rows.length === 0) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }
    if (rows[0].type !== 'STOCK') {
      throw new Error("INVALID_ACCOUNT_TYPE");
    }

    // 파일 데이터를 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // AI 분석 서비스 호출
    const extractedList = await analyzeStockImage(buffer, file.name);

    // 트랜잭션 시작
    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1) 기존 주식 항목들 삭제
    await conn.query('DELETE FROM stock_item WHERE account_id = $1', [accountId]);

    // 2) 신규 주식 항목들 삽입
    let totalBalance = 0;
    for (const item of extractedList) {
      await conn.query(
        'INSERT INTO stock_item (name, amount, account_id) VALUES ($1, $2, $3)',
        [item.name, item.amount, accountId]
      );
      totalBalance += item.amount;
    }

    // 3) 계좌 잔액 업데이트
    await conn.query('UPDATE account SET balance = $1 WHERE id = $2', [totalBalance, accountId]);

    await conn.query('COMMIT');
    revalidatePath('/accounts');
  } catch (err) {
    if (conn) {
      await conn.query('ROLLBACK');
    }
    console.error("[Actions] Failed image upload & db synchronization:", err);
    throw err;
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

// 주식 계좌의 공통 메타 정보(이름, 기관명, 계좌종류, 기준일) 수정
export async function updateAccountMeta(id, { name, institution, accountType, baseDate }) {
  try {
    await pool.query(
      'UPDATE account SET name = $1, institution = $2, account_type = $3, base_date = $4 WHERE id = $5',
      [name, institution || '', accountType || '', baseDate || '', id]
    );
    revalidatePath('/accounts');
    revalidatePath('/transactions');
  } catch (err) {
    console.error("[Actions] Failed to update account meta:", err);
    throw new Error("DB_WRITE_ERROR");
  }
}

// 특정 주식 계좌에 수동으로 신규 주식 종목 추가 및 계좌 잔액 동기화
export async function addStockItem(accountId, { name, amount, category, note }) {
  let conn;
  try {
    const parsedAmount = parseFloat(amount || 0);
    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1) stock_item 추가
    await conn.query(
      'INSERT INTO stock_item (name, amount, account_id, category, note) VALUES ($1, $2, $3, $4, $5)',
      [name, parsedAmount, accountId, category || '성장자산', note || '']
    );

    // 2) 계좌 잔액 재계산
    const { rows: sumRows } = await conn.query('SELECT SUM(amount) as total FROM stock_item WHERE account_id = $1', [accountId]);
    const totalBalance = parseFloat(sumRows[0].total || 0);
    await conn.query('UPDATE account SET balance = $1 WHERE id = $2', [totalBalance, accountId]);

    await conn.query('COMMIT');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Actions] Failed to add stock item:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 기존 주식 종목의 상세 정보 수정 및 계좌 잔액 동기화
export async function updateStockItem(itemId, { name, amount, category, note }) {
  let conn;
  try {
    const parsedAmount = parseFloat(amount || 0);
    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1) account_id 조회
    const { rows: itemRows } = await conn.query('SELECT account_id FROM stock_item WHERE id = $1', [itemId]);
    if (itemRows.length === 0) {
      throw new Error("STOCK_ITEM_NOT_FOUND");
    }
    const accountId = itemRows[0].account_id;

    // 2) stock_item 수정
    await conn.query(
      'UPDATE stock_item SET name = $1, amount = $2, category = $3, note = $4 WHERE id = $5',
      [name, parsedAmount, category || '성장자산', note || '', itemId]
    );

    // 3) 계좌 잔액 재계산
    const { rows: sumRows } = await conn.query('SELECT SUM(amount) as total FROM stock_item WHERE account_id = $1', [accountId]);
    const totalBalance = parseFloat(sumRows[0].total || 0);
    await conn.query('UPDATE account SET balance = $1 WHERE id = $2', [totalBalance, accountId]);

    await conn.query('COMMIT');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Actions] Failed to update stock item:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 특정 주식 종목 삭제 및 계좌 잔액 재계산
export async function deleteStockItem(itemId) {
  let conn;
  try {
    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1) account_id 조회
    const { rows: itemRows } = await conn.query('SELECT account_id FROM stock_item WHERE id = $1', [itemId]);
    if (itemRows.length === 0) {
      throw new Error("STOCK_ITEM_NOT_FOUND");
    }
    const accountId = itemRows[0].account_id;

    // 2) stock_item 삭제
    await conn.query('DELETE FROM stock_item WHERE id = $1', [itemId]);

    // 3) 계좌 잔액 재계산
    const { rows: sumRows } = await conn.query('SELECT SUM(amount) as total FROM stock_item WHERE account_id = $1', [accountId]);
    const totalBalance = parseFloat(sumRows[0].total || 0);
    await conn.query('UPDATE account SET balance = $1 WHERE id = $2', [totalBalance, accountId]);

    await conn.query('COMMIT');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Actions] Failed to delete stock item:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 동일 종목명(상품명)을 가졌으며 현재 계좌를 제외한 항목 중 가장 최신의 amount 조회
export async function getLastAmountByStockName(stockName, currentAccountId) {
  try {
    if (!stockName) return 0;
    const query = `
      SELECT amount 
      FROM stock_item 
      WHERE name = $1 AND account_id != $2
      ORDER BY id DESC 
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [stockName, currentAccountId]);
    if (rows.length > 0) {
      return parseFloat(rows[0].amount || 0);
    }
    return 0;
  } catch (err) {
    console.error("[Actions] Failed to get last amount by stock name:", err);
    throw err;
  }
}

// 동일 날짜(기준월) 기준 데이터가 있는 가장 가까운 달의 계좌 목록 복제 가져오기
export async function importAccountsFromClosestMonth(targetMonth, overwrite = false) {
  if (!targetMonth) {
    throw new Error("TARGET_MONTH_REQUIRED");
  }

  let conn;
  try {
    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1. 데이터가 있는 모든 고유한 연월 조회 (단, targetMonth는 제외)
    const { rows: monthRows } = await conn.query(
      "SELECT DISTINCT LEFT(base_date, 7) as \"baseMonth\" FROM account WHERE base_date IS NOT NULL AND base_date != '' AND LEFT(base_date, 7) != $1",
      [targetMonth]
    );

    if (monthRows.length === 0) {
      throw new Error("NO_SOURCE_DATA");
    }

    // 2. 오늘 날짜 기준 가장 가까운 달 찾기
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1; // 1-12
    
    let closestMonth = null;
    let minDiff = Infinity;

    for (const row of monthRows) {
      const mStr = row.baseMonth;
      const [y, m] = mStr.split('-').map(Number);
      const diff = Math.abs((y - todayYear) * 12 + (m - todayMonth));
      if (diff < minDiff) {
        minDiff = diff;
        closestMonth = mStr;
      }
    }

    if (!closestMonth) {
      throw new Error("NO_CLOSEST_MONTH_FOUND");
    }

    // 3. 덮어쓰기 옵션이 활성화된 경우 기존 targetMonth의 계좌 및 주식 항목들 삭제
    if (overwrite) {
      const { rows: existingAccs } = await conn.query(
        "SELECT id FROM account WHERE LEFT(base_date, 7) = $1",
        [targetMonth]
      );
      if (existingAccs.length > 0) {
        const ids = existingAccs.map(r => r.id);
        // FK ON DELETE CASCADE가 걸려있어 stock_item도 자동 삭제됨
        await conn.query("DELETE FROM account WHERE id = ANY($1::bigint[])", [ids]);
      }
    }

    // 4. closestMonth에 해당하는 계좌 정보 가져오기
    const { rows: sourceAccounts } = await conn.query(
      "SELECT * FROM account WHERE LEFT(base_date, 7) = $1",
      [closestMonth]
    );

    const targetBaseDate = targetMonth + "-01";

    // 5. 계좌 복사 및 해당 주식 항목 복사
    for (const srcAcc of sourceAccounts) {
      // 5-1) 계좌 복제
      const accResult = await conn.query(
        "INSERT INTO account (name, type, balance, institution, account_type, base_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [srcAcc.name, srcAcc.type, srcAcc.balance, srcAcc.institution || '', srcAcc.account_type || '', targetBaseDate]
      );
      const newAccountId = accResult.rows[0].id;

      // 5-2) 주식 복제
      const { rows: srcItems } = await conn.query(
        "SELECT * FROM stock_item WHERE account_id = $1",
        [srcAcc.id]
      );

      for (const srcItem of srcItems) {
        await conn.query(
          "INSERT INTO stock_item (name, amount, account_id, category, last_month_change, change_val, note) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [
            srcItem.name,
            srcItem.amount,
            newAccountId,
            srcItem.category || '성장자산',
            0, // 변동액 리셋
            0,
            srcItem.note || ''
          ]
        );
      }
    }

    await conn.query('COMMIT');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
    return { success: true, importedFrom: closestMonth };
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Actions] Failed to import accounts:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 특정 연월(YYYY-MM)에 등록된 모든 계좌(및 외래키 종속된 주식 데이터)를 일괄 삭제
export async function deleteAccountsByMonth(targetMonth) {
  if (!targetMonth) {
    throw new Error("TARGET_MONTH_REQUIRED");
  }

  try {
    // 1) 해당 연월에 속하는 계좌 ID 조회
    const { rows } = await pool.query(
      "SELECT id FROM account WHERE LEFT(base_date, 7) = $1",
      [targetMonth]
    );

    if (rows.length === 0) {
      return { success: true, count: 0 };
    }

    const ids = rows.map(r => r.id);

    // 2) 일괄 삭제 실행 (account가 삭제되면 Cascade 조건으로 stock_item도 제거됨)
    await pool.query("DELETE FROM account WHERE id = ANY($1::bigint[])", [ids]);

    revalidatePath('/accounts');
    revalidatePath('/transactions');
    return { success: true, count: ids.length };
  } catch (err) {
    console.error("[Actions] Failed to delete accounts by month:", err);
    throw err;
  }
}

// 주식 계좌의 종목 리스트 일괄 현행화 저장 (기존 항목 삭제 후 신규 등록, 계좌 잔액 동기화 및 기준일 연동)
export async function saveStockItemsList(accountId, items, baseMonth) {
  if (!accountId || !items) {
    throw new Error("INVALID_INPUT");
  }

  let conn;
  try {
    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1) 기존 주식 항목들 삭제
    await conn.query('DELETE FROM stock_item WHERE account_id = $1', [accountId]);

    // 2) 신규 주식 항목들 삽입
    let totalBalance = 0;
    for (const item of items) {
      const parsedAmount = parseFloat(item.amount || 0);
      await conn.query(
        'INSERT INTO stock_item (name, amount, account_id, category, note) VALUES ($1, $2, $3, $4, $5)',
        [item.name, parsedAmount, accountId, item.category || '성장자산', item.note || '']
      );
      totalBalance += parsedAmount;
    }

    // 3) 계좌 잔액 및 기준일 업데이트
    const baseDate = baseMonth ? baseMonth + "-01" : '';
    await conn.query(
      'UPDATE account SET balance = $1, base_date = $2 WHERE id = $3',
      [totalBalance, baseDate, accountId]
    );

    await conn.query('COMMIT');
    revalidatePath('/accounts');
    revalidatePath('/transactions');
    return { success: true };
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Actions] Failed to save stock items list:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}



