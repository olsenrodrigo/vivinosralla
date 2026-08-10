import express from "express";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";
import { storage, parseProductSort } from "./storage";
import { insertContactMessageSchema, checkoutSchema, ANALYTICS_CONFIG_KEYS } from "@shared/schema";
import { descontoPix } from "@shared/pagamento";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { sendContactEmail } from "./email";
import { hashPassword, comparePassword, signToken, requireAdmin, requireRole, checkRateLimit, recordFailedAttempt, resetAttempts, storeOtp, verifyOtp, signOtpToken, verifyOtpToken } from "./auth";
import { createPayment, getPaymentStatus, generateOrderNumber } from "./payment";
import { asaasGateway } from "./gateway/asaas";
import {
  loadConfig as loadAsaasConfig, isValidWebhookToken, parseWebhookEvent,
  ensureCustomer, createSubscription, cancelSubscription, listSubscriptionPayments, getPixQrCode,
} from "./asaas";
import { loadConfig as loadMpConfig, validateWebhookSignature as validateMpWebhook } from "./mercadopago";
import { sendOrderConfirmationEmail, sendShippingEmail } from "./notify";
import { registerShippingRoutes, createLabelForOrder } from "./smartenvios-integration";
import { resolvePaymentConfig, methodConfig } from "./gateway/payment-config";

// ─── Saneamento de query params públicos ─────────────────────────────────────

/**
 * Limpa texto vindo da query string antes de chegar ao banco.
 * O byte nulo (%00) faz o Postgres rejeitar a query inteira
 * ("invalid byte sequence for encoding UTF8"), derrubando a request com 500.
 */
function limparTexto(valor: unknown, maxLen = 200): string {
  if (typeof valor !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return valor.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLen);
}

/** Maior inteiro que cabe num INTEGER do Postgres. */
const INT4_MAX = 2_147_483_647;

/**
 * Inteiro utilizável dentro de [min, max]. Lixo e valores abaixo do mínimo caem
 * no padrão (page=-1 vira 1, não "a menor página possível"); acima do máximo,
 * satura no teto.
 */
function clampInt(valor: unknown, padrao: number, min: number, max: number): number {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n) || n < min) return padrao;
  return Math.min(n, max);
}

/** Id vindo da URL: precisa ser inteiro positivo e caber no INTEGER do Postgres. */
function idValido(valor: unknown): number | undefined {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 && n <= INT4_MAX ? n : undefined;
}

/** "cliente@dominio.com" → "cl•••@dominio.com" (LGPD: minimiza o que é exposto). */
function mascararEmail(email: unknown): string | null {
  if (typeof email !== "string" || !email.includes("@")) return null;
  const [usuario, dominio] = email.split("@");
  const visivel = usuario.slice(0, 2);
  return `${visivel}${"•".repeat(Math.max(1, usuario.length - 2))}@${dominio}`;
}

/**
 * Resposta de GET /api/orders/:numero — rota PÚBLICA, sem sessão.
 *
 * Montada por allowlist, não por remoção de campos: com remoção, toda coluna
 * nova de `orders` passa a vazar por default. Campo novo que precise ser
 * público entra aqui à mão, de propósito.
 *
 * INV-B do CLAUDE.md veta endereço nesta rota. Cidade/UF ficam porque dão
 * contexto de entrega sem identificar; CEP, logradouro, número e bairro saem
 * (Monte Alto é cidade pequena — bairro praticamente identifica). A cliente já
 * tem o endereço completo: acabou de digitá-lo, e ele vai no e-mail.
 * `notes` e `internalNotes` saem por serem texto livre da operação.
 */
function pedidoPublico(order: any, items: any[], history: any[], payment: any) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    // Só o primeiro nome: é o que a tela usa na saudação.
    customerName: (order.customerName ?? "").split(/\s+/)[0] || null,
    customerEmail: mascararEmail(order.customerEmail),
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    shippingAmount: order.shippingAmount,
    total: order.total,
    couponCode: order.couponCode,
    shippingCidade: order.shippingCidade,
    shippingEstado: order.shippingEstado,
    shippingCarrier: order.shippingCarrier,
    shippingService: order.shippingService,
    trackingCode: order.trackingCode,
    items: items.map((i) => ({
      id: i.id,
      productTitle: i.productTitle,
      variantTitle: i.variantTitle,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      imageUrl: i.imageUrl,
      bundleLabel: i.bundleLabel,
    })),
    // Sem `note` nem `createdBy`: nota de admin pode ter conteúdo interno.
    history: history.map((h) => ({ toStatus: h.toStatus, createdAt: h.createdAt })),
    // Sem `rawResponse`: é o payload bruto do gateway.
    payment: payment
      ? {
          method: payment.method,
          status: payment.status,
          pixQrCode: payment.pixQrCode,
          pixQrCodeBase64: payment.pixQrCodeBase64,
          pixExpiration: payment.pixExpiration,
          boletoUrl: payment.boletoUrl,
          boletoBarcode: payment.boletoBarcode,
        }
      : null,
  };
}

// Limite de consulta pública de pedido: 20 por minuto por IP.
const consultasPedido = new Map<string, { n: number; expiraEm: number }>();
setInterval(() => {
  const agora = Date.now();
  consultasPedido.forEach((v, k) => { if (agora > v.expiraEm) consultasPedido.delete(k); });
}, 5 * 60_000).unref();

function consultaPedidoLimitada(ip: string): boolean {
  const agora = Date.now();
  const atual = consultasPedido.get(ip);
  if (!atual || agora > atual.expiraEm) {
    consultasPedido.set(ip, { n: 1, expiraEm: agora + 60_000 });
    return false;
  }
  atual.n += 1;
  return atual.n > 20;
}

// ─── Multer config ───────────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads");
const productsDir = path.join(uploadsDir, "products");
[uploadsDir, productsDir, path.join(uploadsDir, "imports")].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(uploadsDir, "imports")),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const uploadCsv = multer({ storage: csvStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Seed: cria um admin padrão no primeiro boot (se ainda não existir nenhum).
  // Personalize com ADMIN_EMAIL / ADMIN_PASSWORD no .env.
  (async () => {
    try {
      const admins = await storage.listAdminUsers();
      if (admins.length === 0) {
        // Sem senha no .env não se cria admin: o fork trazia credencial padrão
        // (herdada de outro cliente), o que deixaria a loja com admin previsível.
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        if (!email || !password) {
          console.warn(
            "[seed] admin não criado: defina ADMIN_EMAIL e ADMIN_PASSWORD no .env " +
            "e reinicie, ou use a rota de primeiro acesso em /admin/login."
          );
          return;
        }
        await storage.createAdminUser({
          name: "Administrador",
          email,
          passwordHash: hashPassword(password),
          role: "admin",
          active: true,
          mustChangePassword: false,
        });
        console.log(`[seed] admin padrão criado: ${email}`);
      }
    } catch (e) {
      console.warn("[seed] admin não criado (banco pode não estar pronto):", (e as Error).message);
    }
  })();

  // Serve uploaded files
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    next();
  }, express.static(uploadsDir));

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC ROUTES
  // ──────────────────────────────────────────────────────────────────────────

  // Contact form (original)
  app.post("/api/contact", async (req, res) => {
    const result = insertContactMessageSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: fromError(result.error).toString() });
    }
    const message = await storage.createContactMessage(result.data);
    try { await sendContactEmail(result.data); } catch (err) { console.error(err); }
    return res.status(201).json({ success: true, id: message.id });
  });

  // Store settings (public)
  app.get("/api/store/settings", async (_req, res) => {
    const s = await storage.getStoreSettings();
    // never expose secrets to public
    if (s) {
      const { mercadoPagoToken, smtpPass, whatsappToken, ...safe } = s as any;
      return res.json(safe);
    }
    return res.json({ storeName: "Loja Virtual", primaryColor: "#5B8C9B" });
  });

  // Config pública de formas de pagamento (métodos aceitos + gateway/modo do cartão)
  app.get("/api/payment/config", async (_req, res) => {
    const s = await storage.getStoreSettings();
    const cfg = resolvePaymentConfig(s);
    return res.json({
      pix: { enabled: cfg.pix.enabled, gateway: cfg.pix.gateway },
      boleto: { enabled: cfg.boleto.enabled, gateway: cfg.boleto.gateway },
      credit_card: {
        enabled: cfg.credit_card.enabled,
        gateway: cfg.credit_card.gateway,
        mode: cfg.credit_card.mode ?? "embedded",
      },
      // public key do MP para tokenizar cartão embutido no front (não é segredo)
      mercadoPagoPublicKey: s?.mercadoPagoPublicKey || process.env.MP_PUBLIC_KEY || null,
    });
  });

  // Categories (public)
  app.get("/api/store/categories", async (_req, res) => {
    const cats = await storage.listCategories(true);
    return res.json(cats);
  });

  // Featured products (public)
  app.get("/api/store/featured", async (_req, res) => {
    const { products: prods } = await storage.listProducts({ status: "active", published: true, featured: true, limit: 8, offset: 0 });
    const porProduto = await storage.getImagesForProducts(prods.map(p => p.id));
    const enriched = prods.map(p => {
      const imgs = porProduto.get(p.id) ?? [];
      return { ...p, mainImage: imgs.find(i => i.isMain)?.url || imgs[0]?.url || null };
    });
    return res.json(enriched);
  });

  // Opções de filtro da vitrine (tamanhos, cores, faixa de preço)
  app.get("/api/store/filters", async (req, res) => {
    const categoryId = idValido(req.query.category_id);
    res.set("Cache-Control", "public, max-age=120");
    return res.json(await storage.listFilterFacets(categoryId));
  });

  // Products (public)
  app.get("/api/store/products", async (req, res) => {
    const { category, search, limit = "24", page = "1", featured } = req.query as any;
    // Página e limite precisam ser inteiros positivos: `page=-5` gerava OFFSET
    // negativo e o Postgres derrubava a requisição com 500.
    const lim = clampInt(limit, 24, 1, 100);
    const pg = clampInt(page, 1, 1, 100_000);
    const off = (pg - 1) * lim;
    // CSV → array, ex.: ?size=P,M&color=Oliva,Preto
    const csv = (v: unknown) =>
      typeof v === "string"
        ? v.split(",").map(s => limparTexto(s)).filter(Boolean)
        : undefined;
    const num = (v: unknown) => {
      const n = Number(v);
      return typeof v === "string" && v !== "" && Number.isFinite(n) ? n : undefined;
    };
    const { products: prods, total } = await storage.listProducts({
      categoryId: idValido(category),
      status: "active", published: true,
      featured: featured === "true" ? true : undefined,
      search: limparTexto(search) || undefined, limit: lim, offset: off,
      sizes: csv(req.query.size),
      colors: csv(req.query.color),
      minPrice: num(req.query.min_price),
      maxPrice: num(req.query.max_price),
      sort: parseProductSort(req.query.sort),
    });
    // attach main image + as 2 primeiras (o card usa a segunda no hover)
    const porProduto = await storage.getImagesForProducts(prods.map(p => p.id));
    const enriched = prods.map(p => {
      const imgs = porProduto.get(p.id) ?? [];
      return {
        ...p,
        mainImage: imgs.find(i => i.isMain)?.url || imgs[0]?.url || null,
        images: imgs.slice(0, 2),
      };
    });
    return res.json({ products: enriched, total, page: Number(page), pages: Math.ceil(total / lim) });
  });

  app.get("/api/store/products/:slug", async (req, res) => {
    const product = await storage.getPublicProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    const [images, variantList] = await Promise.all([
      storage.getProductImages(product.id),
      storage.getVariantsByProduct(product.id),
    ]);
    return res.json({ ...product, images, variants: variantList });
  });

  // ─── Avaliações de produtos ────────────────────────────────────────────────
  const reviewHits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    reviewHits.forEach((v, k) => { if (now > v.resetAt) reviewHits.delete(k); });
  }, 5 * 60_000).unref();
  const reviewRateLimited = (ip: string) => {
    const now = Date.now();
    const cur = reviewHits.get(ip);
    if (!cur || now > cur.resetAt) { reviewHits.set(ip, { count: 1, resetAt: now + 60_000 }); return false; }
    cur.count += 1;
    return cur.count > 5;
  };
  const reviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    authorName: z.string().min(1).max(80),
    title: z.string().max(120).nullable().optional(),
    comment: z.string().max(2000).nullable().optional(),
    authorEmail: z.string().email().max(160).nullable().optional(),
    orderNumber: z.string().max(40).nullable().optional(),
    website: z.string().max(200).optional(), // honeypot
  });

  app.get("/api/store/products/:slug/reviews", async (req, res) => {
    const product = await storage.getPublicProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    const page = Math.max(1, Number(req.query.page) || 1);
    const [reviews, aggregate, settings] = await Promise.all([
      storage.listApprovedReviews(product.id, 10, (page - 1) * 10),
      storage.getReviewAggregate(product.id),
      storage.getStoreSettings(),
    ]);
    return res.json({ aggregate, reviews, page, reviewsEnabled: (settings as any)?.reviewsEnabled !== false });
  });

  app.post("/api/store/products/:slug/reviews", async (req, res) => {
    const settings = await storage.getStoreSettings();
    if ((settings as any)?.reviewsEnabled === false) return res.status(403).json({ message: "Avaliações desativadas" });
    const product = await storage.getPublicProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
    const input = parsed.data;
    if (input.website) return res.json({ ok: true }); // honeypot
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (reviewRateLimited(ip)) return res.status(429).json({ message: "Muitas avaliações, tente mais tarde" });

    let verified = false;
    if (input.orderNumber && input.authorEmail) {
      verified = await storage.verifyPurchase(input.orderNumber, input.authorEmail, product.id);
    }
    const requireModeration = (settings as any)?.reviewsRequireModeration !== false;
    const payload = {
      productId: product.id, rating: input.rating, authorName: input.authorName,
      authorEmail: input.authorEmail ?? null, title: input.title ?? null,
      comment: input.comment ?? null, verifiedPurchase: verified,
    };
    if (requireModeration) await storage.createReview({ ...payload, status: "pending" });
    else await storage.createReviewApproved(payload);
    return res.json({ ok: true, status: requireModeration ? "pending" : "approved", verifiedPurchase: verified });
  });

  // ─── Kits (compre junto) ───────────────────────────────────────────────────
  app.get("/api/store/bundles", async (_req, res) => {
    res.set("Cache-Control", "public, max-age=120");
    return res.json(await storage.listActiveBundles());
  });
  app.get("/api/store/products/:slug/related", async (req, res) => {
    const product = await storage.getPublicProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    const [related, bundles] = await Promise.all([
      storage.getRelatedProducts(product.id),
      storage.listBundlesForProduct(product.id),
    ]);
    // O card de produto precisa da imagem principal
    const porProduto = await storage.getImagesForProducts(related.map((p: any) => p.id));
    const relatedComImagem = related.map((p: any) => {
      const imgs = porProduto.get(p.id) ?? [];
      return { ...p, mainImage: imgs.find(i => i.isMain)?.url || imgs[0]?.url || null };
    });
    return res.json({ related: relatedComImagem, bundles });
  });

  // Cart
  app.get("/api/cart/:sessionId", async (req, res) => {
    const cart = await storage.getOrCreateCart(req.params.sessionId);
    return res.json(cart);
  });

  // Adiciona um kit ao carrinho (expande em itens com preço já descontado).
  app.post("/api/cart/:sessionId/add-bundle", async (req, res) => {
    const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
    const quantity = Number(req.body?.quantity) || 1;
    if (!slug) return res.status(400).json({ message: "Kit inválido" });
    const result = await storage.addBundleToCart(req.params.sessionId, slug, quantity);
    if (!result.ok) return res.status(422).json({ message: result.error });
    const cart = await storage.getOrCreateCart(req.params.sessionId);
    return res.json(cart);
  });

  app.post("/api/cart/:sessionId/add", async (req, res) => {
    const { productId, variantId, quantity } = req.body;
    const product = await storage.getProductById(Number(productId));
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });

    // Quantidade sempre positiva: sem clamp, `quantity: -10` zerava/negativava o
    // item já no carrinho e levaria subtotal negativo para o checkout.
    const qtd = clampInt(quantity, 1, 1, 99);

    // A variante precisa ser DESTE produto — senão o pedido registra a grade
    // (tamanho/cor) de outra peça.
    let variante = null;
    if (variantId != null) {
      const doProduto = await storage.getVariantsByProduct(product.id);
      variante = doProduto.find(v => v.id === Number(variantId)) ?? null;
      if (!variante) return res.status(400).json({ message: "Variante inválida para este produto" });
    }

    await storage.addToCart(
      req.params.sessionId, product.id, variante?.id ?? null, qtd,
      String(variante?.price ?? product.price)
    );
    const cart = await storage.getOrCreateCart(req.params.sessionId);
    return res.json(cart);
  });

  /**
   * O itemId é SERIAL e portanto enumerável. A rota antiga
   * (`PUT /api/cart/item/:itemId`) não checava dono, então qualquer um alterava
   * ou esvaziava o carrinho de outra pessoa. Agora o item precisa pertencer ao
   * carrinho da sessão informada.
   */
  app.put("/api/cart/:sessionId/item/:itemId", async (req, res) => {
    const cart = await storage.getOrCreateCart(req.params.sessionId);
    const itemId = Number(req.params.itemId);
    const item = cart.items.find((i: any) => i.id === itemId);
    if (!item) return res.status(404).json({ message: "Item não encontrado neste carrinho" });

    // 0 remove o item; acima disso, quantidade positiva com teto.
    const bruto = Number(req.body?.quantity);
    const qtd = Number.isFinite(bruto) && bruto <= 0 ? 0 : clampInt(bruto, 1, 1, 99);
    await storage.updateCartItem(itemId, qtd);
    return res.json(await storage.getOrCreateCart(req.params.sessionId));
  });

  app.delete("/api/cart/:sessionId", async (req, res) => {
    await storage.clearCart(req.params.sessionId);
    return res.json({ success: true });
  });

  // ─── Recuperação de carrinho abandonado (captura consent-gated) ─────────────
  const cartHits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    cartHits.forEach((v, k) => { if (now > v.resetAt) cartHits.delete(k); });
  }, 5 * 60_000).unref();
  const cartRateLimited = (ip: string) => {
    const now = Date.now();
    const cur = cartHits.get(ip);
    if (!cur || now > cur.resetAt) { cartHits.set(ip, { count: 1, resetAt: now + 60_000 }); return false; }
    cur.count += 1;
    return cur.count > 20;
  };
  const isUuid = (s: string) => z.string().uuid().safeParse(s).success;
  const contactSchema = z.object({
    customerName: z.string().max(120).nullable().optional(),
    customerPhone: z.string().min(8).max(20),
    customerEmail: z.string().email().max(160).nullable().optional(),
    couponCode: z.string().max(40).nullable().optional(),
    consent: z.literal(true), // LGPD: sem consentimento, não grava
  });

  app.post("/api/cart/:sessionId/contact", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (cartRateLimited(ip)) return res.status(429).json({ message: "Muitas requisições" });
    if (!isUuid(req.params.sessionId)) return res.status(400).json({ message: "Sessão inválida" });
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
    await storage.updateCartContact(req.params.sessionId, {
      name: parsed.data.customerName ?? null,
      phone: parsed.data.customerPhone,
      email: parsed.data.customerEmail ?? null,
      couponCode: parsed.data.couponCode ?? null,
    });
    return res.json({ ok: true });
  });

  // Revogação LGPD: o dono do carrinho apaga o próprio contato.
  app.delete("/api/cart/:sessionId/contact", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (cartRateLimited(ip)) return res.status(429).json({ message: "Muitas requisições" });
    if (!isUuid(req.params.sessionId)) return res.status(400).json({ message: "Sessão inválida" });
    await storage.revokeCartContact(req.params.sessionId);
    return res.json({ ok: true });
  });

  // Coupon validation
  app.post("/api/store/coupon/validate", async (req, res) => {
    const { code, orderValue } = req.body;
    const coupon = await storage.getCouponByCode(code);
    if (!coupon || !coupon.active) return res.status(404).json({ message: "Cupom inválido" });
    if (coupon.startsAt && new Date(coupon.startsAt) > new Date())
      return res.status(400).json({ message: "Cupom ainda não está válido" });
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
      return res.status(400).json({ message: "Cupom expirado" });
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
      return res.status(400).json({ message: "Cupom esgotado" });
    if (coupon.minOrderValue && Number(orderValue) < Number(coupon.minOrderValue))
      return res.status(400).json({ message: `Pedido mínimo: R$ ${Number(coupon.minOrderValue).toFixed(2)}` });

    let discount = 0;
    if (coupon.type === "percentage") discount = Number(orderValue) * Number(coupon.value) / 100;
    else if (coupon.type === "fixed") discount = Number(coupon.value);
    return res.json({ valid: true, discount: Math.min(discount, Number(orderValue)), coupon });
  });

  // Checkout
  app.post("/api/checkout", async (req, res) => {
    const result = checkoutSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: fromError(result.error).toString() });
    }
    const data = result.data;

    // Get cart
    const cart = await storage.getOrCreateCart(data.sessionId);
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio" });
    }

    // Calculate totals
    let subtotal = cart.items.reduce((sum: number, i: any) =>
      sum + Number(i.unitPrice) * i.quantity, 0);
    let discountAmount = 0;

    let appliedCouponCode: string | null = null;
    if (data.couponCode) {
      // Claim ATÔMICO: revalida (ativo/datas/limite/mínimo) E conta o uso numa
      // única instrução SQL — sem estourar o limite em corrida e sem contar cupom
      // expirado/esgotado. Se inválido no momento do fechamento, ignora o cupom.
      const claimed = await storage.claimCouponUsage(data.couponCode, subtotal);
      if (claimed) {
        appliedCouponCode = claimed.code;
        if (claimed.type === "percentage") discountAmount = (subtotal * Number(claimed.value)) / 100;
        else if (claimed.type === "fixed") discountAmount = Number(claimed.value);
        discountAmount = Math.min(discountAmount, subtotal); // clamp: nunca > subtotal
      }
    }

    const shippingAmount = data.shippingAmount || 0;
    // O site anuncia 5% de desconto no PIX na página do produto e no checkout.
    // Aplicar aqui é o que garante que a cobrança bata com o valor exibido.
    if (data.paymentMethod === "pix") {
      discountAmount += descontoPix(subtotal, discountAmount);
      discountAmount = Math.min(discountAmount, subtotal);
    }
    const total = subtotal - discountAmount + shippingAmount;

    // Canal WhatsApp: cria o pedido sem cobrança online (pagamento negociado no chat).
    const viaWhatsapp = data.channel === "whatsapp";

    // Config de pagamento — valida se o método é aceito ANTES de criar o pedido.
    const settings = await storage.getStoreSettings();
    const payCfg = resolvePaymentConfig(settings);
    const mc = methodConfig(payCfg, data.paymentMethod);
    if (!viaWhatsapp && (!mc || !mc.enabled)) {
      return res.status(400).json({ message: `Forma de pagamento indisponível: ${data.paymentMethod}` });
    }

    // Create order
    const orderNumber = generateOrderNumber();
    const order = await storage.createOrder({
      orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      customerCpf: data.customerCpf,
      shippingRecipient: data.shippingRecipient,
      shippingCep: data.shippingCep,
      shippingLogradouro: data.shippingLogradouro,
      shippingNumero: data.shippingNumero,
      shippingComplemento: data.shippingComplemento,
      shippingBairro: data.shippingBairro,
      shippingCidade: data.shippingCidade,
      shippingEstado: data.shippingEstado,
      subtotal: String(subtotal),
      discountAmount: String(discountAmount),
      shippingAmount: String(shippingAmount),
      total: String(total),
      paymentMethod: data.paymentMethod,
      couponCode: appliedCouponCode,
      shippingCarrier: data.shippingCarrier,
      shippingService: data.shippingService,
      status: "pending_payment",
      paymentStatus: "pending",
    });

    // Create order items + decrement stock
    const orderItemsData = cart.items.map((i: any) => ({
      orderId: order.id,
      productId: i.productId,
      variantId: i.variantId,
      productTitle: i.productTitle,
      // Loja de roupa: sem o rótulo da grade a lojista recebe o pedido sem saber
      // tamanho e cor (só o variantId numérico ficaria gravado).
      variantTitle: i.variantTitle ?? null,
      quantity: i.quantity,
      unitPrice: String(i.unitPrice),
      totalPrice: String(Number(i.unitPrice) * i.quantity),
      imageUrl: i.mainImage,
      bundleLabel: i.bundleLabel ?? null,
    }));
    await storage.createOrderItems(orderItemsData);

    // Decrement stock (produto + grade vendida)
    for (const item of cart.items) {
      await storage.decrementStock(item.productId, item.quantity, item.variantId);
    }

    // Process payment (só no canal online) — roteia pelo gateway configurado.
    let paymentResult: any = { success: true };
    if (!viaWhatsapp) {
    const gatewayId = mc!.gateway;
    if (gatewayId === "asaas") {
      paymentResult = await asaasGateway.createPayment({
        amount: total,
        orderId: order.id,
        orderNumber,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        customerCpf: data.customerCpf,
        method: data.paymentMethod as any,
        description: `Pedido ${orderNumber}`,
        customerPhone: data.customerPhone,
        customerCep: data.shippingCep,
        customerAddressNumber: data.shippingNumero,
        installments: data.cardInstallments,
      }, {});
    } else {
      const mpToken = settings?.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (mpToken) {
        paymentResult = await createPayment({
          amount: total,
          orderId: order.id,
          orderNumber,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          customerCpf: data.customerCpf,
          method: data.paymentMethod as any,
          description: `Pedido ${orderNumber}`,
          cardToken: data.cardToken,
          installments: data.cardInstallments,
        }, mpToken);
      }
    }

    if (!paymentResult.success) {
      console.error(`[checkout] falha no pagamento (${gatewayId}):`, paymentResult.error);
    }

    if (paymentResult.success && paymentResult.transactionId) {
      await storage.createPaymentTransaction({
        orderId: order.id,
        gateway: gatewayId,
        gatewayTransactionId: paymentResult.transactionId,
        method: data.paymentMethod,
        status: paymentResult.status || "pending",
        amount: String(total),
        currency: "BRL",
        pixQrCode: paymentResult.pixQrCode,
        pixQrCodeBase64: paymentResult.pixQrCodeBase64,
        pixExpiration: paymentResult.pixExpiration,
        boletoUrl: paymentResult.boletoUrl,
        boletoBarcode: paymentResult.boletoBarcode,
      });

      if (data.paymentMethod === "credit_card" && paymentResult.status === "approved") {
        await storage.updateOrderStatus(order.id, "confirmed", "Pagamento aprovado automaticamente");
        await storage.updateOrderPayment(order.id, "approved", paymentResult.transactionId);
      }
    }
    } // fim do canal online

    // Marca o carrinho como convertido (recuperação) — só se o telefone bater.
    storage.markCartConverted(data.sessionId, order.id, String(data.customerPhone || "").replace(/\D/g, ""))
      .catch((e) => console.error("[carts] markCartConverted falhou:", e?.message));

    // Clear cart
    await storage.clearCart(data.sessionId);

    // Send confirmation email
    const smtp = getSmtpConfig();
    if (smtp.user && smtp.pass) {
      sendOrderConfirmationEmail({
        orderNumber,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        items: orderItemsData.map((i: any) => ({
          title: i.productTitle, quantity: i.quantity, unitPrice: Number(i.unitPrice)
        })),
        subtotal, discountAmount, shippingAmount, total,
        paymentMethod: data.paymentMethod,
        pixQrCode: paymentResult.pixQrCodeBase64,
        boletoUrl: paymentResult.boletoUrl,
        boletoBarcode: paymentResult.boletoBarcode,
        storeName: settings?.storeName,
        storeEmail: settings?.contactEmail ?? undefined,
      }, smtp).catch(err => console.error("Email error:", err));
    }

    return res.status(201).json({
      success: true,
      orderNumber,
      orderId: order.id,
      total,
      paymentMethod: data.paymentMethod,
      channel: viaWhatsapp ? "whatsapp" : "online",
      gateway: viaWhatsapp ? null : mc?.gateway,
      pixQrCode: paymentResult.pixQrCode,
      pixQrCodeBase64: paymentResult.pixQrCodeBase64,
      boletoUrl: paymentResult.boletoUrl,
      boletoBarcode: paymentResult.boletoBarcode,
      // Checkout hospedado (ex.: cartão via Asaas): o front redireciona pra cá.
      redirectUrl: paymentResult.redirectUrl,
      paymentError: paymentResult.success ? undefined : paymentResult.error,
    });
  });

  // ─── Assinaturas ("assine e receba") ───────────────────────────────────────
  // Cria uma assinatura recorrente no Asaas. Os pedidos de cada ciclo são
  // materializados automaticamente pelo webhook quando o pagamento é confirmado.
  const subscribeSchema = z.object({
    customerName: z.string().min(3),
    customerEmail: z.string().email(), // obrigatório: recibos e integrações de envio
    customerPhone: z.string().min(8),
    customerCpf: z.string().min(11).max(18),
    shippingRecipient: z.string().optional(),
    shippingCep: z.string().min(8),
    shippingLogradouro: z.string().min(1),
    shippingNumero: z.string().min(1),
    shippingComplemento: z.string().nullable().optional(),
    shippingBairro: z.string().min(1),
    shippingCidade: z.string().min(1),
    shippingEstado: z.string().length(2),
    billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]),
    cycle: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"]).default("MONTHLY"),
    shippingAmount: z.union([z.string(), z.number()]).optional(),
    shippingService: z.string().nullable().optional(),
    // Assinatura é por produto simples (sem variante), igual ao PuraFlora.
    items: z.array(z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().max(99),
    })).min(1),
    creditCard: z.object({
      holderName: z.string(), number: z.string(),
      expiryMonth: z.string(), expiryYear: z.string(), ccv: z.string(),
    }).optional(),
    creditCardHolderInfo: z.any().optional(),
  });

  app.post("/api/subscribe", async (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: fromError(parsed.error).toString() });
    }
    const input = parsed.data;
    const cfg = loadAsaasConfig(process.env);
    try {
      // Recalcula itens/valor a partir do catálogo (fonte de verdade)
      const items = [];
      for (const it of input.items) {
        const p = await storage.getProductById(it.productId);
        if (!p || p.status !== "active" || !p.published) {
          return res.status(400).json({ message: `Produto indisponível: ${it.productId}` });
        }
        const unit = Number(p.price);
        items.push({
          productId: p.id,
          variantId: null,
          productTitle: p.title,
          sku: p.sku ?? null,
          quantity: it.quantity,
          unitPrice: unit.toFixed(2),
          totalPrice: (Math.round(unit * it.quantity * 100) / 100).toFixed(2),
          imageUrl: null,
        });
      }
      const subtotal = items.reduce((s, it) => s + Number(it.totalPrice), 0);
      const shippingAmount = Math.max(0, Number(input.shippingAmount ?? 0) || 0);
      const total = Math.round((subtotal + shippingAmount) * 100) / 100;

      const customer = await ensureCustomer(cfg, {
        name: input.customerName,
        cpfCnpj: input.customerCpf,
        email: input.customerEmail ?? undefined,
        mobilePhone: input.customerPhone,
        postalCode: input.shippingCep,
        address: input.shippingLogradouro,
        addressNumber: input.shippingNumero,
        province: input.shippingBairro,
        externalReference: input.customerPhone.replace(/\D/g, ""),
      });

      const isCard = input.billingType === "CREDIT_CARD";
      if (isCard && !input.creditCard) {
        return res.status(400).json({ message: "Dados do cartão são obrigatórios para assinatura no cartão" });
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      const subscription = await createSubscription(cfg, {
        customer: customer.id,
        billingType: input.billingType,
        value: total,
        nextDueDate: todayIso,
        cycle: input.cycle,
        description: `Assinatura — ${items.map((i) => `${i.quantity}x ${i.productTitle}`).join(", ").slice(0, 400)}`,
        ...(isCard
          ? { creditCard: input.creditCard, creditCardHolderInfo: input.creditCardHolderInfo, remoteIp: req.ip || req.socket.remoteAddress || undefined }
          : {}),
      });

      // Snapshot local. Se falhar após a assinatura já existir no Asaas, cancela
      // compensatoriamente para não deixar cobrança recorrente órfã (sem registro
      // local, o webhook ignoraria os ciclos).
      let subRow;
      try {
        subRow = await storage.createSubscriptionRow({
          gatewaySubscriptionId: subscription.id,
          gatewayCustomerId: customer.id,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          customerCpf: input.customerCpf.replace(/\D/g, ""),
          shippingRecipient: input.shippingRecipient ?? input.customerName,
          shippingCep: input.shippingCep,
          shippingLogradouro: input.shippingLogradouro,
          shippingNumero: input.shippingNumero,
          shippingComplemento: input.shippingComplemento ?? null,
          shippingBairro: input.shippingBairro,
          shippingCidade: input.shippingCidade,
          shippingEstado: input.shippingEstado,
          billingType: input.billingType,
          cycle: input.cycle,
          value: total.toFixed(2),
          shippingAmount: shippingAmount.toFixed(2),
          shippingService: input.shippingService ?? null,
          status: "ACTIVE",
          itemsSnapshot: items,
          nextDueDate: subscription.nextDueDate,
        });
      } catch (dbErr: any) {
        try {
          await cancelSubscription(cfg, subscription.id);
          console.error(`[asaas] assinatura ${subscription.id} cancelada (compensação: snapshot local falhou):`, dbErr?.message);
        } catch (cancelErr: any) {
          console.error(`[asaas] ATENÇÃO: assinatura ${subscription.id} órfã — snapshot local E cancelamento falharam:`, cancelErr?.message);
        }
        throw dbErr;
      }

      const response: Record<string, unknown> = {
        mock: cfg.mock,
        subscriptionId: subscription.id,
        localSubscriptionId: subRow.id,
        status: subscription.status,
      };

      // Primeira cobrança do ciclo (PIX/boleto). Falha aqui NÃO invalida a
      // assinatura já criada+persistida — o cliente consegue a cobrança depois
      // (a materialização acontece pelo webhook). Não relançamos.
      try {
        const firstPayments = await listSubscriptionPayments(cfg, subscription.id);
        const first = firstPayments[0];
        if (first) {
          response.firstPaymentId = first.id;
          response.invoiceUrl = first.invoiceUrl;
          if (input.billingType === "PIX") {
            const qr = await getPixQrCode(cfg, first.id);
            response.pix = { encodedImage: qr.encodedImage, payload: qr.payload };
          } else if (input.billingType === "BOLETO") {
            response.boleto = { bankSlipUrl: first.bankSlipUrl };
          }
        }
      } catch (payErr: any) {
        console.error(`[asaas] assinatura ${subscription.id} criada, mas falhou ao obter 1ª cobrança:`, payErr?.message);
      }

      return res.json(response);
    } catch (err: any) {
      const status = err?.status >= 400 && err.status < 500 ? 400 : 500;
      return res.status(status).json({ message: err?.message || "Erro ao criar assinatura" });
    }
  });

  // Rotas de frete/etiqueta (SmartEnvios)
  registerShippingRoutes(app);

  // Payment webhook (MercadoPago)
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    // Valida a assinatura x-signature quando o segredo estiver configurado
    // (retrocompatível: sem MP_WEBHOOK_SECRET, mantém o comportamento anterior).
    const mpCfg = loadMpConfig(process.env);
    if (mpCfg.webhookSecret) {
      const dataId = (req.query["data.id"] as string) || req.body?.data?.id;
      const validSig = validateMpWebhook(mpCfg, {
        xSignature: req.headers["x-signature"] as string | undefined,
        xRequestId: req.headers["x-request-id"] as string | undefined,
        dataId,
      });
      if (!validSig) return res.status(401).json({ error: "Assinatura inválida" });
    }
    const { action, data: wData } = req.body;
    if (action === "payment.updated" && wData?.id) {
      const settings = await storage.getStoreSettings();
      const mpToken = settings?.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (mpToken) {
        const status = await getPaymentStatus(String(wData.id), mpToken);
        const tx = await storage.updatePaymentStatus(String(wData.id), status);
        if (tx && status === "approved") {
          const order = await storage.getOrderById(tx.orderId);
          if (order && order.paymentStatus !== "approved") {
            await storage.updateOrderStatus(tx.orderId, "confirmed", "Pagamento confirmado via webhook");
            await storage.updateOrderPayment(tx.orderId, "approved", String(wData.id));
            // Gera a etiqueta automaticamente (não bloqueia o webhook em caso de erro).
            if (process.env.SMARTENVIOS_AUTO_LABEL === "1" && !order.trackingCode) {
              createLabelForOrder(tx.orderId).catch((e) =>
                console.error("[smartenvios] falha ao gerar etiqueta no webhook:", e?.message)
              );
            }
          }
        }
      }
    }
    return res.status(200).json({ received: true });
  });

  // Payment webhook (Asaas)
  app.post("/api/webhooks/asaas", async (req, res) => {
    const cfg = loadAsaasConfig(process.env);
    const token = req.headers["asaas-access-token"];
    if (!isValidWebhookToken(cfg, typeof token === "string" ? token : undefined)) {
      return res.status(401).json({ error: "Token inválido" });
    }
    const event = parseWebhookEvent(req.body);
    // Responde rápido: a fila do Asaas interrompe após falhas consecutivas.
    res.status(200).json({ received: true });
    const paymentId = event?.payment?.id;
    if (!paymentId) return;
    try {
      const status = await asaasGateway.getPaymentStatus(paymentId, {});
      const tx = await storage.updatePaymentStatus(paymentId, status);
      if (tx && status === "approved") {
        const order = await storage.getOrderById(tx.orderId);
        if (order && order.paymentStatus !== "approved") {
          await storage.updateOrderStatus(tx.orderId, "confirmed", "Pagamento confirmado via webhook (Asaas)");
          await storage.updateOrderPayment(tx.orderId, "approved", paymentId);
          if (process.env.SMARTENVIOS_AUTO_LABEL === "1" && !order.trackingCode) {
            createLabelForOrder(tx.orderId).catch((e) =>
              console.error("[smartenvios] falha ao gerar etiqueta no webhook (Asaas):", e?.message)
            );
          }
        }
      }

      // Cobrança de ASSINATURA: cada ciclo pago materializa um novo pedido.
      // Não há tx prévia (a cobrança recorrente nasce no Asaas), então tratamos
      // à parte, de forma idempotente (SUB-<paymentId> + índice único).
      const subId = event?.payment?.subscription;
      if (subId && status === "approved") {
        const sub = await storage.getSubscriptionByGatewayId(subId);
        if (sub && sub.status !== "CANCELLED") {
          const bt = event?.payment?.billingType;
          const method = bt === "BOLETO" ? "boleto" : bt === "CREDIT_CARD" ? "credit_card" : "pix";
          const { order: subOrder, created } = await storage.materializeSubscriptionOrder(sub, paymentId, method);
          if (created && subOrder) {
            console.log(`[asaas] assinatura ${subId}: pedido ${subOrder.orderNumber} materializado`);
            if (process.env.SMARTENVIOS_AUTO_LABEL === "1") {
              createLabelForOrder(subOrder.id).catch((e) =>
                console.error("[smartenvios] falha ao gerar etiqueta de assinatura:", e?.message)
              );
            }
          }
        }
      }
    } catch (e: any) {
      console.error("[asaas webhook] erro ao processar:", e?.message);
    }
  });

  // Order status (customer)
  /**
   * Consulta pública do pedido (tela de confirmação — a cliente não tem login).
   * Como é pública, NÃO devolve CPF nem telefone, e mascara o e-mail: mesmo que
   * alguém acerte um número de pedido, não colhe dado pessoal utilizável.
   * A rota também é limitada por IP para inviabilizar varredura.
   */
  app.get("/api/orders/:orderNumber", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (consultaPedidoLimitada(ip)) {
      return res.status(429).json({ message: "Muitas consultas. Tente novamente em instantes." });
    }
    const order = await storage.getOrderByNumber(req.params.orderNumber);
    if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
    const [items, history, payment] = await Promise.all([
      storage.getOrderItems(order.id),
      storage.getOrderHistory(order.id),
      storage.getPaymentByOrderId(order.id),
    ]);
    return res.json(pedidoPublico(order, items, history, payment));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ADMIN ROUTES (require auth)
  // ──────────────────────────────────────────────────────────────────────────

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Dados incompletos" });

    const identifier = `login:${email.toLowerCase()}`;
    const rateCheck = checkRateLimit(identifier);
    if (rateCheck.blocked) {
      return res.status(429).json({
        message: `Muitas tentativas. Tente novamente em ${rateCheck.minutesLeft} minuto(s).`
      });
    }

    const admin = await storage.getAdminByEmail(email);
    if (!admin || !admin.active || !comparePassword(password, admin.passwordHash)) {
      recordFailedAttempt(identifier);
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    resetAttempts(identifier);

    // Check if SMTP is configured for MFA
    const settings = await storage.getStoreSettings();
    const smtpConfigured = !!(settings?.smtpHost && settings?.smtpUser && settings?.smtpPass);

    if (smtpConfigured) {
      // Send OTP
      const code = storeOtp(admin.email);
      const otpToken = signOtpToken(admin.email);

      const smtp = {
        host: settings?.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(settings?.smtpPort || process.env.SMTP_PORT) || 587,
        user: settings?.smtpUser || process.env.SMTP_USER || "",
        pass: settings?.smtpPass || process.env.SMTP_PASS || "",
      };

      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: smtp.host, port: smtp.port, secure: false,
          auth: { user: smtp.user, pass: smtp.pass },
        });
        await transporter.sendMail({
          from: `"${settings?.storeName || "Admin"}" <${smtp.user}>`,
          to: admin.email,
          subject: "Código de verificação — Painel Admin",
          html: `
            <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
              <h2 style="color:#1f2937">Código de verificação</h2>
              <p style="color:#6b7280">Olá, ${admin.name}. Use o código abaixo para acessar o painel:</p>
              <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
                <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1f2937">${code}</span>
              </div>
              <p style="color:#9ca3af;font-size:13px">Válido por 5 minutos. Não compartilhe este código.</p>
            </div>`,
        });
      } catch (err) {
        console.error("Falha ao enviar OTP:", err);
        // Fall through — send token without MFA if email fails
        const token = signToken({ id: admin.id, email: admin.email, role: admin.role });
        return res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, mustChangePassword: admin.mustChangePassword } });
      }

      return res.json({ requireOtp: true, otpToken, adminName: admin.name });
    }

    // No SMTP — login directly
    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });
    return res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, mustChangePassword: admin.mustChangePassword } });
  });

  // Verify OTP (MFA second factor)
  app.post("/api/admin/verify-otp", async (req, res) => {
    const { otpToken, code } = req.body;
    if (!otpToken || !code) return res.status(400).json({ message: "Dados incompletos" });

    const payload = verifyOtpToken(otpToken);
    if (!payload) return res.status(401).json({ message: "Sessão expirada. Faça login novamente." });

    if (!verifyOtp(payload.email, code.trim())) {
      return res.status(401).json({ message: "Código inválido ou expirado." });
    }

    const admin = await storage.getAdminByEmail(payload.email);
    if (!admin || !admin.active) return res.status(401).json({ message: "Usuário inativo" });

    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });
    return res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, mustChangePassword: admin.mustChangePassword } });
  });

  // Change password (requires auth — used for mustChangePassword flow AND voluntary change)
  app.post("/api/admin/change-password", requireAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Dados incompletos" });
    if (newPassword.length < 8) return res.status(400).json({ message: "Senha deve ter pelo menos 8 caracteres" });

    const adminPayload = (req as any).admin;
    const admin = await storage.getAdminById(adminPayload.id);
    if (!admin) return res.status(404).json({ message: "Usuário não encontrado" });

    if (!comparePassword(currentPassword, admin.passwordHash)) {
      return res.status(401).json({ message: "Senha atual incorreta" });
    }

    await storage.updateAdminUser(admin.id, {
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
    });

    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });
    return res.json({ success: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, mustChangePassword: false } });
  });

  // Admin setup (first run — create default admin)
  app.post("/api/admin/setup", async (req, res) => {
    const existing = await storage.listAdminUsers();
    if (existing.length > 0) return res.status(403).json({ message: "Sistema já configurado. Acesse com suas credenciais." });

    // Optional: require SETUP_SECRET env var if set
    const setupSecret = process.env.SETUP_SECRET;
    if (setupSecret && req.body.setupSecret !== setupSecret) {
      return res.status(403).json({ message: "Chave de setup inválida" });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Dados incompletos" });
    if (password.length < 8) return res.status(400).json({ message: "Senha deve ter pelo menos 8 caracteres" });

    const admin = await storage.createAdminUser({
      name, email, passwordHash: hashPassword(password), role: "admin", active: true, mustChangePassword: false,
    });
    const token = signToken({ id: admin.id, email: admin.email, role: admin.role });
    return res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  });

  // ─ Admin Users CRUD ────────────────────────────────────────────────────────
  // List users (admin only)
  app.get("/api/admin/users", requireRole("admin"), async (_req, res) => {
    const users = await storage.listAdminUsers();
    return res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  });

  // Create user (admin only)
  app.post("/api/admin/users", requireRole("admin"), async (req, res) => {
    const { name, email, role } = req.body;
    let { password } = req.body;

    if (!name || !email || !role) return res.status(400).json({ message: "Dados incompletos" });
    const allowedRoles = ["admin", "financeiro", "operacao"];
    if (!allowedRoles.includes(role)) return res.status(400).json({ message: "Role inválida" });
    const existing = await storage.getAdminByEmail(email);
    if (existing) return res.status(409).json({ message: "E-mail já cadastrado" });

    let tempPassword: string | undefined;
    if (!password) {
      // Auto-generate secure temp password
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
      tempPassword = Array.from({length: 12}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      password = tempPassword;
    }

    const user = await storage.createAdminUser({
      name, email, passwordHash: hashPassword(password), role, active: true, mustChangePassword: true,
    });

    // Try to send welcome email
    const settings = await storage.getStoreSettings();
    const smtpUser = settings?.smtpUser || process.env.SMTP_USER;
    const smtpPass = settings?.smtpPass || process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: settings?.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(settings?.smtpPort || process.env.SMTP_PORT) || 587,
          secure: false, auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: `"${settings?.storeName || "Admin"}" <${smtpUser}>`,
          to: email,
          subject: `Seu acesso ao painel — ${settings?.storeName || "Loja Virtual"}`,
          html: `
            <div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:24px">
              <h2>Bem-vindo(a), ${name}!</h2>
              <p>Seu acesso ao painel administrativo foi criado.</p>
              <p><strong>E-mail:</strong> ${email}</p>
              <p><strong>Senha temporária:</strong> <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px">${password}</code></p>
              <p style="color:#dc2626;font-size:13px">⚠️ Você será solicitado a trocar a senha no primeiro acesso.</p>
            </div>`,
        });
      } catch (err) { console.error("Falha ao enviar e-mail de boas-vindas:", err); }
    }

    return res.status(201).json({
      ...user,
      passwordHash: undefined,
      tempPassword, // Only present if auto-generated — show ONCE in admin UI
    });
  });

  // Update user (admin only)
  app.put("/api/admin/users/:id", requireRole("admin"), async (req, res) => {
    const { name, email, role, active, password } = req.body;
    const updates: any = { name, email, role, active };
    if (password) updates.passwordHash = hashPassword(password);
    const user = await storage.updateAdminUser(Number(req.params.id), updates);
    return res.json({ ...user, passwordHash: undefined });
  });

  // Delete user (admin only)
  app.delete("/api/admin/users/:id", requireRole("admin"), async (req, res) => {
    const adminPayload = (req as any).admin;
    if (adminPayload.id === Number(req.params.id)) return res.status(400).json({ message: "Não pode excluir o próprio usuário" });
    await storage.deleteAdminUser(Number(req.params.id));
    return res.json({ success: true });
  });

  // Dashboard
  app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    const stats = await storage.getDashboardStats();
    return res.json(stats);
  });

  // Store settings
  app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
    const s = await storage.getStoreSettings();
    return res.json(s || {});
  });
  app.put("/api/admin/settings", requireAdmin, async (req, res) => {
    const body = { ...req.body };
    // analyticsConfig: whitelist explícita das chaves (só IDs públicos + toggle).
    if ("analyticsConfig" in body) {
      const raw = body.analyticsConfig;
      if (raw && typeof raw === "object") {
        const out: Record<string, unknown> = {};
        for (const k of ANALYTICS_CONFIG_KEYS) {
          if (!(k in raw)) continue;
          if (k === "requireConsent") out[k] = raw[k] !== false;
          else out[k] = typeof raw[k] === "string" ? raw[k].trim() : "";
        }
        body.analyticsConfig = out;
      } else {
        body.analyticsConfig = null;
      }
    }
    const s = await storage.upsertStoreSettings(body);
    return res.json(s);
  });

  // Logo upload
  app.post("/api/admin/settings/logo", requireAdmin, upload.single("logo"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });
    const logoUrl = `/uploads/products/${req.file.filename}`;
    const s = await storage.upsertStoreSettings({ logoUrl });
    return res.json({ logoUrl: s.logoUrl });
  });

  // Favicon upload
  app.post("/api/admin/settings/favicon", requireAdmin, upload.single("favicon"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });
    const faviconUrl = `/uploads/products/${req.file.filename}`;
    const s = await storage.upsertStoreSettings({ faviconUrl });
    return res.json({ faviconUrl: s.faviconUrl });
  });

  // ─ Categories admin ───────────────────────────────────────────────────────
  app.get("/api/admin/categories", requireAdmin, async (_req, res) => {
    const cats = await storage.listCategories(false);
    return res.json(cats);
  });
  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    const { name, description, parentId } = req.body;
    if (!name) return res.status(400).json({ message: "Nome obrigatório" });
    const slug = slugify(name);
    const cat = await storage.createCategory({ name, slug, description, parentId: parentId || null, active: true });
    return res.status(201).json(cat);
  });
  app.put("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    const cat = await storage.updateCategory(Number(req.params.id), req.body);
    return res.json(cat);
  });
  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    return res.json({ success: true });
  });

  // ─ Featured Products admin ────────────────────────────────────────────────
  app.get("/api/admin/featured-products", requireAdmin, async (_req, res) => {
    const { products: prods } = await storage.listProducts({ limit: 100, offset: 0 });
    const enriched = await Promise.all(prods.map(async p => {
      const imgs = await storage.getProductImages(p.id);
      return { id: p.id, title: p.title, price: p.price, featured: p.featured || false, mainImage: imgs.find(i => i.isMain)?.url || imgs[0]?.url || null };
    }));
    return res.json(enriched);
  });

  app.put("/api/admin/products/:id/featured", requireAdmin, async (req, res) => {
    const prod = await storage.updateProduct(Number(req.params.id), { featured: req.body.featured });
    return res.json(prod);
  });

  // ─ Products admin ─────────────────────────────────────────────────────────
  app.get("/api/admin/products", requireAdmin, async (req, res) => {
    const { search, category, status, page = "1", limit = "20" } = req.query as any;
    const result = await storage.listProducts({
      search, categoryId: category ? Number(category) : undefined,
      status: status || undefined,
      limit: Number(limit), offset: (Number(page) - 1) * Number(limit),
    });
    return res.json(result);
  });
  app.get("/api/admin/products/:id", requireAdmin, async (req, res) => {
    const product = await storage.getProductById(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    const [images, variantList] = await Promise.all([
      storage.getProductImages(product.id),
      storage.getVariantsByProduct(product.id),
    ]);
    return res.json({ ...product, images, variants: variantList });
  });
  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    const { variants: variantsData, ...productData } = req.body;
    const slug = productData.slug || slugify(productData.title);
    const product = await storage.createProduct({ ...productData, slug });
    if (variantsData?.length) {
      for (const v of variantsData) {
        await storage.createVariant({ ...v, productId: product.id });
      }
    }
    return res.status(201).json(product);
  });
  app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
    const { variants: variantsData, images: _images, ...productData } = req.body;
    const product = await storage.updateProduct(Number(req.params.id), productData);
    return res.json(product);
  });
  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    await storage.deleteProduct(Number(req.params.id));
    return res.json({ success: true });
  });

  // Product images
  app.post("/api/admin/products/:id/images", requireAdmin, upload.array("images", 10), async (req, res) => {
    const productId = Number(req.params.id);
    const files = req.files as Express.Multer.File[];
    const existingImages = await storage.getProductImages(productId);
    const savedImages = [];
    for (let i = 0; i < files.length; i++) {
      const img = await storage.addProductImage({
        productId,
        url: `/uploads/products/${files[i].filename}`,
        altText: req.body[`alt_${i}`] || "",
        position: existingImages.length + i,
        isMain: existingImages.length === 0 && i === 0,
      });
      savedImages.push(img);
    }
    return res.status(201).json(savedImages);
  });
  app.delete("/api/admin/products/images/:imageId", requireAdmin, async (req, res) => {
    await storage.deleteProductImage(Number(req.params.imageId));
    return res.json({ success: true });
  });
  app.put("/api/admin/products/:id/images/:imageId/main", requireAdmin, async (req, res) => {
    await storage.setMainImage(Number(req.params.id), Number(req.params.imageId));
    return res.json({ success: true });
  });

  // Variants
  app.post("/api/admin/products/:id/variants", requireAdmin, async (req, res) => {
    const variant = await storage.createVariant({ ...req.body, productId: Number(req.params.id) });
    return res.status(201).json(variant);
  });
  app.put("/api/admin/variants/:id", requireAdmin, async (req, res) => {
    const variant = await storage.updateVariant(Number(req.params.id), req.body);
    return res.json(variant);
  });
  app.delete("/api/admin/variants/:id", requireAdmin, async (req, res) => {
    await storage.deleteVariant(Number(req.params.id));
    return res.json({ success: true });
  });

  // ─ CSV/XLSX Import ────────────────────────────────────────────────────────
  app.post("/api/admin/products/import", requireAdmin, uploadCsv.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
    try {
      const wb = XLSX.readFile(req.file.path);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const results = { created: 0, updated: 0, errors: [] as string[] };
      const productMap = new Map<string, any>();

      for (const row of rows) {
        const handle = String(row["Handle"] || row["handle"] || "").trim();
        const title = String(row["Title"] || row["Título"] || row["titulo"] || "").trim();
        if (!handle && !title) continue;

        const key = handle || slugify(title);
        const price = String(row["Price"] || row["Preço"] || row["preco"] || "0").replace(",", ".");
        const stock = parseInt(String(row["Inventory Quantity"] || row["Estoque"] || "0")) || 0;

        if (!productMap.has(key)) {
          const productTitle = title || key;
          const productData = {
            title: productTitle,
            slug: key,
            description: String(row["Description (HTML)"] || row["Descrição"] || ""),
            vendor: String(row["Vendor"] || row["Fornecedor"] || ""),
            brand: String(row["Brand"] || row["Marca"] || ""),
            type: String(row["Type"] || row["Tipo"] || ""),
            tags: String(row["Tags"] || ""),
            sku: String(row["SKU"] || ""),
            barcode: String(row["Barcode"] || row["Código de Barras"] || ""),
            price,
            compareAtPrice: String(row["Compare At Price"] || row["Preço De"] || "") || null,
            costPerItem: String(row["Cost Per Item"] || row["Custo"] || "") || null,
            weightG: parseInt(String(row["Weight (g)"] || row["Peso (g)"] || "0")) || null,
            stockQuantity: stock,
            status: String(row["Status"] || "active"),
            published: String(row["Published"] || "true").toLowerCase() !== "false",
            seoTitle: String(row["SEO Title"] || row["Meta Título"] || "") || null,
            seoDescription: String(row["SEO Description"] || row["Meta Descrição"] || "") || null,
          };

          try {
            const existing = await storage.getProductBySlug(key);
            if (existing) {
              await storage.updateProduct(existing.id, productData);
              productMap.set(key, existing);
              results.updated++;
            } else {
              const created = await storage.createProduct(productData);
              productMap.set(key, created);
              results.created++;
            }
          } catch (e: any) {
            results.errors.push(`Linha "${productTitle}": ${e.message}`);
            continue;
          }
        }

        // Add variant if option columns present
        const opt1Val = String(row["Option1 Value"] || row["Variante 1 Valor"] || "").trim();
        const opt2Val = String(row["Option2 Value"] || row["Variante 2 Valor"] || "").trim();
        const variantSku = String(row["SKU"] || "").trim();

        if (opt1Val) {
          const product = productMap.get(key);
          if (product) {
            await storage.createVariant({
              productId: product.id, sku: variantSku || null, price,
              option1: opt1Val || null, option2: opt2Val || null,
              stockQuantity: stock, active: true,
            });
          }
        }

        // Add image if URL provided
        const imgUrl = String(row["Image 1 URL"] || row["Imagem 1 URL"] || "").trim();
        if (imgUrl) {
          const product = productMap.get(key);
          if (product) {
            const existingImgs = await storage.getProductImages(product.id);
            if (!existingImgs.some(i => i.url === imgUrl)) {
              await storage.addProductImage({
                productId: product.id, url: imgUrl,
                altText: String(row["Image 1 Alt"] || ""),
                position: existingImgs.length,
                isMain: existingImgs.length === 0,
              });
            }
          }
        }
      }

      // Cleanup temp file
      fs.unlink(req.file.path, () => {});
      return res.json({ success: true, ...results });
    } catch (e: any) {
      return res.status(500).json({ message: `Erro ao processar arquivo: ${e.message}` });
    }
  });

  // Download CSV template
  app.get("/api/admin/products/import/template", requireAdmin, (_req, res) => {
    const headers = [
      "Handle", "Title", "Description (HTML)", "Vendor", "Brand", "Type", "Tags",
      "Status", "Published", "SKU", "Barcode", "Price", "Compare At Price",
      "Cost Per Item", "Weight (g)", "Height (cm)", "Width (cm)", "Depth (cm)",
      "Inventory Quantity", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
      "Image 1 URL", "Image 1 Alt", "Image 2 URL", "SEO Title", "SEO Description",
    ];
    const example = [
      "camiseta-azul", "Camiseta Azul", "<p>Camiseta 100% algodão</p>", "Minha Marca",
      "Minha Marca", "Camisetas", "camiseta,moda,azul", "active", "true",
      "CAM-AZL-M", "7891234567890", "79.90", "99.90", "25.00", "300", "70", "50", "1",
      "10", "Tamanho", "M", "", "", "https://exemplo.com/foto.jpg", "Camiseta Azul M",
      "", "Camiseta Azul | Loja", "Compre camiseta azul...",
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=template_produtos.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  });

  // ─ Orders admin ───────────────────────────────────────────────────────────
  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    const { status, search, page = "1", limit = "20" } = req.query as any;
    const result = await storage.listOrders({
      status: status || undefined, search: search || undefined,
      limit: Number(limit), offset: (Number(page) - 1) * Number(limit),
    });
    return res.json(result);
  });
  app.get("/api/admin/orders/:id", requireAdmin, async (req, res) => {
    const order = await storage.getOrderById(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
    const [items, history, payment] = await Promise.all([
      storage.getOrderItems(order.id),
      storage.getOrderHistory(order.id),
      storage.getPaymentByOrderId(order.id),
    ]);
    return res.json({ ...order, items, history, payment });
  });
  app.put("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    const { status, note } = req.body;
    const admin = (req as any).admin;
    const order = await storage.updateOrderStatus(Number(req.params.id), status, note, admin?.email);
    return res.json(order);
  });
  app.put("/api/admin/orders/:id/tracking", requireAdmin, async (req, res) => {
    const { carrier, service, trackingCode } = req.body;
    const order = await storage.updateOrderTracking(Number(req.params.id), carrier, service, trackingCode);
    // Send shipping email
    const settings = await storage.getStoreSettings();
    const smtp = getSmtpConfig();
    if (smtp.user && smtp.pass) {
      sendShippingEmail({
        orderNumber: order.orderNumber, customerName: order.customerName,
        customerEmail: order.customerEmail, trackingCode, carrier,
        storeName: settings?.storeName,
      }, smtp).catch(console.error);
    }
    return res.json(order);
  });

  // ─ Customers admin ────────────────────────────────────────────────────────
  app.get("/api/admin/customers", requireAdmin, async (req, res) => {
    const { search } = req.query as any;
    const list = await storage.listCustomers(search || undefined);
    return res.json(list);
  });

  // ─ Coupons admin ──────────────────────────────────────────────────────────
  app.get("/api/admin/coupons", requireAdmin, async (_req, res) => {
    return res.json(await storage.listCoupons());
  });
  app.post("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const coupon = await storage.createCoupon({
        ...req.body,
        code: String(req.body.code).toUpperCase(),
      });
      return res.status(201).json(coupon);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Já existe um cupom com este código" });
      throw err;
    }
  });
  app.put("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    try {
      const { usedCount, ...rest } = req.body || {};
      const coupon = await storage.updateCoupon(Number(req.params.id), rest);
      if (!coupon) return res.status(404).json({ message: "Cupom não encontrado" });
      return res.json(coupon);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Já existe um cupom com este código" });
      throw err;
    }
  });
  app.delete("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    await storage.deleteCoupon(Number(req.params.id));
    return res.status(204).send();
  });

  // ─ Assinaturas admin ──────────────────────────────────────────────────────
  app.get("/api/admin/subscriptions", requireAdmin, async (_req, res) => {
    return res.json(await storage.listSubscriptionsAdmin());
  });
  app.post("/api/admin/subscriptions/:id/cancel", requireAdmin, async (req, res) => {
    try {
      const subs = await storage.listSubscriptionsAdmin();
      const sub = subs.find((s) => s.id === Number(req.params.id));
      if (!sub) return res.status(404).json({ message: "Assinatura não encontrada" });
      const cfg = loadAsaasConfig(process.env);
      await cancelSubscription(cfg, sub.gatewaySubscriptionId);
      const updated = await storage.updateSubscriptionRow(sub.id, { status: "CANCELLED" });
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Erro ao cancelar assinatura" });
    }
  });

  // ─ Carrinhos abandonados admin ────────────────────────────────────────────
  const normalizePhoneBR = (raw: string): string | null => {
    let d = (raw || "").replace(/\D/g, "");
    if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
    if (d.length < 10 || d.length > 11) return null;
    return "55" + d;
  };
  const DEFAULT_CART_MSG =
    "Oi {nome}! 👋 Vi que você deixou alguns itens no carrinho:\n\n{itens}\n\nPosso te ajudar a finalizar? É só clicar aqui: {link}{cupom}";

  app.get("/api/admin/carts/abandoned", requireAdmin, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const minAgeHours = req.query.minAgeHours ? Number(req.query.minAgeHours) : undefined;
    const maxAgeDays = req.query.maxAgeDays ? Number(req.query.maxAgeDays) : 30;
    return res.json(await storage.listAbandonedCarts({ status, minAgeHours, maxAgeDays }));
  });

  app.post("/api/admin/carts/:id/send-whatsapp", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const couponCode = typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
      ? req.body.couponCode.trim().toUpperCase() : null;
    // Valida ANTES de registrar o contato.
    const cart = await storage.getCartSessionById(id);
    if (!cart) return res.status(404).json({ message: "Carrinho não encontrado" });
    if (cart.recoveryStatus === "converted") return res.status(409).json({ message: "Carrinho já convertido" });
    const phone = normalizePhoneBR(cart.customerPhone || "");
    if (!phone) return res.status(400).json({ message: "Carrinho sem telefone válido" });

    const updated = await storage.registerCartContact(id, couponCode);
    if (!updated) return res.status(409).json({ message: "Carrinho já convertido ou inexistente" });

    // Itens vêm do banco (cart_items + products) — nunca do cliente.
    const enriched = (await storage.listAbandonedCarts({})).find((c: any) => c.id === id);
    const items = enriched?.items ?? [];
    const itensStr = items
      .map((i: any) => `• ${i.quantity}x ${i.productTitle} — R$ ${(Number(i.unitPrice) * i.quantity).toFixed(2)}`)
      .join("\n");

    const settings = await storage.getStoreSettings();
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    const link = `${base}/loja/carrinho?recover=${encodeURIComponent(cart.sessionId)}` +
      (couponCode ? `&cupom=${encodeURIComponent(couponCode)}` : "");
    const cupomStr = couponCode ? `\n\n🎁 Use o cupom *${couponCode}* e ganhe um desconto!` : "";
    const template = (settings as any)?.abandonedMessageTemplate?.trim() || DEFAULT_CART_MSG;
    const message = template
      .replace(/{nome}/g, (cart.customerName || "").split(" ")[0] || "tudo bem?")
      .replace(/{itens}/g, itensStr)
      .replace(/{link}/g, link)
      .replace(/{cupom}/g, cupomStr);

    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    return res.json({ waLink, contactCount: updated.contactCount });
  });

  app.patch("/api/admin/carts/:id", requireAdmin, async (req, res) => {
    const status = typeof req.body?.status === "string" ? req.body.status : null;
    if (!status || !["open", "contacted", "converted"].includes(status))
      return res.status(400).json({ message: "Status inválido" });
    const row = await storage.updateCartRecoveryStatus(Number(req.params.id), status);
    if (!row) return res.status(404).json({ message: "Não encontrado ou já convertido" });
    return res.json(row);
  });

  // ─ Avaliações admin ────────────────────────────────────────────────────────
  app.get("/api/admin/reviews", requireAdmin, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    return res.json(await storage.listReviewsAdmin(status, 50, (page - 1) * 50));
  });
  app.get("/api/admin/reviews/pending-count", requireAdmin, async (_req, res) => {
    return res.json({ count: await storage.countPendingReviews() });
  });
  app.patch("/api/admin/reviews/:id", requireAdmin, async (req: any, res) => {
    const status = typeof req.body?.status === "string" ? req.body.status : null;
    if (!status || !["approved", "rejected", "pending"].includes(status))
      return res.status(400).json({ message: "Status inválido" });
    const adminReply = typeof req.body?.adminReply === "string" ? req.body.adminReply.slice(0, 2000) : undefined;
    const updated = await storage.moderateReview(Number(req.params.id), { status, adminReply }, req.admin?.email || "admin");
    if (!updated) return res.status(404).json({ message: "Avaliação não encontrada" });
    return res.json(updated);
  });
  app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    const row = await storage.deleteReview(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "Avaliação não encontrada" });
    return res.status(204).send();
  });

  // ─ Kits admin ──────────────────────────────────────────────────────────────
  const bundleSchema = z.object({
    slug: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
    image: z.string().nullable().optional(),
    discountType: z.enum(["percentage", "fixed", "fixed_price"]),
    discountValue: z.coerce.number().finite().nonnegative().max(999999),
    active: z.boolean().optional(),
    items: z.array(z.object({
      productId: z.number().int().positive(),
      variantId: z.number().int().positive().nullable().optional(),
      quantity: z.number().int().positive().max(20),
    })).min(1),
  });
  app.get("/api/admin/bundles", requireAdmin, async (_req, res) => {
    return res.json(await storage.listAllBundlesAdmin());
  });
  app.post("/api/admin/bundles", requireAdmin, async (req, res) => {
    const parsed = bundleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
    const { items, ...data } = parsed.data;
    try {
      const b = await storage.createBundleWithItems({ ...data, discountValue: String(data.discountValue) }, items);
      return res.status(201).json(b);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Já existe um kit com este slug" });
      throw err;
    }
  });
  app.put("/api/admin/bundles/:id", requireAdmin, async (req, res) => {
    const parsed = bundleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
    const { items, ...data } = parsed.data;
    const patch: Record<string, unknown> = { ...data };
    if (data.discountValue != null) patch.discountValue = String(data.discountValue);
    try {
      const b = await storage.updateBundleWithItems(Number(req.params.id), patch, items);
      if (!b) return res.status(404).json({ message: "Kit não encontrado" });
      return res.json(b);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Já existe um kit com este slug" });
      throw err;
    }
  });
  app.delete("/api/admin/bundles/:id", requireAdmin, async (req, res) => {
    const b = await storage.deleteBundle(Number(req.params.id));
    if (!b) return res.status(404).json({ message: "Kit não encontrado" });
    return res.status(204).send();
  });

  // ─ Financial Reports ─────────────────────────────────────────────────────────
  app.get("/api/admin/reports", requireAdmin, async (req, res) => {
    const { period = "month" } = req.query as any;
    const now = new Date();
    let startDate: Date;
    if (period === "today") startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === "week") { startDate = new Date(now); startDate.setDate(now.getDate() - 7); }
    else if (period === "month") startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === "year") startDate = new Date(now.getFullYear(), 0, 1);
    else startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const { orders: allOrders } = await storage.listOrders({ limit: 1000, offset: 0 });
    const filtered = allOrders.filter((o: any) =>
      o.status !== "cancelled" && new Date(o.createdAt) >= startDate
    );

    const totalRevenue = filtered.reduce((s: number, o: any) => s + Number(o.total), 0);
    const ordersCount = filtered.length;
    const avgTicket = ordersCount > 0 ? totalRevenue / ordersCount : 0;

    // Daily revenue (last 30 days)
    const last30Start = new Date(); last30Start.setDate(last30Start.getDate() - 29);
    const last30Orders = allOrders.filter((o: any) => o.status !== "cancelled" && new Date(o.createdAt) >= last30Start);
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    last30Orders.forEach((o: any) => {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      if (key in dailyMap) dailyMap[key] = (dailyMap[key] || 0) + Number(o.total);
    });
    const dailyRevenue = Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue }));

    const paymentBreakdown: Record<string, number> = {};
    filtered.forEach((o: any) => {
      paymentBreakdown[o.paymentMethod] = (paymentBreakdown[o.paymentMethod] || 0) + 1;
    });

    return res.json({
      period, totalRevenue, ordersCount, avgTicket, dailyRevenue, paymentBreakdown,
      recentOrders: filtered.slice(0, 10).map((o: any) => ({
        orderNumber: o.orderNumber, customerName: o.customerName,
        total: o.total, status: o.status, createdAt: o.createdAt
      }))
    });
  });

  return httpServer;
}
