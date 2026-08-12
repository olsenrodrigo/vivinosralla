-- 015 — Coleções, lookbooks e ficha de moda da peça
--
-- A loja nasceu como catálogo de e-commerce genérico: a peça tinha preço, foto
-- e estoque, mas não tinha o que faz uma cliente decidir comprar roupa sem
-- provar — medida e composição. E as peças apareciam soltas, uma ao lado da
-- outra, quando a marca vende look, não item.
--
-- Duas decisões que este schema fixa:
--
--   1. `products.measurements` é JSONB, não tabela normalizada. A tabela de
--      medidas é sempre lida inteira, junto com a peça, e nunca consultada por
--      campo ("me dê as peças com busto 88") — normalizar só acrescentaria join.
--      Formato: {"P": {"busto": 88, "cintura": 70}, "M": {...}}.
--
--   2. `consent_events.visitor_id` é um UUID de primeira visita guardado no
--      localStorage. NÃO guarda IP nem user-agent: o registro existe para
--      provar o aceite de cookies, não para identificar a pessoa. Guardar IP
--      aqui transformaria a prova de consentimento em rastreamento — o oposto
--      do que a LGPD pede.
--
-- A spec deste epic previa a migration como `012`; quando chegou a vez de
-- implementar, o repo já estava em `014`. O número é o próximo livre, e a spec
-- foi corrigida. Migration aplicada nunca é editada (regra 4 do CLAUDE.md).
--
-- Idempotente: aplicar N vezes dá o mesmo schema (INV-E).

-- ── Coleções ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  season          TEXT,
  cover_image_url TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_products (
  id            SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT collection_products_unicos UNIQUE (collection_id, product_id)
);

-- ── Lookbooks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lookbooks (
  id            SERIAL PRIMARY KEY,
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  image_url     TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- variant_id é opcional: o look pode apontar a cor exata usada na foto, mas o
-- lookbook continua válido para a peça inteira quando não aponta.
CREATE TABLE IF NOT EXISTS lookbook_items (
  id          SERIAL PRIMARY KEY,
  lookbook_id INTEGER NOT NULL REFERENCES lookbooks(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  INTEGER REFERENCES variants(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ── Ficha de moda da peça ───────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS composition   TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS measurements  JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_collection_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_collection_id_fkey
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Registro de consentimento de cookies ────────────────────────────────────
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS consent_log_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS consent_events (
  id             SERIAL PRIMARY KEY,
  visitor_id     TEXT NOT NULL,
  decision       TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT consent_events_decisao_valida CHECK (decision IN ('granted', 'denied'))
);

-- ── Índices ─────────────────────────────────────────────────────────────────
-- Os índices de filtro de moda (variants.option1/option2, products.price,
-- products.published+status) já existem em 011_fashion_indexes.sql.
CREATE INDEX IF NOT EXISTS idx_collection_products_collection ON collection_products(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_products_product    ON collection_products(product_id);
CREATE INDEX IF NOT EXISTS idx_lookbook_items_lookbook        ON lookbook_items(lookbook_id);
CREATE INDEX IF NOT EXISTS idx_products_collection            ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_collections_active             ON collections(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_lookbooks_active               ON lookbooks(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_consent_events_visitor         ON consent_events(visitor_id, created_at DESC);
