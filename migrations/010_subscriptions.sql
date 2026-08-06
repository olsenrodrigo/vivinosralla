-- Assinaturas recorrentes (schema.ts: subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  gateway_subscription_id TEXT NOT NULL UNIQUE,
  gateway_customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  customer_cpf TEXT,
  shipping_recipient TEXT,
  shipping_cep TEXT NOT NULL,
  shipping_logradouro TEXT NOT NULL,
  shipping_numero TEXT NOT NULL,
  shipping_complemento TEXT,
  shipping_bairro TEXT NOT NULL,
  shipping_cidade TEXT NOT NULL,
  shipping_estado TEXT NOT NULL,
  billing_type TEXT NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'MONTHLY',
  value DECIMAL(10,2) NOT NULL,
  shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_service TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  items_snapshot JSONB NOT NULL,
  next_due_date TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
