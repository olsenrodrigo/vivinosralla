-- 016 — Reservas de estoque, eventos de gateway e links de cobrança
--
-- Três problemas de checkout que só aparecem com a loja vendendo de verdade,
-- e que o schema precisa tornar impossíveis antes de existir código:
--
--   1. DUAS CLIENTES, A ÚLTIMA PEÇA. Enquanto uma paga o PIX, a outra fecha o
--      mesmo tamanho. Sem reserva, as duas compram e alguém recebe um pedido de
--      desculpas. `stock_reservations` segura a peça por prazo curto — e o saldo
--      disponível deixa de ser a coluna `variants.stock_quantity` e passa a ser
--      uma expressão: estoque menos reservas vivas.
--
--   2. O GATEWAY REENTREGA. MercadoPago e Asaas reenviam o mesmo evento, e fora
--      de ordem. `gateway_events` com unique(gateway, event_id) é o que torna o
--      webhook idempotente (INV-D): o mesmo evento N vezes tem o efeito de uma.
--
--   3. COBRANÇA FORA DA VITRINE. Consignado e PDV precisam mandar um link de
--      pagamento para a cliente. `payment_links` guarda a origem para que o
--      recebimento volte a baixar o título certo.
--
-- `orders.access_token` fecha o INV-B por outro lado: a consulta pública de
-- pedido (VIVI-108 já a restringiu por allowlist de campos) passa a exigir um
-- token não enumerável, em vez de depender só do número do pedido.
--
-- `store_settings.asaas_webhook_token` é SEGREDO: nunca em resposta de API,
-- nunca em log (regra 9 do harness). O GET de settings devolve mascarado.
--
-- A spec deste epic previa `013`; quando chegou a vez de implementar, o repo já
-- estava em `015`. Número é o próximo livre — migration aplicada não se edita.
--
-- gen_random_uuid() é nativo do Postgres 13+ (aqui: 16.14), sem pgcrypto.
-- Idempotente: aplicar N vezes dá o mesmo schema (INV-E).

-- ── Reserva de estoque ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_reservations (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES variants(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'held',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_reservations_status_valido CHECK (status IN ('held', 'consumed', 'released')),
  CONSTRAINT stock_reservations_quantidade_positiva CHECK (quantity > 0)
);

-- ── Idempotência de webhook ─────────────────────────────────────────────────
-- O unique é a trava real: o INSERT do segundo evento igual falha, e o webhook
-- responde 200 sem reprocessar. Não depende de o código lembrar de checar.
CREATE TABLE IF NOT EXISTS gateway_events (
  id           SERIAL PRIMARY KEY,
  gateway      TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  event_type   TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gateway_events_unicos UNIQUE (gateway, event_id)
);

-- ── Links de cobrança avulsa ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_links (
  id                SERIAL PRIMARY KEY,
  gateway_charge_id TEXT NOT NULL,
  origin_type       TEXT NOT NULL,
  origin_id         INTEGER,
  customer_id       INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  amount            NUMERIC(10, 2) NOT NULL,
  description       TEXT,
  url               TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  created_by        INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_links_origem_valida CHECK (origin_type IN ('consignacao', 'pdv', 'avulso')),
  CONSTRAINT payment_links_valor_positivo CHECK (amount > 0)
);

-- ── Pedido ──────────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_discount_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS installments        INTEGER;

-- Pedidos que já existem precisam de token antes do NOT NULL, senão a coluna
-- nasce inválida no primeiro deploy com base cheia.
UPDATE orders SET access_token = gen_random_uuid()::TEXT WHERE access_token IS NULL;

ALTER TABLE orders ALTER COLUMN access_token SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE orders ALTER COLUMN access_token SET NOT NULL;

-- ── Configuração da loja ────────────────────────────────────────────────────
-- O padrão de 5% espelha PIX_DESCONTO em shared/pagamento.ts: front e back
-- calculam desconto pela MESMA regra, e agora a loja pode mudar o número sem
-- deploy. Divergir daqui já causou exibir 5% e não cobrar.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pix_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pickup_enabled       BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS asaas_webhook_token  TEXT;

-- ── Índices ─────────────────────────────────────────────────────────────────
-- A varredura de expiração roda periodicamente e só olha reserva viva.
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expira  ON stock_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_variant ON stock_reservations(variant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order   ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_origin       ON payment_links(origin_type, origin_id);
-- Consulta pública de pedido busca pelo token, não pelo id (INV-B).
CREATE INDEX IF NOT EXISTS idx_orders_access_token        ON orders(access_token);
