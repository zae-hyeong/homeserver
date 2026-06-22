-- Finance Portfolio DB Schema (PostgreSQL)

-- 1. 계좌 테이블 생성
CREATE TABLE IF NOT EXISTS account (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'STOCK' (주식), 'SAVINGS' (단일금액 적금)
  balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  institution VARCHAR(100) NOT NULL DEFAULT '',
  account_type VARCHAR(100) NOT NULL DEFAULT '',
  base_date VARCHAR(10) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN account.type IS 'STOCK (주식), SAVINGS (단일금액 적금)';

-- 2. 주식 종목 테이블 생성
CREATE TABLE IF NOT EXISTS stock_item (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  account_id BIGINT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT '성장자산',
  last_month_change DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  change_val DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  note VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_item_account FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE
);

-- 3. updated_at 자동 업데이트를 위한 트리거 함수 및 트리거 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_account_updated_at
    BEFORE UPDATE ON account
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_stock_item_updated_at
    BEFORE UPDATE ON stock_item
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
