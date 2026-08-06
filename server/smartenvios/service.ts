// Serviço de alto nível: cotação, criação de pedido (Declaração de Conteúdo),
// etiqueta e rastreio. Aplica as regras da loja (frete grátis/desconto) e
// oferece modo mock para desenvolvimento sem token.
import type { SmartEnviosConfig } from "./config";
import { SmartEnviosClient, SmartEnviosError } from "./client";
import type {
  CreateOrderInput,
  CreateOrderResult,
  GenerateLabelInput,
  GenerateLabelResult,
  PricedQuote,
  QuoteInput,
  QuoteService,
  TrackingEvent,
} from "./types";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Cotação ────────────────────────────────────────────────────────────────
export async function quoteFreight(
  cfg: SmartEnviosConfig,
  input: QuoteInput
): Promise<QuoteService[]> {
  if (cfg.mock) return mockQuote(input);

  const client = new SmartEnviosClient(cfg);
  const body = {
    zip_code_start: onlyDigits(cfg.sender.zipcode),
    zip_code_end: onlyDigits(input.zipTo),
    total_price: input.totalPrice,
    document: input.document,
    extra_days: input.extraDays,
    volumes: input.volumes.map((v) => ({
      weight: v.weight,
      height: v.height,
      length: v.length,
      width: v.width,
      quantity: v.quantity,
      price: v.price,
      sku: v.sku,
    })),
  };
  const data = await client.request<{ result?: any[]; message?: string }>(
    "POST",
    "/quote/freight",
    { body }
  );
  // A SmartEnvios pode responder HTTP 200 com uma mensagem de erro
  // (ex.: "Você não tem permissão para utilizar este serviço") e sem `result`.
  if (!Array.isArray(data.result)) {
    throw new SmartEnviosError(
      403,
      (data as any)?.message || "Resposta inesperada da SmartEnvios (sem result)",
      data
    );
  }
  return data.result.map(mapQuote);
}

function mapQuote(r: any): QuoteService {
  return {
    id: String(r.id ?? ""),
    base: r.base ?? "",
    serviceCode: Number(r.service_code ?? 0),
    service: r.service ?? "",
    value: Number(r.value ?? 0),
    days: Number(r.days ?? 0),
    isValid: Boolean(r.is_valid),
    errors: Array.isArray(r.errors) ? r.errors : [],
  };
}

/** Aplica frete grátis / desconto da loja sobre as cotações válidas. */
export function priceQuotes(
  cfg: SmartEnviosConfig,
  services: QuoteService[],
  subtotal: number
): PricedQuote[] {
  const { freeShippingAbove, discountPercent, freeServices } = cfg.rules;
  const qualifiesFree = freeShippingAbove > 0 && subtotal >= freeShippingAbove;

  return services
    .filter((s) => s.isValid)
    .map((s) => {
      const isFreeService = freeServices.some((f) =>
        s.service.toLowerCase().includes(f.toLowerCase())
      );
      let finalValue = s.value;
      let free = false;
      if (qualifiesFree || isFreeService) {
        finalValue = 0;
        free = true;
      } else if (discountPercent > 0) {
        finalValue = round2(s.value * (1 - discountPercent / 100));
      }
      return {
        ...s,
        finalValue: round2(finalValue),
        free,
        discountApplied: round2(s.value - finalValue),
      };
    })
    .sort((a, b) => a.finalValue - b.finalValue);
}

// ─── Criar pedido (Declaração de Conteúdo) ──────────────────────────────────
export async function createOrder(
  cfg: SmartEnviosConfig,
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  if (cfg.mock) return mockCreateOrder(input);

  const client = new SmartEnviosClient(cfg);
  const s = cfg.sender;
  const r = input.recipient;
  const body = {
    preference_by: input.preferenceBy ?? "QUOTE_VALUE",
    external_order_id: input.externalOrderId,
    external_origin: input.externalOrigin ?? "LojaVirtual",
    source: "API",
    pickup: input.pickup ?? true,
    delivery: input.delivery ?? true,
    freightContentStatement: {
      nfe_key: input.nfeKey,
      sender_name: s.name,
      sender_document: onlyDigits(s.document),
      sender_zipcode: onlyDigits(s.zipcode),
      sender_street: s.street,
      sender_number: s.number,
      sender_neighborhood: s.neighborhood,
      sender_complement: s.complement,
      sender_phone: s.phone,
      sender_email: s.email,
      observation: input.observation,
      destiny_name: r.name,
      destiny_document: onlyDigits(r.document || ""),
      destiny_zipcode: onlyDigits(r.zipcode),
      destiny_street: r.street,
      destiny_number: r.number,
      destiny_neighborhood: r.neighborhood,
      destiny_complement: r.complement,
      destiny_phone: r.phone,
      destiny_email: r.email,
      items: input.items.map((it) => ({
        description: it.description,
        amount: it.amount,
        unit_price: it.unitPrice,
        total_price: it.totalPrice,
        weight: it.weight,
        height: it.height,
        width: it.width,
        length: it.length,
        sku: it.sku,
      })),
    },
  };
  const data = await client.request<any>("POST", "/dc-create", {
    body,
    query: { quote_service_id: input.quoteServiceId },
  });
  const out = data?.result ?? data;
  const orderId = out?.freight_order_id ?? out?.id ?? out?.order_id;
  // A API pode responder HTTP 200 com envelope de erro (status/errors) sem criar o pedido.
  if (!orderId) {
    const errs = Array.isArray((data as any)?.errors) ? (data as any).errors : [];
    const msg = [(data as any)?.message, ...errs].filter(Boolean).join(" | ");
    throw new SmartEnviosError(
      (data as any)?.status || 400,
      msg || "Falha ao criar o pedido na SmartEnvios",
      data
    );
  }
  return {
    orderId,
    orderNumber: out?.freight_order_number,
    trackingCode: out?.freight_order_tracking_code ?? out?.tracking_code,
    statusCode: out?.freight_order_status?.code,
    statusName: out?.freight_order_status?.name,
    raw: data,
  };
}

// ─── Etiqueta ────────────────────────────────────────────────────────────────
export async function generateLabel(
  cfg: SmartEnviosConfig,
  input: GenerateLabelInput
): Promise<GenerateLabelResult> {
  if (cfg.mock) return mockLabel(input);

  const client = new SmartEnviosClient(cfg);
  const body: Record<string, unknown> = { type: input.type ?? "pdf" };
  if (input.orderIds?.length) body.order_ids = input.orderIds;
  else if (input.trackingCodes?.length) body.tracking_codes = input.trackingCodes;
  else if (input.nfeKeys?.length) body.nfe_keys = input.nfeKeys;
  // Com NF-e, a etiqueta sai com DANFE integrada por padrão (config).
  const docType =
    input.documentType ??
    (cfg.document.mode === "nfe" ? cfg.document.labelType : undefined);
  if (docType) body.documentType = docType;
  if (input.mergeLabels) body.merge_labels = true;

  const data = await client.request<any>("POST", "/labels", { body });

  // A API real responde { results: [{ status, url, tickets: {...} }] };
  // a spec documenta { url, tickets: [...] }. Suportamos os dois.
  const mapTicket = (t: any) => ({
    freightOrderId: t?.freight_order_id,
    trackingCode: t?.tracking_code,
    publicTracking: t?.public_tracking,
    volumes: (t?.volumes || []).map((v: any) => ({ barcode: v.barcode })),
  });

  if (Array.isArray(data?.results)) {
    const errs = data.results.filter((r: any) => r.status === "ERROR");
    const oks = data.results.filter((r: any) => r.status !== "ERROR");
    if (oks.length === 0 && errs.length) {
      throw new SmartEnviosError(
        422,
        errs.map((e: any) => e.reason).filter(Boolean).join("; ") ||
          "Falha ao gerar etiqueta",
        data
      );
    }
    return {
      url: oks.find((r: any) => r.url)?.url,
      tickets: oks.map((r: any) => mapTicket(r.tickets)),
      raw: data,
    };
  }

  return {
    url: data?.url,
    tickets: (data?.tickets || []).map(mapTicket),
    raw: data,
  };
}

// ─── Rastreio ────────────────────────────────────────────────────────────────
export async function track(
  cfg: SmartEnviosConfig,
  trackingCode: string
): Promise<TrackingEvent[]> {
  if (cfg.mock) return mockTracking();
  const client = new SmartEnviosClient(cfg);
  const data = await client.request<any>("POST", "/freight-order/tracking", {
    body: { tracking_code: trackingCode },
  });
  const events = data?.events || data?.result || [];
  return (Array.isArray(events) ? events : []).map((e: any) => ({
    status: e.status,
    date: e.date,
    observation: e.observation,
    type: e.type,
  }));
}

// ─── NF-e: upload de XML a um pedido existente ──────────────────────────────
export async function uploadNfe(
  cfg: SmartEnviosConfig,
  freightOrderId: string,
  xml: string | Uint8Array,
  filename = "nfe.xml"
): Promise<{ message?: string; raw: unknown }> {
  if (cfg.mock) return { message: "mock: NF-e vinculada", raw: { mock: true } };
  if (!cfg.token) throw new SmartEnviosError(401, "SMARTENVIOS_TOKEN não configurado", null);
  const url = new URL(cfg.baseUrl + "/nfe-upload");
  url.searchParams.set("freight_order_id", freightOrderId);
  const form = new FormData();
  form.append(
    "file",
    new Blob([xml as BlobPart], { type: "application/xml" }),
    filename
  );
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { token: cfg.token },
    body: form,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* texto cru */
  }
  if (!res.ok) {
    const m = Array.isArray(data?.message) ? data.message.join("; ") : data?.message;
    throw new SmartEnviosError(res.status, m || "Falha no upload da NF-e", data);
  }
  return { message: data?.result?.message ?? data?.message, raw: data };
}

// ─── Atualizar pedido (PATCH) — inclui vincular chave de NF-e ────────────────
export async function updateOrder(
  cfg: SmartEnviosConfig,
  identifier: string,
  patch: Record<string, unknown>
): Promise<unknown> {
  if (cfg.mock) return { mock: true, patch };
  const client = new SmartEnviosClient(cfg);
  return client.request(
    "PATCH",
    `/order/${encodeURIComponent(identifier)}`,
    { body: patch }
  );
}

// ─── Mocks (desenvolvimento sem token) ──────────────────────────────────────
function totalWeight(input: QuoteInput): number {
  return input.volumes.reduce((s, v) => s + v.weight * v.quantity, 0);
}

function mockQuote(input: QuoteInput): QuoteService[] {
  const w = Math.max(0.3, totalWeight(input));
  const base = 16 + w * 4.5;
  const mk = (
    id: string,
    service: string,
    mult: number,
    days: number
  ): QuoteService => ({
    id,
    base: "RAO - SmartEnvios (mock)",
    serviceCode: 0,
    service,
    value: round2(base * mult),
    days,
    isValid: true,
    errors: [],
  });
  return [
    mk("mock-jadlog", "Jadlog Package", 1.0, 4),
    mk("mock-pac", "Correios PAC", 1.15, 7),
    mk("mock-sedex", "Correios SEDEX", 1.75, 2),
  ];
}

function rand(n = 10): string {
  let s = "";
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function mockCreateOrder(input: CreateOrderInput): CreateOrderResult {
  const tracking = "SM" + rand(11);
  return {
    orderId: globalThis.crypto?.randomUUID?.() ?? rand(24),
    trackingCode: tracking,
    raw: { mock: true, externalOrderId: input.externalOrderId },
  };
}

function mockLabel(input: GenerateLabelInput): GenerateLabelResult {
  const tracking = input.trackingCodes?.[0] || "SM" + rand(11);
  return {
    url: "https://sandbox.smartenvios.com/mock/label-" + tracking + ".pdf",
    tickets: [
      {
        freightOrderId: globalThis.crypto?.randomUUID?.() ?? rand(24),
        trackingCode: tracking,
        publicTracking:
          "https://v1.portal.smartenvios.com/tracking/" + tracking,
        volumes: [{ barcode: "SMP" + rand(9) }],
      },
    ],
    raw: { mock: true },
  };
}

function mockTracking(): TrackingEvent[] {
  return [
    { status: "Postado", date: new Date().toISOString(), type: "in_transit", observation: "Objeto postado (mock)" },
  ];
}
