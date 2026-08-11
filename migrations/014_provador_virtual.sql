-- 014 — Provador Virtual
--
-- A cliente envia foto de corpo na página da peça e vê a peça vestida nela.
-- Foto de corpo de pessoa identificável é dado pessoal sensível na prática, e a
-- titular aqui não é usuária logada: é uma sessão anônima. Por isso o desenho
-- destas tabelas é, antes de tudo, um desenho de retenção.
--
-- Três decisões que o schema torna obrigatórias, não opcionais:
--   1. Nenhuma coluna de PII: sem nome, e-mail ou telefone. A titular é a sessão.
--   2. Acesso por `token` UUIDv4, nunca pelo `id` serial — id serial em rota
--      pública é enumerável, e enumerar aqui significa varrer fotos de corpo.
--   3. `expires_at` NOT NULL na foto: toda linha nasce sabendo quando morre, e o
--      expurgo é uma varredura simples em vez de uma regra espalhada no código.
--
-- Idempotente (INV-E): aplicar N vezes dá o mesmo schema.

-- ─── Fotos enviadas pela cliente ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tryon_photos (
  id              SERIAL PRIMARY KEY,
  token           TEXT        NOT NULL UNIQUE,
  session_id      TEXT        NOT NULL,
  file_path       TEXT        NOT NULL,
  -- Versão do termo aceito: sem isso não dá para provar QUAL texto a titular
  -- aceitou quando o termo for revisado.
  consent_version TEXT        NOT NULL,
  consented_at    TIMESTAMPTZ NOT NULL,
  adult_declared  BOOLEAN     NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  purged_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Provas geradas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tryon_generations (
  id               SERIAL PRIMARY KEY,
  token            TEXT        NOT NULL UNIQUE,
  photo_id         INTEGER     NOT NULL REFERENCES tryon_photos(id) ON DELETE CASCADE,
  product_id       INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id       INTEGER     REFERENCES variants(id) ON DELETE SET NULL,
  -- Qual imagem da galeria alimentou a prova: a mesma peça em foto diferente
  -- muda o resultado, e sem isto não dá para explicar por que mudou.
  garment_image_id INTEGER     REFERENCES product_images(id) ON DELETE SET NULL,
  model            TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'na_fila',
  provider_job_id  TEXT,
  result_path      TEXT,
  provider_cost    NUMERIC(10,4),
  error_message    TEXT,
  expires_at       TIMESTAMPTZ,
  purged_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ
);

DO $$ BEGIN
  ALTER TABLE tryon_generations
    ADD CONSTRAINT tryon_generations_status_check
    CHECK (status IN ('na_fila','processando','concluida','falhou','recusada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tryon_generations_status  ON tryon_generations (status);
CREATE INDEX IF NOT EXISTS idx_tryon_generations_created ON tryon_generations (created_at);
CREATE INDEX IF NOT EXISTS idx_tryon_generations_expires ON tryon_generations (expires_at);
CREATE INDEX IF NOT EXISTS idx_tryon_generations_photo   ON tryon_generations (photo_id);
CREATE INDEX IF NOT EXISTS idx_tryon_photos_expires      ON tryon_photos (expires_at);
CREATE INDEX IF NOT EXISTS idx_tryon_photos_session      ON tryon_photos (session_id);

-- ─── Configuração da loja ───────────────────────────────────────────────────
-- tryon_enabled nasce FALSE de propósito: o recurso é público e gasta crédito
-- do provedor por uso. Ligar é decisão consciente da operação, não default.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tryon_enabled             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tryon_model               TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tryon_monthly_limit       INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tryon_session_daily_limit INTEGER NOT NULL DEFAULT 8;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tryon_timeout_seconds     INTEGER NOT NULL DEFAULT 180;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tryon_photo_ttl_hours     INTEGER NOT NULL DEFAULT 24;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tryon_result_ttl_hours    INTEGER NOT NULL DEFAULT 168;

-- ─── Galeria do produto ─────────────────────────────────────────────────────
-- Toggle "usar na prova virtual": a foto que veste melhor no try-on nem sempre
-- é a principal da vitrine.
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_tryon_source BOOLEAN NOT NULL DEFAULT false;
