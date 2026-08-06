-- Índices para os filtros de moda (tamanho = option1, cor = option2)
CREATE INDEX IF NOT EXISTS idx_variants_option1 ON variants(option1);
CREATE INDEX IF NOT EXISTS idx_variants_option2 ON variants(option2);
CREATE INDEX IF NOT EXISTS idx_variants_product_active ON variants(product_id, active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_published_status ON products(published, status);
