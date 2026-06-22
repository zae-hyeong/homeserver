"use server";

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';

// 주식 현황 데이터를 위한 계좌 + 주식 항목 조인 조회
export async function getStockItemsWithAccount() {
  try {
    const query = `
      SELECT 
        s.id as "itemId",
        s.name as "stockName",
        s.amount as "amount",
        s.category as "category",
        s.last_month_change as "lastMonthChange",
        s.change_val as "changeVal",
        s.note as "note",
        a.id as "accountId",
        a.name as "accountName",
        a.type as "accountTypeClass",
        a.institution as "institution",
        a.account_type as "accountType",
        a.base_date as "baseDate"
      FROM stock_item s
      JOIN account a ON s.account_id = a.id
      ORDER BY a.id DESC, s.id ASC
    `;
    const { rows } = await pool.query(query);

    return rows.map(row => ({
      itemId: row.itemId,
      stockName: row.stockName,
      amount: parseFloat(row.amount || 0),
      category: row.category,
      lastMonthChange: parseFloat(row.lastMonthChange || 0),
      changeVal: parseFloat(row.changeVal || 0),
      note: row.note,
      accountId: row.accountId,
      accountName: row.accountName,
      accountTypeClass: row.accountTypeClass,
      institution: row.institution,
      accountType: row.accountType,
      baseDate: row.baseDate
    }));
  } catch (err) {
    console.error("[Transactions Actions] Failed to get stock items:", err);
    throw new Error("DB_READ_ERROR");
  }
}

// 개별 주식 항목 필드 업데이트 및 부모 계좌 잔액 동기화
export async function updateStockItemField(itemId, fieldName, value) {
  // 허용된 필드 목록 검증
  const allowedFields = ['stockName', 'amount', 'category', 'lastMonthChange', 'changeVal', 'note'];
  if (!allowedFields.includes(fieldName)) {
    throw new Error("INVALID_FIELD");
  }

  // DB 필드명 매핑
  const dbFieldMap = {
    stockName: 'name',
    amount: 'amount',
    category: 'category',
    lastMonthChange: 'last_month_change',
    changeVal: 'change_val',
    note: 'note'
  };

  const dbFieldName = dbFieldMap[fieldName];
  let conn;

  try {
    conn = await pool.connect();
    await conn.query('BEGIN');

    // 1) 해당 stock_item의 account_id 조회
    const { rows: itemRows } = await conn.query('SELECT account_id FROM stock_item WHERE id = $1', [itemId]);
    if (itemRows.length === 0) {
      throw new Error("STOCK_ITEM_NOT_FOUND");
    }
    const accountId = itemRows[0].account_id;

    // 2) 값 포맷팅 (숫자 타입인 경우 캐스팅)
    let finalValue = value;
    if (['amount', 'lastMonthChange', 'changeVal'].includes(fieldName)) {
      finalValue = parseFloat(value || 0);
    }

    // 3) stock_item 필드 업데이트
    await conn.query(`UPDATE stock_item SET "${dbFieldName}" = $1 WHERE id = $2`, [finalValue, itemId]);

    // 4) 만약 amount가 변경되었다면 부모 계좌의 balance도 갱신
    if (fieldName === 'amount') {
      const { rows: sumRows } = await conn.query('SELECT SUM(amount) as total FROM stock_item WHERE account_id = $1', [accountId]);
      const totalBalance = parseFloat(sumRows[0].total || 0);
      await conn.query('UPDATE account SET balance = $1 WHERE id = $2', [totalBalance, accountId]);
    }

    await conn.query('COMMIT');
    revalidatePath('/transactions');
    revalidatePath('/accounts');
  } catch (err) {
    if (conn) await conn.query('ROLLBACK');
    console.error("[Transactions Actions] Failed to update stock item field:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 계좌(account) 테이블의 필드 업데이트 (기관명 등)
export async function updateAccountField(accountId, fieldName, value) {
  const allowedFields = ['institution'];
  if (!allowedFields.includes(fieldName)) {
    throw new Error("INVALID_FIELD");
  }

  try {
    await pool.query(`UPDATE account SET "${fieldName}" = $1 WHERE id = $2`, [value || '', accountId]);
    revalidatePath('/transactions');
    revalidatePath('/accounts');
  } catch (err) {
    console.error("[Transactions Actions] Failed to update account field:", err);
    throw err;
  }
}
