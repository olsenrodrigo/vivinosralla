-- 004_reviews.sql — Avaliações de produtos (aditivo, idempotente)
-- Aplicar: psql "$DATABASE_URL" -f migrations/004_reviews.sql

CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  customer_id INTEGER,
  rating INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  title TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_purchase BOOLEAN NOT NULL DEFAULT false,
  admin_reply TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  moderated_at TIMESTAMP,
  moderated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviews_prod_status
  ON product_reviews (product_id, status, created_at);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(2,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reviews_require_moderation BOOLEAN NOT NULL DEFAULT true;
