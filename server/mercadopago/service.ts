// Operações de alto nível do conector MercadoPago.
// Em modo mock (sem MP_ACCESS_TOKEN) devolve respostas simuladas realistas e
// COERENTES entre create/get/refund (store em memória), permitindo testar sem
// conta no gateway.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { MPConfig } from "./config";
import { MPClient, MPError } from "./client";
import type {
  CardTokenInput,
  MPCardToken,
  MPPayment,
  MPRefund,
  MPSearchResult,
  PaymentInput,
  PaymentMethod,
  WebhookSignatureInput,
} from "./types";

function client(cfg: MPConfig) {
  return new MPClient(cfg);
}

let mockSeq = 100000000;
function mockId(): number {
  mockSeq += 1;
  return mockSeq;
}
// Store em memória (mock): mantém coerência entre create → get → refund.
const mockStore = new Map<string, MPPayment>();

// 1x1 PNG transparente (base64) — placeholder de QR no mock.
const MOCK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// ── Pagamentos ────────────────────────────────────────────────────────────────

export async function createPayment(cfg: MPConfig, input: PaymentInput): Promise<MPPayment> {
  if (cfg.mock) return mockCreatePayment(input);
  // Sem chave estável aqui: o client gera um X-Idempotency-Key (UUID) por
  // tentativa. Reusar a mesma chave bloquearia uma nova tentativa legítima.
  return client(cfg).post<MPPayment>("/v1/payments", input);
}

export async function getPayment(cfg: MPConfig, paymentId: string | number): Promise<MPPayment> {
  if (cfg.mock) {
    return (
      mockStore.get(String(paymentId)) ?? {
        id: paymentId,
        status: "pending",
        transaction_amount: 0,
        payment_method_id: "pix",
      }
    );
  }
  return client(cfg).get<MPPayment>(`/v1/payments/${paymentId}`);
}

export interface SearchFilters {
  external_reference?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function searchPayments(
  cfg: MPConfig,
  filters: SearchFilters = {}
): Promise<MPSearchResult<MPPayment>> {
  if (cfg.mock) {
    let results = Array.from(mockStore.values());
    if (filters.external_reference)
      results = results.filter((p) => p.external_reference === filters.external_reference);
    if (filters.status) results = results.filter((p) => p.status === filters.status);
    return { paging: { total: results.length, limit: filters.limit ?? 10, offset: 0 }, results };
  }
  return client(cfg).get<MPSearchResult<MPPayment>>("/v1/payments/search", {
    external_reference: filters.external_reference,
    status: filters.status,
    limit: filters.limit ?? 10,
    offset: filters.offset ?? 0,
    sort: "date_created",
    criteria: "desc",
  });
}

/** Estorno total (amount omitido) ou parcial. */
export async function refundPayment(
  cfg: MPConfig,
  paymentId: string | number,
  amount?: number
): Promise<MPRefund> {
  if (cfg.mock) {
    const p = mockStore.get(String(paymentId));
    if (p) {
      const already = p.transaction_amount_refunded ?? 0;
      const value = amount ?? Math.max(0, p.transaction_amount - already);
      p.transaction_amount_refunded = Math.round((already + value) * 100) / 100;
      // Estorno TOTAL vira "refunded"; parcial mantém "approved" (regra do MP).
      if (p.transaction_amount_refunded >= p.transaction_amount) p.status = "refunded";
      return { id: mockId(), payment_id: paymentId, amount: value, status: "approved" };
    }
    return { id: mockId(), payment_id: paymentId, amount: amount ?? 0, status: "approved" };
  }
  const body = amount != null ? { amount } : {};
  return client(cfg).post<MPRefund>(`/v1/payments/${paymentId}/refunds`, body);
}

export async function listRefunds(cfg: MPConfig, paymentId: string | number): Promise<MPRefund[]> {
  if (cfg.mock) {
    const p = mockStore.get(String(paymentId));
    const refunded = p?.transaction_amount_refunded ?? 0;
    return refunded > 0 ? [{ id: mockId(), payment_id: paymentId, amount: refunded, status: "approved" }] : [];
  }
  return client(cfg).get<MPRefund[]>(`/v1/payments/${paymentId}/refunds`);
}

/** Cancela um pagamento pendente/autorizado. */
export async function cancelPayment(cfg: MPConfig, paymentId: string | number): Promise<MPPayment> {
  if (cfg.mock) {
    const p = mockStore.get(String(paymentId));
    if (p) {
      p.status = "cancelled";
      return p;
    }
    return { id: paymentId, status: "cancelled", transaction_amount: 0 };
  }
  return client(cfg).put<MPPayment>(`/v1/payments/${paymentId}`, { status: "cancelled" });
}

// ── Meios de pagamento ─────────────────────────────────────────────────────────

export async function getPaymentMethods(cfg: MPConfig): Promise<PaymentMethod[]> {
  if (cfg.mock) {
    return [
      { id: "pix", name: "Pix", payment_type_id: "bank_transfer", status: "active" },
      { id: "bolbradesco", name: "Boleto", payment_type_id: "ticket", status: "active" },
      { id: "master", name: "Mastercard", payment_type_id: "credit_card", status: "active" },
      { id: "visa", name: "Visa", payment_type_id: "credit_card", status: "active" },
    ];
  }
  return client(cfg).get<PaymentMethod[]>("/v1/payment_methods");
}

/**
 * Tokeniza um cartão de TESTE (sandbox). Em produção a tokenização é client-side
 * (SDK MP.js/Bricks com a public key) por exigência PCI — aqui é travado ao sandbox.
 */
export async function createTestCardToken(cfg: MPConfig, card: CardTokenInput): Promise<MPCardToken> {
  if (cfg.mock) {
    return {
      id: `mocktok_${mockId()}`,
      first_six_digits: card.cardNumber.replace(/\D/g, "").slice(0, 6),
      last_four_digits: card.cardNumber.replace(/\D/g, "").slice(-4),
    };
  }
  if (cfg.env !== "sandbox" && !cfg.accessToken.startsWith("TEST-")) {
    throw new MPError(400, "pci_required", "Tokenização server-side só em sandbox; em produção use o SDK no front", null);
  }
  const body = {
    card_number: card.cardNumber.replace(/\s/g, ""),
    security_code: card.securityCode,
    expiration_month: Number(card.expirationMonth),
    expiration_year: Number(card.expirationYear),
    cardholder: {
      name: card.holderName,
      identification: { type: "CPF", number: card.cpf.replace(/\D/g, "") },
    },
  };
  // /v1/card_tokens aceita a public key por query no sandbox.
  const path = cfg.publicKey ? `/v1/card_tokens?public_key=${encodeURIComponent(cfg.publicKey)}` : "/v1/card_tokens";
  return client(cfg).post<MPCardToken>(path, body);
}

// ── PIX / Boleto (extração dos dados do pagamento) ─────────────────────────────

export interface PixData {
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiration?: string;
}

export function extractPixData(payment: MPPayment): PixData {
  const td = payment.point_of_interaction?.transaction_data;
  return {
    qrCode: td?.qr_code,
    qrCodeBase64: td?.qr_code_base64,
    ticketUrl: td?.ticket_url,
    expiration: payment.date_of_expiration ?? undefined,
  };
}

export interface BoletoData {
  url?: string;
  barcode?: string;
}

export function extractBoletoData(payment: MPPayment): BoletoData {
  return {
    url: payment.transaction_details?.external_resource_url,
    barcode: payment.barcode?.content,
  };
}

// ── Webhook: validação da assinatura x-signature (HMAC-SHA256) ─────────────────
// MP envia `x-signature: ts=<unix>,v1=<hash>` e `x-request-id`. O manifesto é
// `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — segmentos cujo valor está
// AUSENTE são OMITIDOS do manifesto (spec MP). Hash = HMAC-SHA256(manifesto,secret) hex.
export function validateWebhookSignature(cfg: MPConfig, input: WebhookSignatureInput): boolean {
  if (!cfg.webhookSecret || !input.xSignature) return false;
  let ts = "";
  let v1 = "";
  for (const part of input.xSignature.split(",")) {
    const [k, val] = part.split("=").map((s) => s.trim());
    if (k === "ts") ts = val;
    else if (k === "v1") v1 = val;
  }
  if (!ts || !v1) return false;

  // data.id: MP recomenda minúsculo quando alfanumérico (ids de payment são numéricos).
  const rawId = input.dataId;
  const dataId = rawId && /[a-zA-Z]/.test(rawId) ? rawId.toLowerCase() : rawId;

  // Monta o manifesto omitindo segmentos ausentes (do contrário rejeita assinaturas válidas).
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (input.xRequestId) manifest += `request-id:${input.xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", cfg.webhookSecret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Mapeamento de status → vocabulário do app ──────────────────────────────────
export function mapStatus(status: string): string {
  switch (status) {
    case "approved":
    case "authorized":
      return "approved";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "pending":
    case "in_process":
    case "in_mediation":
    default:
      return "pending";
  }
}

// ── Mocks ──────────────────────────────────────────────────────────────────────
function mockCreatePayment(input: PaymentInput): MPPayment {
  const id = mockId();
  const method = input.payment_method_id;
  let payment: MPPayment;
  if (method === "pix") {
    payment = {
      id,
      status: "pending",
      status_detail: "pending_waiting_transfer",
      transaction_amount: input.transaction_amount,
      currency_id: "BRL",
      payment_method_id: "pix",
      payment_type_id: "bank_transfer",
      external_reference: input.external_reference,
      date_of_expiration: input.date_of_expiration ?? new Date(Date.now() + 30 * 60000).toISOString(),
      point_of_interaction: {
        transaction_data: {
          qr_code: `00020126MOCKPIX${id}5204000053039865802BR`,
          qr_code_base64: MOCK_PNG,
          ticket_url: `https://www.mercadopago.com.br/mock/pix/${id}`,
        },
      },
    };
  } else if (method === "bolbradesco" || method?.includes("bol")) {
    payment = {
      id,
      status: "pending",
      status_detail: "pending_waiting_payment",
      transaction_amount: input.transaction_amount,
      currency_id: "BRL",
      payment_method_id: method,
      payment_type_id: "ticket",
      external_reference: input.external_reference,
      transaction_details: { external_resource_url: `https://www.mercadopago.com.br/mock/boleto/${id}.pdf` },
      barcode: { content: "34191790010104351004791020150008291070026000" },
    };
  } else {
    // cartão (token presente) — aprova na hora no mock; sem token → recusado
    payment = {
      id,
      status: input.token ? "approved" : "rejected",
      status_detail: input.token ? "accredited" : "cc_rejected_other_reason",
      transaction_amount: input.transaction_amount,
      currency_id: "BRL",
      payment_method_id: method,
      payment_type_id: "credit_card",
      installments: input.installments ?? 1,
      external_reference: input.external_reference,
      date_approved: input.token ? new Date().toISOString() : null,
    };
  }
  mockStore.set(String(id), payment);
  return payment;
}

export { MPError };
