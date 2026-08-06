-- Fase 6/7: seleção de gateway de pagamento por método (MercadoPago | Asaas).
-- Coluna JSONB aditiva; NULL = default (todos os métodos via mercadopago).
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_config JSONB;

-- Link de checkout hospedado (ex.: cartão via Asaas gera invoiceUrl).
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS redirect_url TEXT;
