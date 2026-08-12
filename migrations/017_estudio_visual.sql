-- 017 — Estúdio Visual IA
--
-- A cliente compra pela foto. Hoje o catálogo vive de imagens capturadas do
-- Instagram em 523×697, e trocar isso por foto de estúdio de verdade é o item
-- mais caro do go-live. O Estúdio gera a peça em manequim virtual a partir da
-- foto que a loja já tem — mas só publica o que uma pessoa aprovou.
--
-- Três decisões que este schema torna obrigatórias:
--
--   1. NENHUMA IMAGEM GERADA VAI AO CATÁLOGO SOZINHA. `studio_variants` nasce
--      `pendente` e só vira foto de produto quando alguém aprova, gravando
--      `reviewed_by`. Aprovação automática de imagem de IA em loja real é como
--      publicar preço sem conferir.
--
--   2. `preset_snapshot` É CÓPIA, NÃO REFERÊNCIA. O preset muda com o tempo; a
--      geração precisa dizer com que parâmetros ELA foi feita, meses depois,
--      sem versionar a tabela de presets.
--
--   3. A CHAVE DO PROVEDOR É CIFRADA (`bytea`), nunca texto puro — mesmo padrão
--      do certificado fiscal. Nunca em resposta de API, nunca em log (regra 9
--      do harness). Esta migration cria a coluna; cifrar é da task que integra.
--
-- `studio_monthly_limit` é teto de custo: geração de imagem é a única operação
-- da loja que gasta dinheiro por clique de admin.
--
-- A spec previa `021`; o repo está em `016`. Número é o próximo livre.
-- Idempotente: aplicar N vezes dá o mesmo schema (INV-E).

-- ── Presets da marca ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS studio_presets (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  background   TEXT NOT NULL,
  pose         TEXT,
  framing      TEXT,
  extra_prompt TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Gerações ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS studio_generations (
  id               SERIAL PRIMARY KEY,
  product_id       INTEGER REFERENCES products(id) ON DELETE CASCADE,
  source_image_url TEXT NOT NULL,
  -- SET NULL, não CASCADE: apagar um preset não pode apagar o histórico do que
  -- já foi gerado com ele — o snapshot abaixo preserva os parâmetros.
  preset_id        INTEGER REFERENCES studio_presets(id) ON DELETE SET NULL,
  preset_snapshot  JSONB NOT NULL,
  variant_count    INTEGER NOT NULL DEFAULT 2,
  status           TEXT NOT NULL DEFAULT 'na_fila',
  provider         TEXT,
  provider_cost    NUMERIC(10, 4),
  error_message    TEXT,
  requested_by     INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  CONSTRAINT studio_generations_status_valido
    CHECK (status IN ('na_fila', 'processando', 'concluida', 'falhou')),
  CONSTRAINT studio_generations_variantes_na_faixa
    CHECK (variant_count BETWEEN 1 AND 4)
);

-- ── Variações geradas ───────────────────────────────────────────────────────
-- `product_image_id` só é preenchido depois da aprovação: é o vínculo com a
-- foto que foi de fato publicada na galeria da peça.
CREATE TABLE IF NOT EXISTS studio_variants (
  id               SERIAL PRIMARY KEY,
  generation_id    INTEGER NOT NULL REFERENCES studio_generations(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pendente',
  product_image_id INTEGER REFERENCES product_images(id) ON DELETE SET NULL,
  reviewed_by      INTEGER,
  reviewed_at      TIMESTAMPTZ,
  CONSTRAINT studio_variants_status_valido
    CHECK (status IN ('pendente', 'aprovada', 'descartada'))
);

-- ── Configuração do estúdio ─────────────────────────────────────────────────
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS studio_provider          TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS studio_api_key_encrypted BYTEA;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS studio_monthly_limit     INTEGER NOT NULL DEFAULT 1500;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS studio_timeout_seconds   INTEGER NOT NULL DEFAULT 120;

-- ── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_studio_generations_status     ON studio_generations(status);
CREATE INDEX IF NOT EXISTS idx_studio_generations_created    ON studio_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_studio_generations_product    ON studio_generations(product_id);
CREATE INDEX IF NOT EXISTS idx_studio_variants_generation    ON studio_variants(generation_id);
