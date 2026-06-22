import pg from 'pg';

const { Pool } = pg;

// DECIMAL (Numeric) 타입을 string이 아닌 float로 파싱하도록 설정 (MySQL의 decimalNumbers: true 와 유사)
pg.types.setTypeParser(1700, val => val === null ? null : parseFloat(val));

let pool;

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'finance_portfolio',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 10, // 커넥션 제한 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (process.env.NODE_ENV === 'production') {
  pool = new Pool(poolConfig);
} else {
  if (!global.dbPool) {
    global.dbPool = new Pool(poolConfig);
  }
  pool = global.dbPool;
}

// 애플리케이션 기동 시 테이블이 없다면 자동으로 생성해주는 헬퍼 함수
async function initDatabase() {
  try {
    console.log("[DB] Checking and initializing database tables...");

    // 1. account 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. stock_item 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_item (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        account_id BIGINT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_stock_item_account FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE
      );
    `);

    // 3. updated_at 갱신 트리거 생성
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_account_updated_at ON account;
      CREATE TRIGGER update_account_updated_at
          BEFORE UPDATE ON account
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_stock_item_updated_at ON stock_item;
      CREATE TRIGGER update_stock_item_updated_at
          BEFORE UPDATE ON stock_item
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    // 동적 컬럼 추가를 위한 헬퍼 함수
    const addColumnIfNotExist = async (tableName, columnName, definition) => {
      const { rows } = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
          AND column_name = $2
      `, [tableName, columnName]);
      
      if (rows.length === 0) {
        console.log(`[DB] Adding column ${columnName} to table ${tableName}...`);
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
      }
    };

    // account 테이블 컬럼 추가
    await addColumnIfNotExist('account', 'institution', "VARCHAR(100) NOT NULL DEFAULT ''");
    await addColumnIfNotExist('account', 'account_type', "VARCHAR(100) NOT NULL DEFAULT ''");
    await addColumnIfNotExist('account', 'base_date', "VARCHAR(10) NOT NULL DEFAULT ''");

    // stock_item 테이블 컬럼 추가
    await addColumnIfNotExist('stock_item', 'category', "VARCHAR(50) NOT NULL DEFAULT '성장자산'");
    await addColumnIfNotExist('stock_item', 'last_month_change', "DECIMAL(18, 2) NOT NULL DEFAULT 0.00");
    await addColumnIfNotExist('stock_item', 'change_val', "DECIMAL(18, 2) NOT NULL DEFAULT 0.00");
    await addColumnIfNotExist('stock_item', 'note', "VARCHAR(255) NOT NULL DEFAULT ''");

    // 마이그레이션: 기존 적금(SAVINGS) 계좌 중 stock_item 매핑이 누락된 항목 복구 생성
    console.log("[DB] Migrating missing stock_item records for SAVINGS accounts...");
    await pool.query(`
      INSERT INTO stock_item (name, amount, account_id, category, note)
      SELECT a.name, a.balance, a.id, '현금자산', ''
      FROM account a
      LEFT JOIN stock_item s ON a.id = s.account_id
      WHERE a.type = 'SAVINGS' AND s.id IS NULL
    `);

    console.log("[DB] Database tables check/initialization completed.");
  } catch (err) {
    console.error("[DB] Failed to initialize database tables:", err);
  }
}

// 비동기 즉시실행으로 최초 커넥션 획득 시 초기화 작업 실행
initDatabase();

export default pool;
