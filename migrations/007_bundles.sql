-- 007_bundles.sql — Kits (compre junto) + cross-sell (aditivo, idempotente)
-- Aplicar: psql "$DATABASE_URL" -f migrations/007_bundles.sql

CREATE TABLE IF NOT EXISTS product_relations (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  related_product_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bundles (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bundle_items (
  id SERIAL PRIMARY KEY,
  bundle_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS bundle_group_id TEXT,
  ADD COLUMN IF NOT EXISTS bundle_label TEXT;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS bundle_label TEXT;
