-- Fase 8: canal de origem do pedido (online | whatsapp).
-- Aditivo; default 'online' preserva o comportamento dos pedidos existentes.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'online';
