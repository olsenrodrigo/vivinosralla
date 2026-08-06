-- 005_analytics.sql — Analytics & Pixels (aditivo, idempotente)
-- Aplicar: psql "$DATABASE_URL" -f migrations/005_analytics.sql

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS analytics_config JSONB;
