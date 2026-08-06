-- 006_abandoned_carts.sql — Recuperação de carrinho abandonado (aditivo, idempotente)
-- Aplicar: psql "$DATABASE_URL" -f migrations/006_abandoned_carts.sql

ALTER TABLE cart_sessions
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS recovery_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS contact_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS recovery_coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS recovered_order_id INTEGER;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS abandoned_message_template TEXT;
