-- WhiteLabel Loja Virtual — Schema completo
-- Execute: psql $DATABASE_URL < migrations/001_store_tables.sql

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Store settings
CREATE TABLE IF NOT EXISTS store_settings (
  id SERIAL PRIMARY KEY,
  store_name TEXT NOT NULL DEFAULT 'Minha Loja',
  store_description TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#5B8C9B',
  secondary_color TEXT NOT NULL DEFAULT '#2C3E50',
  contact_email TEXT,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  address TEXT,
  cnpj TEXT,
  pix_key TEXT,
  mercado_pago_token TEXT,
  mercado_pago_public_key TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  whatsapp_token TEXT,
  whatsapp_phone_id TEXT,
  free_shipping_above DECIMAL(10,2),
  max_installments INTEGER NOT NULL DEFAULT 12,
  free_installments INTEGER NOT NULL DEFAULT 3,
  monthly_interest_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0199,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  vendor TEXT,
  brand TEXT,
  type TEXT,
  tags TEXT,
  sku TEXT,
  barcode TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_per_item DECIMAL(10,2),
  weight_g INTEGER,
  height_cm DECIMAL(8,2),
  width_cm DECIMAL(8,2),
  depth_cm DECIMAL(8,2),
  requires_shipping BOOLEAN NOT NULL DEFAULT true,
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  continue_selling_out_of_stock BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  published BOOLEAN NOT NULL DEFAULT true,
  free_shipping BOOLEAN NOT NULL DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  ncm_code TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Product images
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Product attributes
CREATE TABLE IF NOT EXISTS product_attributes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- Variants
CREATE TABLE IF NOT EXISTS variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  barcode TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost DECIMAL(10,2),
  weight_g INTEGER,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  option1 TEXT,
  option2 TEXT,
  option3 TEXT,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cpf_cnpj TEXT,
  phone TEXT,
  password_hash TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER,
  label TEXT NOT NULL DEFAULT 'Casa',
  recipient TEXT NOT NULL,
  cep TEXT NOT NULL,
  logradouro TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Cart sessions
CREATE TABLE IF NOT EXISTS cart_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  customer_id INTEGER,
  coupon_code TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES cart_sessions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_cpf TEXT,
  shipping_recipient TEXT,
  shipping_cep TEXT,
  shipping_logradouro TEXT,
  shipping_numero TEXT,
  shipping_complemento TEXT,
  shipping_bairro TEXT,
  shipping_cidade TEXT,
  shipping_estado TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_transaction_id TEXT,
  shipping_carrier TEXT,
  shipping_service TEXT,
  tracking_code TEXT,
  coupon_code TEXT,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  variant_id INTEGER,
  product_title TEXT NOT NULL,
  variant_title TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  image_url TEXT
);

-- Order status history
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  gateway TEXT NOT NULL,
  gateway_transaction_id TEXT,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  pix_expiration TIMESTAMP,
  boleto_url TEXT,
  boleto_barcode TEXT,
  raw_response JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'percentage',
  value DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(10,2),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER NOT NULL DEFAULT 1,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Shipping zones
CREATE TABLE IF NOT EXISTS shipping_zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  states TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Shipping rates
CREATE TABLE IF NOT EXISTS shipping_rates (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES shipping_zones(id),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  min_weight_g INTEGER,
  max_weight_g INTEGER,
  estimated_days_min INTEGER NOT NULL DEFAULT 1,
  estimated_days_max INTEGER NOT NULL DEFAULT 7,
  free_above_value DECIMAL(10,2),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Contact messages (original)
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status, published);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_tx ON payment_transactions(gateway_transaction_id);
