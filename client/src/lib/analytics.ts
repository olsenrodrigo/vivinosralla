// Ponto único de instrumentação do funil (GA4 + Meta Pixel + TikTok).
// Regras:
//  - Nenhum script de terceiro é carregado ANTES do consentimento (LGPD).
//  - No-op silencioso quando o ID correspondente está vazio.
//  - Eventos disparados antes do consentimento são ignorados (não enfileirados).
//  - Guard contra disparo duplicado de `purchase` (React StrictMode, reload).
import { useEffect, useState } from "react";

export interface AnalyticsConfig {
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  requireConsent: boolean;
}

export interface AnalyticsItem {
  slug: string;
  name?: string;
  price: number;
  quantity?: number;
  category?: string;
}

let cfg: AnalyticsConfig = {
  ga4MeasurementId: null,
  metaPixelId: null,
  tiktokPixelId: null,
  requireConsent: true,
};
let ready = false; // consentimento concedido + scripts injetados
let injected = false;
const firedPurchases = new Set<string>(); // dedup em memória (fallback do sessionStorage)
const readyListeners = new Set<() => void>();

type Win = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
  ttq?: { track: (name: string, params?: unknown) => void; page?: () => void; load?: (id: string) => void };
};
const w = () => window as unknown as Win;

export function setAnalyticsConfig(next: Partial<AnalyticsConfig>) {
  cfg = { ...cfg, ...next };
}
export function getAnalyticsConfig(): AnalyticsConfig {
  return cfg;
}

function injectGa4(id: string) {
  const win = w();
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  win.dataLayer = win.dataLayer || [];
  win.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    win.dataLayer!.push(arguments);
  } as unknown as Win["gtag"];
  win.gtag!("js", new Date());
  win.gtag!("config", id);
}

function injectMetaPixel(id: string) {
  const win = w();
  if (!win.fbq) {
    const f: Win["fbq"] = function fbq() {
      // eslint-disable-next-line prefer-rest-params
      (f as any).callMethod ? (f as any).callMethod.apply(f, arguments) : (f as any).queue.push(arguments);
    } as Win["fbq"];
    (f as any).queue = [];
    (f as any).loaded = true;
    (f as any).version = "2.0";
    win.fbq = f;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  win.fbq!("init", id);
  win.fbq!("track", "PageView");
}

function injectTiktok(id: string) {
  const win = w() as unknown as { ttq?: any; TiktokAnalyticsObject?: string };
  // Bootstrap oficial: instala o stub com fila ANTES de carregar o SDK, para que
  // eventos disparados durante o carregamento do script não sejam perdidos.
  win.TiktokAnalyticsObject = "ttq";
  const ttq: any = (win.ttq = win.ttq || []);
  ttq.methods = [
    "page", "track", "identify", "instances", "debug", "on", "off", "once",
    "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent",
    "revokeConsent", "grantConsent",
  ];
  ttq.setAndDefer = function (t: any, e: string) {
    t[e] = function () {
      // eslint-disable-next-line prefer-rest-params
      t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.load = ttq.load || function (i: string) {
    ttq._i = ttq._i || {};
    ttq._i[i] = [];
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(i)}&lib=ttq`;
    document.head.appendChild(s);
  };
  ttq.load(id);
  ttq.page();
}

function injectScripts() {
  if (injected) return;
  injected = true;
  if (cfg.ga4MeasurementId) injectGa4(cfg.ga4MeasurementId);
  if (cfg.metaPixelId) injectMetaPixel(cfg.metaPixelId);
  if (cfg.tiktokPixelId) injectTiktok(cfg.tiktokPixelId);
}

/** Concede consentimento e carrega os scripts (idempotente). */
export function enableAnalytics() {
  if (ready) return;
  ready = true;
  injectScripts();
  readyListeners.forEach((cb) => cb());
  readyListeners.clear();
}

export function analyticsReady() {
  return ready;
}

/** Notifica (1x) quando o analytics for habilitado. Retorna um unsubscribe. */
export function subscribeAnalyticsReady(cb: () => void): () => void {
  if (ready) {
    cb();
    return () => {};
  }
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

/**
 * Hook reativo: `false` até o consentimento ser concedido, `true` depois.
 * Permite reemitir view_item/begin_checkout que teriam virado no-op se o
 * consentimento chegou depois da montagem da página.
 */
export function useAnalyticsReady(): boolean {
  const [r, setR] = useState(ready);
  useEffect(() => {
    if (r) return;
    return subscribeAnalyticsReady(() => setR(true));
  }, [r]);
  return r;
}

// ── Emissores por plataforma (no-op se o SDK não estiver presente) ────────────
function ga(name: string, params: Record<string, unknown>) {
  if (w().gtag) w().gtag!("event", name, params);
}
function meta(name: string, params: Record<string, unknown>) {
  if (w().fbq) w().fbq!("track", name, params);
}
function tt(name: string, params: Record<string, unknown>) {
  const ttq = w().ttq;
  if (ttq && typeof ttq.track === "function") ttq.track(name, params);
}

function ga4Items(items: AnalyticsItem[]) {
  return items.map((i) => ({
    item_id: i.slug,
    item_name: i.name,
    price: i.price,
    quantity: i.quantity ?? 1,
    item_category: i.category,
  }));
}
function sumValue(items: AnalyticsItem[]) {
  return Math.round(items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0) * 100) / 100;
}

export function trackViewItem(item: AnalyticsItem) {
  if (!ready) return;
  ga("view_item", { currency: "BRL", value: item.price, items: ga4Items([item]) });
  meta("ViewContent", { content_ids: [item.slug], content_name: item.name, content_type: "product", value: item.price, currency: "BRL" });
  tt("ViewContent", { content_id: item.slug, content_type: "product", value: item.price, currency: "BRL" });
}

export function trackAddToCart(item: AnalyticsItem) {
  if (!ready) return;
  const value = sumValue([item]);
  ga("add_to_cart", { currency: "BRL", value, items: ga4Items([item]) });
  meta("AddToCart", { content_ids: [item.slug], content_type: "product", value, currency: "BRL" });
  tt("AddToCart", { content_id: item.slug, content_type: "product", value, currency: "BRL", quantity: item.quantity ?? 1 });
}

export function trackBeginCheckout(items: AnalyticsItem[]) {
  if (!ready || items.length === 0) return;
  const value = sumValue(items);
  ga("begin_checkout", { currency: "BRL", value, items: ga4Items(items) });
  meta("InitiateCheckout", { content_ids: items.map((i) => i.slug), content_type: "product", value, currency: "BRL", num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0) });
  tt("InitiateCheckout", { contents: items.map((i) => ({ content_id: i.slug, quantity: i.quantity ?? 1, price: i.price })), value, currency: "BRL" });
}

export function trackPurchase(order: { orderNumber: string; value: number; coupon?: string | null; items: AnalyticsItem[] }) {
  if (!ready) return;
  // Dedup: nunca dispara 2x para o mesmo pedido (StrictMode/reload/retorno).
  // Camada 1: memória (sobrevive a StrictMode e a sessionStorage indisponível).
  // Camada 2: sessionStorage (sobrevive a reload dentro da mesma sessão).
  if (firedPurchases.has(order.orderNumber)) return;
  const key = `wl_purchased_${order.orderNumber}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* sessionStorage indisponível: a camada de memória ainda protege */
  }
  firedPurchases.add(order.orderNumber);
  ga("purchase", {
    transaction_id: order.orderNumber,
    currency: "BRL",
    value: order.value,
    coupon: order.coupon || undefined,
    items: ga4Items(order.items),
  });
  meta("Purchase", { value: order.value, currency: "BRL", content_ids: order.items.map((i) => i.slug), content_type: "product" });
  tt("CompletePayment", { contents: order.items.map((i) => ({ content_id: i.slug, quantity: i.quantity ?? 1, price: i.price })), value: order.value, currency: "BRL" });
}
