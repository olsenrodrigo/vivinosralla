-- Migration: add featured column to products, accent_color to store_settings
-- Execute: psql $DATABASE_URL < migrations/002_featured_accent.sql

ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS accent_color TEXT;

CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
