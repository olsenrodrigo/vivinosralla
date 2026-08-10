import {
  contactMessages, adminUsers, categories, products, productImages,
  variants, customers, addresses, cartSessions, cartItems, orders,
  orderItems, orderStatusHistory, paymentTransactions, coupons, subscriptions,
  productReviews, productRelations, bundles, bundleItems,
  shippingZones, shippingRates, storeSettings,
  type Subscription, type InsertSubscription,
  type ContactMessage, type InsertContactMessage,
  type AdminUser, type InsertAdminUser,
  type Category, type InsertCategory,
  type Product, type InsertProduct,
  type ProductImage, type InsertProductImage,
  type Variant, type InsertVariant,
  type Customer, type InsertCustomer,
  type Address, type InsertAddress,
  type Order, type InsertOrder,
  type Coupon, type InsertCoupon,
  type StoreSettings,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { eq, desc, asc, like, and, or, sql, isNull, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { priceBundle, type BundleDiscountType } from "@shared/bundle-pricing";
import pg from "pg";

// Lazy initialization so DATABASE_URL can be loaded from .env before connection
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) _db = drizzle(getPool());
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

// ─── Filtros do catálogo de moda ────────────────────────────────────────────
// Convenção de variantes da loja: option1 = Tamanho, option2 = Cor.

export type ProductSort = "newest" | "price_asc" | "price_desc" | "name_asc";

const PRODUCT_SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "name_asc"];

/** Normaliza o `sort` vindo da query string; valor desconhecido cai em "newest". */
export function parseProductSort(value: unknown): ProductSort {
  return PRODUCT_SORTS.includes(value as ProductSort) ? (value as ProductSort) : "newest";
}

function productOrderBy(sort: ProductSort = "newest") {
  switch (sort) {
    case "price_asc": return asc(sql`${products.price}::numeric`);
    case "price_desc": return desc(sql`${products.price}::numeric`);
    case "name_asc": return asc(products.title);
    default: return desc(products.createdAt);
  }
}

/**
 * Produto tem ao menos uma variante ativa cuja opção está entre os valores.
 * Usa EXISTS para não multiplicar linhas no join (o que quebraria o count).
 */
function variantOptionExists(column: AnyPgColumn, values: string[]) {
  return sql`EXISTS (
    SELECT 1 FROM ${variants}
    WHERE ${variants.productId} = ${products.id}
      AND ${variants.active} = true
      AND ${column} IN (${sql.join(values.map(v => sql`${v}`), sql`, `)})
  )`;
}

/** Escapa os curingas do LIKE para que "%" e "_" sejam buscados literalmente. */
function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, m => `\\${m}`);
}

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "Único"];

/** Ordena tamanhos na ordem de moda; valores fora da grade vão para o fim. */
function bySizeOrder(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a);
  const ib = SIZE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export class DatabaseStorage {
  // ─── Contact ─────────────────────────────────────────────────────────────
  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    const [result] = await db.insert(contactMessages).values(message).returning();
    return result;
  }

  // ─── Admin Users ──────────────────────────────────────────────────────────
  async getAdminByEmail(email: string): Promise<AdminUser | undefined> {
    const [result] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return result;
  }
  async getAdminById(id: number): Promise<AdminUser | undefined> {
    const [result] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return result;
  }
  async createAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const [result] = await db.insert(adminUsers).values(data).returning();
    return result;
  }
  async listAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).orderBy(asc(adminUsers.createdAt));
  }
  async updateAdminUser(id: number, data: Partial<InsertAdminUser>): Promise<AdminUser> {
    const [result] = await db.update(adminUsers).set(data).where(eq(adminUsers.id, id)).returning();
    return result;
  }
  async deleteAdminUser(id: number): Promise<void> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  // ─── Store Settings ───────────────────────────────────────────────────────
  async getStoreSettings(): Promise<StoreSettings | undefined> {
    const [result] = await db.select().from(storeSettings).limit(1);
    return result;
  }
  async upsertStoreSettings(data: Partial<StoreSettings>): Promise<StoreSettings> {
    const existing = await this.getStoreSettings();
    if (existing) {
      const [result] = await db.update(storeSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(storeSettings.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(storeSettings).values({ ...data } as any).returning();
    return result;
  }

  // ─── Categories ───────────────────────────────────────────────────────────
  async listCategories(activeOnly = false): Promise<Category[]> {
    const q = activeOnly
      ? db.select().from(categories).where(eq(categories.active, true))
      : db.select().from(categories);
    return q.orderBy(asc(categories.sortOrder), asc(categories.name));
  }
  async getCategoryById(id: number): Promise<Category | undefined> {
    const [result] = await db.select().from(categories).where(eq(categories.id, id));
    return result;
  }
  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [result] = await db.select().from(categories).where(eq(categories.slug, slug));
    return result;
  }
  async createCategory(data: InsertCategory): Promise<Category> {
    const [result] = await db.insert(categories).values(data).returning();
    return result;
  }
  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category> {
    const [result] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return result;
  }
  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // ─── Products ─────────────────────────────────────────────────────────────
  async listProducts(opts: {
    categoryId?: number; status?: string; published?: boolean;
    featured?: boolean; search?: string; limit?: number; offset?: number;
    // Filtros de moda: option1 = Tamanho, option2 = Cor (ver script/catalogo.ts)
    sizes?: string[]; colors?: string[];
    minPrice?: number; maxPrice?: number;
    sort?: ProductSort;
  } = {}): Promise<{ products: Product[]; total: number }> {
    const conditions = [];
    if (opts.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
    if (opts.status) conditions.push(eq(products.status, opts.status));
    if (opts.published !== undefined) conditions.push(eq(products.published, opts.published));
    if (opts.featured !== undefined) conditions.push(eq(products.featured, opts.featured));
    if (opts.search) {
      // A cliente digita "vestido" e "trico"; o catálogo tem "Vestido" e "Tricô".
      // unaccent + lower dos dois lados, e os curingas de LIKE são escapados
      // para "%" não devolver o catálogo inteiro.
      const termo = `%${escaparLike(opts.search)}%`;
      const semAcento = (col: AnyPgColumn) =>
        sql`unaccent(lower(coalesce(${col}, ''))) LIKE unaccent(lower(${termo})) ESCAPE '\\'`;
      conditions.push(
        or(semAcento(products.title), semAcento(products.sku), semAcento(products.brand))
      );
    }
    // Tamanho e cor são condições independentes (AND entre elas, OR dentro de cada uma)
    if (opts.sizes?.length) conditions.push(variantOptionExists(variants.option1, opts.sizes));
    if (opts.colors?.length) conditions.push(variantOptionExists(variants.option2, opts.colors));
    // price é DECIMAL — comparar como numeric para não cair em comparação textual
    if (opts.minPrice !== undefined) conditions.push(sql`${products.price}::numeric >= ${opts.minPrice}`);
    if (opts.maxPrice !== undefined) conditions.push(sql`${products.price}::numeric <= ${opts.maxPrice}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(products).where(where);

    const rows = await db.select().from(products)
      .where(where)
      .orderBy(productOrderBy(opts.sort))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);

    return { products: rows, total: Number(count) };
  }

  /**
   * Imagens de vários produtos numa query só — evita o N+1 de chamar
   * `getProductImages` dentro de um `map` sobre a listagem.
   */
  async getImagesForProducts(productIds: number[]): Promise<Map<number, ProductImage[]>> {
    const mapa = new Map<number, ProductImage[]>();
    if (!productIds.length) return mapa;
    const rows = await db.select().from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(asc(productImages.position));
    for (const img of rows) {
      const lista = mapa.get(img.productId);
      if (lista) lista.push(img);
      else mapa.set(img.productId, [img]);
    }
    return mapa;
  }

  /** Opções disponíveis para montar a UI de filtros da vitrine. */
  async listFilterFacets(categoryId?: number): Promise<{
    sizes: string[]; colors: string[]; minPrice: number; maxPrice: number;
  }> {
    const base = [eq(products.status, "active"), eq(products.published, true)];
    if (categoryId) base.push(eq(products.categoryId, categoryId));
    const where = and(...base);

    const [opts, range] = await Promise.all([
      db.selectDistinct({ size: variants.option1, color: variants.option2 })
        .from(variants)
        .innerJoin(products, eq(variants.productId, products.id))
        .where(and(where, eq(variants.active, true))),
      db.select({
        min: sql<string | null>`min(${products.price}::numeric)`,
        max: sql<string | null>`max(${products.price}::numeric)`,
      }).from(products).where(where),
    ]);

    const sizes = Array.from(new Set(opts.map(o => o.size).filter((s): s is string => !!s)))
      .sort(bySizeOrder);
    const colors = Array.from(new Set(opts.map(o => o.color).filter((c): c is string => !!c)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    return {
      sizes,
      colors,
      minPrice: Math.floor(Number(range[0]?.min ?? 0)),
      maxPrice: Math.ceil(Number(range[0]?.max ?? 0)),
    };
  }

  async getProductById(id: number): Promise<Product | undefined> {
    const [result] = await db.select().from(products).where(eq(products.id, id));
    return result;
  }
  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [result] = await db.select().from(products).where(eq(products.slug, slug));
    return result;
  }
  /**
   * Versão pública: só enxerga peça ativa E publicada — o mesmo par que a
   * vitrine passa para listProducts. Existe separada de getProductBySlug
   * porque a importação do admin precisa continuar achando rascunho; método
   * próprio deixa o call-site público explícito e impossibilita esquecer o filtro.
   */
  async getPublicProductBySlug(slug: string): Promise<Product | undefined> {
    const [result] = await db.select().from(products).where(
      and(eq(products.slug, slug), eq(products.status, "active"), eq(products.published, true))
    );
    return result;
  }
  async createProduct(data: InsertProduct): Promise<Product> {
    const [result] = await db.insert(products).values(data).returning();
    return result;
  }
  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product> {
    const [result] = await db.update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id)).returning();
    return result;
  }
  async deleteProduct(id: number): Promise<void> {
    await db.delete(productImages).where(eq(productImages.productId, id));
    await db.delete(variants).where(eq(variants.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }
  /**
   * Baixa o estoque do produto e, quando a venda foi de uma grade específica,
   * também o da variante. Sem a baixa por variante o total do produto até fecha,
   * mas o tamanho vendido continua disponível na vitrine e a loja revende peça
   * que já saiu.
   */
  async decrementStock(productId: number, qty: number, variantId?: number | null): Promise<void> {
    await db.update(products)
      .set({ stockQuantity: sql`${products.stockQuantity} - ${qty}` })
      .where(eq(products.id, productId));
    if (variantId) {
      await db.update(variants)
        .set({ stockQuantity: sql`${variants.stockQuantity} - ${qty}` })
        .where(eq(variants.id, variantId));
    }
  }

  // ─── Product Images ───────────────────────────────────────────────────────
  async getProductImages(productId: number): Promise<ProductImage[]> {
    return db.select().from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.position));
  }
  async addProductImage(data: InsertProductImage): Promise<ProductImage> {
    const [result] = await db.insert(productImages).values(data).returning();
    return result;
  }
  async deleteProductImage(id: number): Promise<void> {
    await db.delete(productImages).where(eq(productImages.id, id));
  }
  async setMainImage(productId: number, imageId: number): Promise<void> {
    await db.update(productImages).set({ isMain: false }).where(eq(productImages.productId, productId));
    await db.update(productImages).set({ isMain: true }).where(eq(productImages.id, imageId));
  }

  // ─── Variants ─────────────────────────────────────────────────────────────
  async getVariantsByProduct(productId: number): Promise<Variant[]> {
    return db.select().from(variants).where(eq(variants.productId, productId));
  }
  async createVariant(data: InsertVariant): Promise<Variant> {
    const [result] = await db.insert(variants).values(data).returning();
    return result;
  }
  async updateVariant(id: number, data: Partial<InsertVariant>): Promise<Variant> {
    const [result] = await db.update(variants).set(data).where(eq(variants.id, id)).returning();
    return result;
  }
  async deleteVariant(id: number): Promise<void> {
    await db.delete(variants).where(eq(variants.id, id));
  }

  // ─── Cart ─────────────────────────────────────────────────────────────────
  async getOrCreateCart(sessionId: string): Promise<any> {
    let [cart] = await db.select().from(cartSessions).where(eq(cartSessions.sessionId, sessionId));
    if (!cart) {
      [cart] = await db.insert(cartSessions).values({ sessionId }).returning();
    }
    const items = await db.select({
      id: cartItems.id, cartId: cartItems.cartId,
      productId: cartItems.productId, variantId: cartItems.variantId,
      quantity: cartItems.quantity, unitPrice: cartItems.unitPrice,
      bundleGroupId: cartItems.bundleGroupId, bundleLabel: cartItems.bundleLabel,
      productTitle: products.title, productSlug: products.slug,
      mainImage: sql<string>`(SELECT url FROM product_images WHERE product_id = ${cartItems.productId} AND is_main = true LIMIT 1)`,
      // Rótulo da variante escolhida, ex.: "M · Caramelo" (option1 = Tamanho, option2 = Cor)
      variantTitle: sql<string | null>`(
        SELECT NULLIF(CONCAT_WS(' · ', option1, option2, option3), '')
        FROM variants WHERE id = ${cartItems.variantId}
      )`,
    }).from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cart.id));
    return { ...cart, items };
  }
  async addToCart(sessionId: string, productId: number, variantId: number | null, quantity: number, unitPrice: string): Promise<void> {
    const cart = await this.getOrCreateCart(sessionId);
    const existing = cart.items.find((i: any) => i.productId === productId && i.variantId === variantId);
    if (existing) {
      await db.update(cartItems)
        .set({ quantity: existing.quantity + quantity })
        .where(eq(cartItems.id, existing.id));
    } else {
      await db.insert(cartItems).values({ cartId: cart.id, productId, variantId, quantity, unitPrice });
    }
    await db.update(cartSessions).set({ updatedAt: new Date() }).where(eq(cartSessions.id, cart.id));
  }
  async updateCartItem(itemId: number, quantity: number): Promise<void> {
    if (quantity <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, itemId));
    } else {
      await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId));
    }
  }
  async clearCart(sessionId: string): Promise<void> {
    const [cart] = await db.select().from(cartSessions).where(eq(cartSessions.sessionId, sessionId));
    if (cart) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    }
  }

  // ─── Recuperação de carrinho abandonado ────────────────────────────────────
  /** Captura/atualiza contato do carrinho (só com consentimento). Não reabre convertido. */
  async updateCartContact(sessionId: string, data: { name?: string | null; phone: string; email?: string | null; couponCode?: string | null }): Promise<void> {
    const [cart] = await db.select().from(cartSessions).where(eq(cartSessions.sessionId, sessionId));
    if (!cart) return;
    if (cart.recoveryStatus === "converted") return;
    await db.update(cartSessions).set({
      customerName: data.name ?? null,
      customerPhone: data.phone,
      customerEmail: data.email ?? null,
      couponCode: data.couponCode ?? cart.couponCode,
      consentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(cartSessions.id, cart.id));
  }

  async getCartSessionById(id: number): Promise<any> {
    const [row] = await db.select().from(cartSessions).where(eq(cartSessions.id, id));
    return row;
  }

  /** Lista carrinhos abandonados (contato capturado) com itens agregados. */
  async listAbandonedCarts(opts: { status?: string; minAgeHours?: number; maxAgeDays?: number } = {}): Promise<any[]> {
    const conds = [sql`${cartSessions.consentAt} IS NOT NULL`];
    if (opts.status) conds.push(eq(cartSessions.recoveryStatus, opts.status));
    if (opts.minAgeHours && opts.minAgeHours > 0)
      conds.push(sql`${cartSessions.updatedAt} <= now() - (${opts.minAgeHours} * interval '1 hour')`);
    if (opts.maxAgeDays && opts.maxAgeDays > 0)
      conds.push(sql`${cartSessions.updatedAt} >= now() - (${opts.maxAgeDays} * interval '1 day')`);
    const sessions = await db.select().from(cartSessions)
      .where(and(...conds)).orderBy(desc(cartSessions.updatedAt));
    const result: any[] = [];
    for (const s of sessions) {
      const items = await db.select({
        productTitle: products.title, quantity: cartItems.quantity, unitPrice: cartItems.unitPrice,
      }).from(cartItems).leftJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.cartId, s.id));
      const subtotal = items.reduce((t, i) => t + Number(i.unitPrice) * i.quantity, 0);
      result.push({ ...s, items, itemCount: items.reduce((t, i) => t + i.quantity, 0), subtotal });
    }
    return result;
  }

  /** Registra um contato de recuperação (atômico; só se não convertido). */
  async registerCartContact(id: number, couponCode?: string | null): Promise<any> {
    const [row] = await db.update(cartSessions).set({
      recoveryStatus: "contacted",
      contactCount: sql`${cartSessions.contactCount} + 1`,
      contactedAt: new Date(),
      recoveryCouponCode: couponCode ?? null,
      updatedAt: new Date(),
    }).where(and(eq(cartSessions.id, id), sql`${cartSessions.recoveryStatus} <> 'converted'`)).returning();
    return row ?? null;
  }

  /** Marca convertido — só se o telefone bater e ainda não convertido. */
  async markCartConverted(sessionId: string, orderId: number, phoneDigits: string): Promise<void> {
    await db.update(cartSessions).set({ recoveryStatus: "converted", recoveredOrderId: orderId, updatedAt: new Date() })
      .where(and(
        eq(cartSessions.sessionId, sessionId),
        sql`${cartSessions.recoveryStatus} <> 'converted'`,
        sql`regexp_replace(coalesce(${cartSessions.customerPhone}, ''), '[^0-9]', '', 'g') = ${phoneDigits}`,
      ));
  }

  /** PATCH de status — nunca sai de converted (estado final). */
  async updateCartRecoveryStatus(id: number, status: string): Promise<any> {
    const [row] = await db.update(cartSessions).set({ recoveryStatus: status, updatedAt: new Date() })
      .where(and(eq(cartSessions.id, id), sql`${cartSessions.recoveryStatus} <> 'converted'`)).returning();
    return row ?? null;
  }

  /** Revogação LGPD: limpa o contato do carrinho pelo sessionId (capability). */
  async revokeCartContact(sessionId: string): Promise<void> {
    await db.update(cartSessions).set({
      customerName: null, customerPhone: null, customerEmail: null,
      consentAt: null, recoveryStatus: "open", updatedAt: new Date(),
    }).where(eq(cartSessions.sessionId, sessionId));
  }

  /** Expurgo LGPD: limpa o contato (PII) de carrinhos consentidos há mais de N dias. */
  async purgeExpiredCartContacts(days: number): Promise<void> {
    await db.update(cartSessions).set({
      customerName: null, customerPhone: null, customerEmail: null, consentAt: null,
    }).where(sql`${cartSessions.consentAt} IS NOT NULL AND ${cartSessions.consentAt} < now() - (${days} * interval '1 day')`);
  }

  // ─── Customers ────────────────────────────────────────────────────────────
  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [result] = await db.select().from(customers).where(eq(customers.email, email));
    return result;
  }
  async getCustomerById(id: number): Promise<Customer | undefined> {
    const [result] = await db.select().from(customers).where(eq(customers.id, id));
    return result;
  }
  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [result] = await db.insert(customers).values(data).returning();
    return result;
  }
  async listCustomers(search?: string): Promise<Customer[]> {
    if (search) {
      return db.select().from(customers)
        .where(or(like(customers.name, `%${search}%`), like(customers.email, `%${search}%`)))
        .orderBy(desc(customers.createdAt));
    }
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  // ─── Orders ───────────────────────────────────────────────────────────────
  async createOrder(data: InsertOrder): Promise<Order> {
    const [result] = await db.insert(orders).values(data).returning();
    return result;
  }
  async getOrderById(id: number): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(eq(orders.id, id));
    return result;
  }
  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return result;
  }
  async listOrders(opts: { status?: string; search?: string; limit?: number; offset?: number } = {}): Promise<{ orders: Order[]; total: number }> {
    const conditions = [];
    if (opts.status) conditions.push(eq(orders.status, opts.status));
    if (opts.search) conditions.push(or(
      like(orders.orderNumber, `%${opts.search}%`),
      like(orders.customerEmail, `%${opts.search}%`),
      like(orders.customerName, `%${opts.search}%`)
    ));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(where);
    const rows = await db.select().from(orders).where(where)
      .orderBy(desc(orders.createdAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0);
    return { orders: rows, total: Number(count) };
  }
  async updateOrderStatus(id: number, status: string, note?: string, updatedBy?: string): Promise<Order> {
    const [current] = await db.select().from(orders).where(eq(orders.id, id));
    const [result] = await db.update(orders)
      .set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    await db.insert(orderStatusHistory).values({
      orderId: id, fromStatus: current.status, toStatus: status,
      note, createdBy: updatedBy ?? "admin"
    });
    return result;
  }
  async updateOrderTracking(id: number, carrier: string, service: string, trackingCode: string): Promise<Order> {
    const [result] = await db.update(orders)
      .set({ shippingCarrier: carrier, shippingService: service, trackingCode, updatedAt: new Date() })
      .where(eq(orders.id, id)).returning();
    return result;
  }
  async updateOrderPayment(id: number, paymentStatus: string, transactionId?: string): Promise<void> {
    await db.update(orders)
      .set({ paymentStatus, paymentTransactionId: transactionId, updatedAt: new Date() })
      .where(eq(orders.id, id));
  }

  async createOrderItems(items: any[]): Promise<void> {
    await db.insert(orderItems).values(items);
  }
  async getOrderItems(orderId: number): Promise<any[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
  async getOrderHistory(orderId: number): Promise<any[]> {
    return db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(asc(orderStatusHistory.createdAt));
  }

  // ─── Payment Transactions ─────────────────────────────────────────────────
  async createPaymentTransaction(data: any): Promise<any> {
    const [result] = await db.insert(paymentTransactions).values(data).returning();
    return result;
  }
  async getPaymentByOrderId(orderId: number): Promise<any> {
    const [result] = await db.select().from(paymentTransactions)
      .where(eq(paymentTransactions.orderId, orderId))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1);
    return result;
  }
  async updatePaymentStatus(gatewayTransactionId: string, status: string): Promise<any> {
    const [result] = await db.update(paymentTransactions)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentTransactions.gatewayTransactionId, gatewayTransactionId))
      .returning();
    return result;
  }

  // ─── Coupons ──────────────────────────────────────────────────────────────
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [result] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return result;
  }
  async listCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }
  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    const [result] = await db.insert(coupons).values(data).returning();
    return result;
  }
  async incrementCouponUsage(id: number): Promise<void> {
    await db.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, id));
  }
  /**
   * Claim ATÔMICO de 1 uso: revalida (ativo, janela de datas, limite, mínimo) e
   * incrementa na MESMA instrução SQL. O row-lock serializa concorrentes e o
   * WHERE é reavaliado após o lock (READ COMMITTED) — na corrida do último uso,
   * só 1 vence. Retorna a linha atualizada, ou null se qualquer condição falhou.
   */
  async claimCouponUsage(code: string, subtotal: number): Promise<Coupon | null> {
    const rows = await db
      .update(coupons)
      .set({ usedCount: sql`${coupons.usedCount} + 1` })
      .where(
        and(
          eq(coupons.code, code.toUpperCase()),
          eq(coupons.active, true),
          or(isNull(coupons.maxUses), sql`${coupons.usedCount} < ${coupons.maxUses}`),
          or(isNull(coupons.startsAt), sql`${coupons.startsAt} <= now()`),
          or(isNull(coupons.expiresAt), sql`${coupons.expiresAt} >= now()`),
          or(isNull(coupons.minOrderValue), sql`${coupons.minOrderValue} <= ${subtotal}`)
        )
      )
      .returning();
    return rows[0] ?? null;
  }
  async updateCoupon(id: number, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const patch: any = { ...data };
    delete patch.usedCount; // nunca pelo admin
    if (patch.code) patch.code = String(patch.code).toUpperCase();
    const [result] = await db.update(coupons).set(patch).where(eq(coupons.id, id)).returning();
    return result;
  }
  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  // ─── Avaliações de produtos ────────────────────────────────────────────────
  async createReview(data: any): Promise<any> {
    const [row] = await db.insert(productReviews).values(data).returning();
    return row;
  }
  /** Reviews aprovadas (nunca devolve authorEmail). */
  async listApprovedReviews(productId: number, limit = 10, offset = 0): Promise<any[]> {
    return db.select({
      id: productReviews.id, rating: productReviews.rating, authorName: productReviews.authorName,
      title: productReviews.title, comment: productReviews.comment,
      verifiedPurchase: productReviews.verifiedPurchase, adminReply: productReviews.adminReply,
      createdAt: productReviews.createdAt,
    }).from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved")))
      .orderBy(desc(productReviews.createdAt)).limit(limit).offset(offset);
  }
  async getReviewAggregate(productId: number): Promise<{ count: number; average: number; distribution: Record<number, number> }> {
    const rows = await db.select({ rating: productReviews.rating }).from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved")));
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of rows) { if (r.rating >= 1 && r.rating <= 5) distribution[r.rating] += 1; sum += r.rating; }
    const count = rows.length;
    return { count, average: count ? Math.round((sum / count) * 10) / 10 : 0, distribution };
  }
  async listReviewsAdmin(status?: string, limit = 100, offset = 0): Promise<any[]> {
    const where = status ? eq(productReviews.status, status) : undefined;
    return db.select().from(productReviews).where(where as any)
      .orderBy(desc(productReviews.createdAt)).limit(limit).offset(offset);
  }
  async countPendingReviews(): Promise<number> {
    const [r] = await db.select({ n: sql<number>`count(*)` }).from(productReviews)
      .where(eq(productReviews.status, "pending"));
    return Number(r?.n ?? 0);
  }
  private async recalcRatingTx(trx: any, productId: number): Promise<void> {
    // Serializa moderações concorrentes do mesmo produto.
    await trx.execute(sql`SELECT id FROM ${products} WHERE ${products.id} = ${productId} FOR UPDATE`);
    const rows = await trx.select({ rating: productReviews.rating }).from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved")));
    const count = rows.length;
    const avg = count ? rows.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / count : 0;
    await trx.update(products).set({ ratingAvg: avg.toFixed(1), ratingCount: count })
      .where(eq(products.id, productId));
  }
  async createReviewApproved(data: any): Promise<any> {
    return db.transaction(async (trx) => {
      const [row] = await trx.insert(productReviews).values({ ...data, status: "approved" }).returning();
      await this.recalcRatingTx(trx, row.productId);
      return row;
    });
  }
  async moderateReview(id: number, patch: { status: string; adminReply?: string }, moderatedBy: string): Promise<any> {
    return db.transaction(async (trx) => {
      const [updated] = await trx.update(productReviews).set({
        status: patch.status, adminReply: patch.adminReply ?? undefined,
        moderatedAt: new Date(), moderatedBy,
      }).where(eq(productReviews.id, id)).returning();
      if (!updated) return null;
      await this.recalcRatingTx(trx, updated.productId);
      return updated;
    });
  }
  async deleteReview(id: number): Promise<any> {
    return db.transaction(async (trx) => {
      const [row] = await trx.delete(productReviews).where(eq(productReviews.id, id)).returning();
      if (row) await this.recalcRatingTx(trx, row.productId);
      return row ?? null;
    });
  }
  /** Confere se o e-mail comprou aquele produto naquele pedido. */
  async verifyPurchase(orderNumber: string, email: string, productId: number): Promise<boolean> {
    const rows = await db.select({ id: orders.id }).from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(
        eq(orders.orderNumber, orderNumber),
        sql`lower(${orders.customerEmail}) = lower(${email})`,
        eq(orderItems.productId, productId),
      )).limit(1);
    return rows.length > 0;
  }

  // ─── Cross-sell / Kits ─────────────────────────────────────────────────────
  private async bundleComponents(bundleId: number): Promise<any[]> {
    const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundleId));
    if (!items.length) return [];
    const prods = await db.select().from(products).where(inArray(products.id, items.map((i) => i.productId)));
    const byId = new Map(prods.map((p) => [p.id, p]));
    const varIds = items.filter((i) => i.variantId).map((i) => i.variantId as number);
    const varById = new Map<number, any>();
    if (varIds.length) {
      const vs = await db.select().from(variants).where(inArray(variants.id, varIds));
      vs.forEach((v) => varById.set(v.id, v));
    }
    return items.map((it) => {
      const p = byId.get(it.productId);
      if (!p) return { productId: it.productId, variantId: it.variantId ?? null, productSlug: "", productTitle: "(indisponível)", image: null, active: false, unitPrice: 0, quantity: it.quantity };
      const v = it.variantId ? varById.get(it.variantId) : null;
      const active = p.status === "active" && p.published && (!it.variantId || (v && v.active));
      return {
        productId: p.id, variantId: it.variantId ?? null, productSlug: p.slug, productTitle: p.title,
        image: null, active: !!active, unitPrice: Number(v ? v.price : p.price), quantity: it.quantity,
      };
    });
  }
  private async enrichBundle(b: any) { return { ...b, components: await this.bundleComponents(b.id) }; }

  async listActiveBundles(): Promise<any[]> {
    const rows = await db.select().from(bundles).where(eq(bundles.active, true)).orderBy(bundles.sortOrder);
    const enriched = await Promise.all(rows.map((b) => this.enrichBundle(b)));
    return enriched.filter((b) => b.components.length > 0 && b.components.every((c: any) => c.active));
  }
  async listAllBundlesAdmin(): Promise<any[]> {
    const rows = await db.select().from(bundles).orderBy(desc(bundles.createdAt));
    return Promise.all(rows.map((b) => this.enrichBundle(b)));
  }
  async getBundleBySlug(slug: string): Promise<any> {
    const [b] = await db.select().from(bundles).where(eq(bundles.slug, slug));
    return b ? this.enrichBundle(b) : null;
  }
  async listBundlesForProduct(productId: number): Promise<any[]> {
    const links = await db.select({ bundleId: bundleItems.bundleId }).from(bundleItems).where(eq(bundleItems.productId, productId));
    if (!links.length) return [];
    const ids = Array.from(new Set(links.map((l) => l.bundleId)));
    const rows = await db.select().from(bundles).where(and(inArray(bundles.id, ids), eq(bundles.active, true)));
    const enriched = await Promise.all(rows.map((b) => this.enrichBundle(b)));
    return enriched.filter((b) => b.components.length > 0 && b.components.every((c: any) => c.active));
  }
  async createBundleWithItems(data: any, items: Array<{ productId: number; variantId?: number | null; quantity: number }>): Promise<any> {
    return db.transaction(async (trx) => {
      const [b] = await trx.insert(bundles).values(data).returning();
      if (items.length) await trx.insert(bundleItems).values(items.map((it) => ({ bundleId: b.id, productId: it.productId, variantId: it.variantId ?? null, quantity: it.quantity })));
      return b;
    });
  }
  async updateBundleWithItems(id: number, data: any, items?: Array<{ productId: number; variantId?: number | null; quantity: number }>): Promise<any> {
    return db.transaction(async (trx) => {
      const [b] = await trx.update(bundles).set({ ...data, updatedAt: new Date() }).where(eq(bundles.id, id)).returning();
      if (!b) return null;
      if (items) {
        await trx.delete(bundleItems).where(eq(bundleItems.bundleId, id));
        if (items.length) await trx.insert(bundleItems).values(items.map((it) => ({ bundleId: id, productId: it.productId, variantId: it.variantId ?? null, quantity: it.quantity })));
      }
      return b;
    });
  }
  async deleteBundle(id: number): Promise<any> {
    return db.transaction(async (trx) => {
      await trx.delete(bundleItems).where(eq(bundleItems.bundleId, id));
      const [b] = await trx.delete(bundles).where(eq(bundles.id, id)).returning();
      return b ?? null;
    });
  }
  async getRelatedProducts(productId: number): Promise<any[]> {
    const links = await db.select().from(productRelations).where(eq(productRelations.productId, productId)).orderBy(productRelations.sortOrder);
    if (!links.length) return [];
    const ids = links.map((l) => l.relatedProductId);
    const prods = await db.select().from(products).where(
      and(inArray(products.id, ids), eq(products.status, "active"), eq(products.published, true))
    );
    const byId = new Map(prods.map((p) => [p.id, p]));
    return links.map((l) => byId.get(l.relatedProductId)).filter(Boolean);
  }
  async setRelatedProducts(productId: number, relatedIds: number[]): Promise<void> {
    await db.transaction(async (trx) => {
      await trx.delete(productRelations).where(eq(productRelations.productId, productId));
      const clean = relatedIds.filter((id) => id !== productId);
      if (clean.length) await trx.insert(productRelations).values(clean.map((rid, i) => ({ productId, relatedProductId: rid, sortOrder: i })));
    });
  }

  /**
   * Expande um kit em cart_items com preços JÁ descontados (pro-rata) e um
   * bundleGroupId comum. Preço vem do catálogo — nunca do cliente. Rejeita se o
   * kit estiver inativo ou tiver componente indisponível.
   */
  async addBundleToCart(sessionId: string, slug: string, quantity: number): Promise<{ ok: boolean; error?: string }> {
    const bundle = await this.getBundleBySlug(slug);
    if (!bundle || !bundle.active) return { ok: false, error: "Kit indisponível" };
    if (bundle.components.length === 0 || bundle.components.some((c: any) => !c.active)) return { ok: false, error: "Kit indisponível" };
    const qty = Math.max(1, Math.min(20, quantity));
    const pricing = priceBundle(
      bundle.discountType as BundleDiscountType,
      Number(bundle.discountValue),
      bundle.components.map((c: any) => ({ productSlug: c.productSlug, unitPrice: c.unitPrice, quantity: c.quantity }))
    );
    const cart = await this.getOrCreateCart(sessionId);
    const groupId = randomUUID();
    for (let i = 0; i < pricing.components.length; i++) {
      const comp = pricing.components[i];
      const src = bundle.components[i];
      await db.insert(cartItems).values({
        cartId: cart.id, productId: src.productId, variantId: src.variantId ?? null,
        quantity: comp.quantity * qty, unitPrice: comp.unitPrice.toFixed(2),
        bundleGroupId: groupId, bundleLabel: bundle.name,
      });
    }
    await db.update(cartSessions).set({ updatedAt: new Date() }).where(eq(cartSessions.id, cart.id));
    return { ok: true };
  }

  // ─── Assinaturas ──────────────────────────────────────────────────────────
  async createSubscriptionRow(data: InsertSubscription): Promise<Subscription> {
    const [result] = await db.insert(subscriptions).values(data).returning();
    return result;
  }
  async getSubscriptionByGatewayId(gatewaySubscriptionId: string): Promise<Subscription | undefined> {
    const [result] = await db.select().from(subscriptions)
      .where(eq(subscriptions.gatewaySubscriptionId, gatewaySubscriptionId));
    return result;
  }
  async updateSubscriptionRow(id: number, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [result] = await db.update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id)).returning();
    return result;
  }
  async listSubscriptionsAdmin(): Promise<Subscription[]> {
    return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
  }

  /**
   * Materializa um pedido a partir de uma assinatura para o ciclo cobrado.
   * IDEMPOTENTE: o número do pedido é derivado do id do pagamento do ciclo
   * (`SUB-<paymentId>`), e o índice único de order_number faz o onConflictDoNothing
   * garantir exatamente-um-pedido mesmo com entregas duplicadas do webhook.
   * Pedido + itens + histórico são gravados numa única transação (atomicidade).
   * Retorna { order, created }: created=false quando o ciclo já fora materializado.
   */
  async materializeSubscriptionOrder(
    sub: Subscription,
    paymentId: string,
    paymentMethod: string
  ): Promise<{ order: Order | null; created: boolean }> {
    const items = (sub.itemsSnapshot as any[]) ?? [];
    const subtotal = items.reduce((s, it) => s + Number(it.totalPrice), 0);
    const orderNumber = `SUB-${paymentId}`;
    return db.transaction(async (trx) => {
      const [order] = await trx.insert(orders).values({
        orderNumber,
        customerName: sub.customerName,
        customerEmail: sub.customerEmail ?? "",
        customerPhone: sub.customerPhone,
        customerCpf: sub.customerCpf,
        shippingRecipient: sub.shippingRecipient,
        shippingCep: sub.shippingCep,
        shippingLogradouro: sub.shippingLogradouro,
        shippingNumero: sub.shippingNumero,
        shippingComplemento: sub.shippingComplemento,
        shippingBairro: sub.shippingBairro,
        shippingCidade: sub.shippingCidade,
        shippingEstado: sub.shippingEstado,
        subtotal: subtotal.toFixed(2),
        discountAmount: "0",
        shippingAmount: sub.shippingAmount,
        total: sub.value,
        status: "confirmed",
        paymentMethod,
        paymentStatus: "approved",
        paymentTransactionId: paymentId,
        shippingService: sub.shippingService,
        notes: `Assinatura ${sub.gatewaySubscriptionId} — ciclo ${sub.cycle}`,
        subscriptionId: sub.id,
      }).onConflictDoNothing({ target: orders.orderNumber }).returning();

      if (!order) return { order: null, created: false }; // ciclo já materializado

      if (items.length) {
        await trx.insert(orderItems).values(items.map((it) => ({
          orderId: order.id,
          productId: it.productId ?? null,
          variantId: it.variantId ?? null,
          productTitle: it.productTitle,
          variantTitle: it.variantTitle ?? null,
          sku: it.sku ?? null,
          quantity: it.quantity,
          unitPrice: String(it.unitPrice),
          totalPrice: String(it.totalPrice),
          imageUrl: it.imageUrl ?? null,
        })));
        // Baixa de estoque na MESMA transação (paridade com o checkout avulso).
        for (const it of items) {
          if (it.productId) {
            await trx.update(products)
              .set({ stockQuantity: sql`${products.stockQuantity} - ${it.quantity}` })
              .where(eq(products.id, it.productId));
          }
        }
      }
      await trx.insert(orderStatusHistory).values({
        orderId: order.id, fromStatus: null, toStatus: "confirmed",
        note: `Pedido gerado pela assinatura ${sub.gatewaySubscriptionId}`, createdBy: "system",
      });
      return { order, created: true };
    });
  }

  // ─── Shipping ─────────────────────────────────────────────────────────────
  async listShippingZones(): Promise<any[]> {
    return db.select().from(shippingZones).where(eq(shippingZones.active, true));
  }
  async getShippingRates(zoneId: number): Promise<any[]> {
    return db.select().from(shippingRates)
      .where(and(eq(shippingRates.zoneId, zoneId), eq(shippingRates.active, true)));
  }

  // ─── Dashboard Stats ──────────────────────────────────────────────────────
  async getDashboardStats(): Promise<any> {
    const today = new Date(); today.setHours(0,0,0,0);
    const [todayRevenue] = await db.select({
      revenue: sql<number>`COALESCE(SUM(total::numeric), 0)`,
      count: sql<number>`count(*)`
    }).from(orders)
      .where(and(sql`created_at >= ${today}`, eq(orders.paymentStatus, "approved")));

    const [totalRevenue] = await db.select({
      revenue: sql<number>`COALESCE(SUM(total::numeric), 0)`,
      count: sql<number>`count(*)`
    }).from(orders).where(eq(orders.paymentStatus, "approved"));

    const [pendingOrders] = await db.select({ count: sql<number>`count(*)` })
      .from(orders).where(eq(orders.status, "pending_payment"));

    const [totalCustomers] = await db.select({ count: sql<number>`count(*)` }).from(customers);

    const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(10);

    return {
      todayRevenue: Number(todayRevenue.revenue),
      todayOrders: Number(todayRevenue.count),
      totalRevenue: Number(totalRevenue.revenue),
      totalOrders: Number(totalRevenue.count),
      pendingOrders: Number(pendingOrders.count),
      totalCustomers: Number(totalCustomers.count),
      recentOrders,
    };
  }
}

export const storage = new DatabaseStorage();
