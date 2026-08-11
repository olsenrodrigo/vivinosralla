import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, serial, timestamp, integer, boolean,
  decimal, jsonb, pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Contato (original) ─────────────────────────────────────────────────────
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, createdAt: true });
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;

// ─── Admin Users ─────────────────────────────────────────────────────────────
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"), // admin | operator | viewer
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, createdAt: true });
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// ─── Store Settings ───────────────────────────────────────────────────────────
// ─── Config de formas de pagamento (roteamento por método) ───────────────────
export type PaymentMethodKey = "pix" | "boleto" | "credit_card";
export type PaymentGatewayId = "asaas" | "mercadopago";
export type PaymentCardMode = "embedded" | "redirect";
export interface PaymentMethodConfig {
  enabled: boolean;
  gateway: PaymentGatewayId;
  mode?: PaymentCardMode; // relevante só para cartão (embutido x redirect)
}
export interface PaymentConfig {
  pix: PaymentMethodConfig;
  boleto: PaymentMethodConfig;
  credit_card: PaymentMethodConfig;
}
export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  pix: { enabled: true, gateway: "mercadopago" },
  boleto: { enabled: true, gateway: "mercadopago" },
  credit_card: { enabled: true, gateway: "mercadopago", mode: "embedded" },
};

// ─── Analytics & Pixels (medição de funil) ───────────────────────────────────
// Só IDs PÚBLICOS de pixel (podem ir ao front). Nunca guardar aqui tokens
// secretos (ex.: Meta Conversions API) — esses vão em coluna própria.
export interface AnalyticsConfig {
  ga4MeasurementId?: string; // G-XXXXXXX
  metaPixelId?: string;      // Meta/Facebook Pixel
  tiktokPixelId?: string;    // TikTok Pixel (opcional)
  requireConsent?: boolean;  // LGPD: exigir consentimento antes de carregar (default true)
}
export const ANALYTICS_CONFIG_KEYS: (keyof AnalyticsConfig)[] = [
  "ga4MeasurementId",
  "metaPixelId",
  "tiktokPixelId",
  "requireConsent",
];

export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  storeName: text("store_name").notNull().default("Minha Loja"),
  storeDescription: text("store_description"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").notNull().default("#5B8C9B"),
  secondaryColor: text("secondary_color").notNull().default("#2C3E50"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactWhatsapp: text("contact_whatsapp"),
  address: text("address"),
  cnpj: text("cnpj"),
  pixKey: text("pix_key"),
  mercadoPagoToken: text("mercado_pago_token"),
  mercadoPagoPublicKey: text("mercado_pago_public_key"),
  paymentConfig: jsonb("payment_config").$type<PaymentConfig>(),
  analyticsConfig: jsonb("analytics_config").$type<AnalyticsConfig>(),
  // Mensagem de recuperação de carrinho (placeholders: {nome} {itens} {link} {cupom})
  abandonedMessageTemplate: text("abandoned_message_template"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  whatsappToken: text("whatsapp_token"),
  whatsappPhoneId: text("whatsapp_phone_id"),
  freeShippingAbove: decimal("free_shipping_above", { precision: 10, scale: 2 }),
  accentColor: text("accent_color"),
  maxInstallments: integer("max_installments").notNull().default(12),
  freeInstallments: integer("free_installments").notNull().default(3),
  monthlyInterestRate: decimal("monthly_interest_rate", { precision: 5, scale: 4 }).notNull().default("0.0199"),
  reviewsEnabled: boolean("reviews_enabled").notNull().default(true),
  reviewsRequireModeration: boolean("reviews_require_moderation").notNull().default(true),
  // ─── Provador Virtual ───────────────────────────────────────────────────
  // Nasce desligado de propósito: recurso público que gasta crédito por uso.
  tryonEnabled: boolean("tryon_enabled").notNull().default(false),
  tryonModel: text("tryon_model"),
  tryonMonthlyLimit: integer("tryon_monthly_limit").notNull().default(1000),
  tryonSessionDailyLimit: integer("tryon_session_daily_limit").notNull().default(8),
  tryonTimeoutSeconds: integer("tryon_timeout_seconds").notNull().default(180),
  tryonPhotoTtlHours: integer("tryon_photo_ttl_hours").notNull().default(24),
  tryonResultTtlHours: integer("tryon_result_ttl_hours").notNull().default(168),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StoreSettings = typeof storeSettings.$inferSelect;

// ─── Categorias ───────────────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// ─── Produtos ─────────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id"),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  vendor: text("vendor"),
  brand: text("brand"),
  type: text("type"),
  tags: text("tags"),
  sku: text("sku"),
  barcode: text("barcode"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  costPerItem: decimal("cost_per_item", { precision: 10, scale: 2 }),
  weightG: integer("weight_g"),
  heightCm: decimal("height_cm", { precision: 8, scale: 2 }),
  widthCm: decimal("width_cm", { precision: 8, scale: 2 }),
  depthCm: decimal("depth_cm", { precision: 8, scale: 2 }),
  requiresShipping: boolean("requires_shipping").notNull().default(true),
  trackInventory: boolean("track_inventory").notNull().default(true),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  continueSellingOutOfStock: boolean("continue_selling_out_of_stock").notNull().default(false),
  status: text("status").notNull().default("active"), // active | draft | archived
  published: boolean("published").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  freeShipping: boolean("free_shipping").notNull().default(false),
  // Agregado denormalizado de avaliações (recalculado na moderação)
  ratingAvg: decimal("rating_avg", { precision: 2, scale: 1 }).notNull().default("0"),
  ratingCount: integer("rating_count").notNull().default(0),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  ncmCode: text("ncm_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ─── Imagens do Produto ───────────────────────────────────────────────────────
export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  position: integer("position").notNull().default(0),
  isMain: boolean("is_main").notNull().default(false),
  // A foto que veste melhor no try-on nem sempre é a principal da vitrine.
  isTryonSource: boolean("is_tryon_source").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductImageSchema = createInsertSchema(productImages).omit({ id: true, createdAt: true });
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ProductImage = typeof productImages.$inferSelect;

// ─── Atributos de Variante ────────────────────────────────────────────────────
export const productAttributes = pgTable("product_attributes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(), // e.g. "Cor", "Tamanho"
  position: integer("position").notNull().default(0),
});

export type ProductAttribute = typeof productAttributes.$inferSelect;

// ─── Variantes ────────────────────────────────────────────────────────────────
export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  weightG: integer("weight_g"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  option1: text("option1"),
  option2: text("option2"),
  option3: text("option3"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVariantSchema = createInsertSchema(variants).omit({ id: true, createdAt: true });
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type Variant = typeof variants.$inferSelect;

// ─── Clientes (loja) ─────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  cpfCnpj: text("cpf_cnpj"),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ─── Endereços ────────────────────────────────────────────────────────────────
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  label: text("label").notNull().default("Casa"),
  recipient: text("recipient").notNull(),
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  bairro: text("bairro").notNull(),
  cidade: text("cidade").notNull(),
  estado: text("estado").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAddressSchema = createInsertSchema(addresses).omit({ id: true, createdAt: true });
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;

// ─── Carrinhos ────────────────────────────────────────────────────────────────
export const cartSessions = pgTable("cart_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(), // uuid v4 = capability do carrinho
  customerId: integer("customer_id"),
  couponCode: text("coupon_code"),
  // Recuperação de carrinho abandonado (contato capturado só com consentimento)
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  consentAt: timestamp("consent_at"), // LGPD: contato só é usado se houver consentimento
  recoveryStatus: text("recovery_status").notNull().default("open"), // open | contacted | converted
  contactCount: integer("contact_count").notNull().default(0),
  contactedAt: timestamp("contacted_at"),
  recoveryCouponCode: text("recovery_coupon_code"),
  recoveredOrderId: integer("recovered_order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  bundleGroupId: text("bundle_group_id"), // agrupa itens de um mesmo kit adicionado
  bundleLabel: text("bundle_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Pedidos ──────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  customerCpf: text("customer_cpf"),
  // Endereço de entrega (desnormalizado para histórico)
  shippingRecipient: text("shipping_recipient"),
  shippingCep: text("shipping_cep"),
  shippingLogradouro: text("shipping_logradouro"),
  shippingNumero: text("shipping_numero"),
  shippingComplemento: text("shipping_complemento"),
  shippingBairro: text("shipping_bairro"),
  shippingCidade: text("shipping_cidade"),
  shippingEstado: text("shipping_estado"),
  // Valores
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  // Status
  status: text("status").notNull().default("pending_payment"),
  // pending_payment | confirmed | processing | shipped | delivered | cancelled | refunded
  paymentMethod: text("payment_method"),   // pix | boleto | credit_card | debit_card
  paymentStatus: text("payment_status").notNull().default("pending"),
  // pending | approved | rejected | cancelled | refunded
  paymentTransactionId: text("payment_transaction_id"),
  // Envio
  shippingCarrier: text("shipping_carrier"),
  shippingService: text("shipping_service"),
  trackingCode: text("tracking_code"),
  // Desconto
  couponCode: text("coupon_code"),
  // Observações
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  // Assinatura que materializou este pedido (null = pedido avulso)
  subscriptionId: integer("subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ─── Itens do Pedido ──────────────────────────────────────────────────────────
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id"),
  variantId: integer("variant_id"),
  productTitle: text("product_title").notNull(),
  variantTitle: text("variant_title"),
  sku: text("sku"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  bundleLabel: text("bundle_label"), // nome do kit de origem (snapshot)
});

// ─── Histórico de Status ──────────────────────────────────────────────────────
export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  createdBy: text("created_by").default("system"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Transações de Pagamento ──────────────────────────────────────────────────
export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  gateway: text("gateway").notNull(), // mercadopago | pagseguro | stripe
  gatewayTransactionId: text("gateway_transaction_id"),
  method: text("method").notNull(), // pix | boleto | credit_card | debit_card
  status: text("status").notNull().default("pending"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BRL"),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  pixExpiration: timestamp("pix_expiration"),
  boletoUrl: text("boleto_url"),
  boletoBarcode: text("boleto_barcode"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Cupons ───────────────────────────────────────────────────────────────────
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull().default("percentage"), // percentage | fixed | free_shipping
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  perCustomerLimit: integer("per_customer_limit").notNull().default(1),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, usedCount: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

// ─── Avaliações de produtos ───────────────────────────────────────────────────
// O e-mail nunca é exibido publicamente (só para verificação de compra).
export const productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  customerId: integer("customer_id"),
  rating: integer("rating").notNull(), // 1..5
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email"), // interno — nunca vai ao público
  title: text("title"),
  comment: text("comment"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  verifiedPurchase: boolean("verified_purchase").notNull().default(false),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  moderatedAt: timestamp("moderated_at"),
  moderatedBy: text("moderated_by"),
});
export type ProductReview = typeof productReviews.$inferSelect;

// ─── Cross-sell / Kits ─────────────────────────────────────────────────────────
export const productRelations = pgTable("product_relations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  relatedProductId: integer("related_product_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const bundles = pgTable("bundles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  discountType: text("discount_type").notNull().default("percentage"), // percentage | fixed | fixed_price
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bundleItems = pgTable("bundle_items", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id").notNull(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"), // variante tem preço próprio
  quantity: integer("quantity").notNull().default(1),
});

export type Bundle = typeof bundles.$inferSelect;
export type BundleItem = typeof bundleItems.$inferSelect;

// ─── Assinaturas ("assine e receba") ──────────────────────────────────────────
// Espelho local da assinatura recorrente do Asaas, com snapshot dos itens e do
// endereço para materializar um pedido a cada ciclo cobrado (via webhook).
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  gatewaySubscriptionId: text("gateway_subscription_id").notNull().unique(), // sub_xxx
  gatewayCustomerId: text("gateway_customer_id").notNull(),                   // cus_xxx
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone").notNull(),
  customerCpf: text("customer_cpf"),
  shippingRecipient: text("shipping_recipient"),
  shippingCep: text("shipping_cep").notNull(),
  shippingLogradouro: text("shipping_logradouro").notNull(),
  shippingNumero: text("shipping_numero").notNull(),
  shippingComplemento: text("shipping_complemento"),
  shippingBairro: text("shipping_bairro").notNull(),
  shippingCidade: text("shipping_cidade").notNull(),
  shippingEstado: text("shipping_estado").notNull(),
  billingType: text("billing_type").notNull(), // PIX | BOLETO | CREDIT_CARD
  cycle: text("cycle").notNull().default("MONTHLY"),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingService: text("shipping_service"),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE | INACTIVE | CANCELLED
  itemsSnapshot: jsonb("items_snapshot").notNull(), // [{productId, variantId, productTitle, quantity, unitPrice, totalPrice, imageUrl}]
  nextDueDate: text("next_due_date"), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// ─── Zonas e Taxas de Envio ───────────────────────────────────────────────────
export const shippingZones = pgTable("shipping_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  states: text("states"), // "SP,RJ,MG" ou null para todos
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shippingRates = pgTable("shipping_rates", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  minWeightG: integer("min_weight_g"),
  maxWeightG: integer("max_weight_g"),
  estimatedDaysMin: integer("estimated_days_min").notNull().default(1),
  estimatedDaysMax: integer("estimated_days_max").notNull().default(7),
  freeAboveValue: decimal("free_above_value", { precision: 10, scale: 2 }),
  active: boolean("active").notNull().default(true),
});

// ─── Schemas de validação ─────────────────────────────────────────────────────

// ─── Provador Virtual ─────────────────────────────────────────────────────────
// Foto de corpo de pessoa identificável é dado pessoal sensível na prática, e a
// titular é uma sessão anônima, não uma usuária logada. Nenhuma das duas tabelas
// tem coluna de PII: sem nome, e-mail ou telefone. O acesso é sempre por `token`
// UUIDv4, nunca pelo `id` serial — id serial em rota pública é enumerável, e
// enumerar aqui significa varrer fotos de corpo.
export const tryonPhotos = pgTable("tryon_photos", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  sessionId: text("session_id").notNull(),
  filePath: text("file_path").notNull(),
  // Sem a versão não dá para provar QUAL termo a titular aceitou.
  consentVersion: text("consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  adultDeclared: boolean("adult_declared").notNull(),
  // NOT NULL: toda foto nasce sabendo quando morre.
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TryonPhoto = typeof tryonPhotos.$inferSelect;
export type InsertTryonPhoto = typeof tryonPhotos.$inferInsert;

export const TRYON_STATUS = ["na_fila", "processando", "concluida", "falhou", "recusada"] as const;
export type TryonStatus = (typeof TRYON_STATUS)[number];

export const tryonGenerations = pgTable("tryon_generations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  photoId: integer("photo_id").notNull(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  garmentImageId: integer("garment_image_id"),
  model: text("model").notNull(),
  status: text("status").notNull().default("na_fila"),
  providerJobId: text("provider_job_id"),
  resultPath: text("result_path"),
  providerCost: decimal("provider_cost", { precision: 10, scale: 4 }),
  errorMessage: text("error_message"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type TryonGeneration = typeof tryonGenerations.$inferSelect;
export type InsertTryonGeneration = typeof tryonGenerations.$inferInsert;

export const checkoutSchema = z.object({
  // Identificação
  customerName: z.string().min(3),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10),
  customerCpf: z.string().min(11),
  // Endereço
  shippingRecipient: z.string().min(3),
  shippingCep: z.string().length(8),
  shippingLogradouro: z.string().min(3),
  shippingNumero: z.string().min(1),
  shippingComplemento: z.string().optional(),
  shippingBairro: z.string().min(2),
  shippingCidade: z.string().min(2),
  shippingEstado: z.string().length(2),
  // Envio
  shippingCarrier: z.string().optional(),
  shippingService: z.string().optional(),
  // Sem o piso em zero, frete negativo vindo do corpo da requisição derruba o
  // total abaixo do subtotal — e, com valor grande o bastante, para negativo.
  shippingAmount: z.number().min(0).default(0),
  // Pagamento
  paymentMethod: z.enum(["pix", "boleto", "credit_card", "debit_card"]),
  // Cartão de crédito (opcional)
  cardToken: z.string().optional(),
  cardInstallments: z.number().optional(),
  // Cupom
  couponCode: z.string().optional(),
  // Canal: "online" (gateway) ou "whatsapp" (fecha pelo WhatsApp, sem cobrança online)
  channel: z.enum(["online", "whatsapp"]).optional(),
  // Carrinho
  sessionId: z.string(),
});

export type CheckoutData = z.infer<typeof checkoutSchema>;
