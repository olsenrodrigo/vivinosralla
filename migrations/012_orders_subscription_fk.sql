-- `shared/schema.ts` declara orders.subscriptionId, mas nenhuma migration criava
-- a coluna — ela vinha só do `drizzle-kit push` no projeto original. Sem ela,
-- TODO INSERT em orders falhava (o Drizzle lista a coluna no RETURNING), o que
-- derrubava o checkout inteiro com 500.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id);

CREATE INDEX IF NOT EXISTS idx_orders_subscription ON orders(subscription_id);
