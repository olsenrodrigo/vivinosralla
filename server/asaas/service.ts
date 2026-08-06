// Operações de alto nível do conector Asaas.
// Cada função aceita a config como primeiro argumento e devolve dados tipados.
// Em modo mock (sem ASAAS_API_KEY) devolve respostas simuladas realistas,
// permitindo desenvolver/testar a UX completa sem conta no gateway.
import { timingSafeEqual } from "node:crypto";
import type { AsaasConfig } from "./config";
import { AsaasClient, AsaasError } from "./client";
import type {
  AsaasBalance,
  AsaasCustomer,
  AsaasPayment,
  AsaasPaymentLink,
  AsaasSubscription,
  AsaasWebhookConfig,
  BoletoIdentification,
  CustomerInput,
  FinancialTransaction,
  PaymentInput,
  PaymentLinkInput,
  PixQrCode,
  SubscriptionInput,
  WebhookConfigInput,
  WebhookEvent,
} from "./types";
import { DEFAULT_WEBHOOK_EVENTS } from "./types";

function client(cfg: AsaasConfig) {
  return new AsaasClient(cfg);
}

let mockSeq = 1000;
function mockId(prefix: string): string {
  mockSeq += 1;
  return `${prefix}_mock${mockSeq}`;
}

interface ListResponse<T> {
  object: "list";
  hasMore: boolean;
  totalCount: number;
  data: T[];
}

// ── Clientes ────────────────────────────────────────────────────────────────

/**
 * Garante um cliente Asaas: procura por CPF/CNPJ e, se não existir, cria.
 * O externalReference guarda nosso identificador (ex: telefone normalizado).
 */
export async function ensureCustomer(
  cfg: AsaasConfig,
  input: CustomerInput
): Promise<AsaasCustomer> {
  if (cfg.mock) {
    return {
      id: mockId("cus"),
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email,
      mobilePhone: input.mobilePhone,
      externalReference: input.externalReference,
    };
  }
  const c = client(cfg);
  const cpf = input.cpfCnpj.replace(/\D/g, "");
  const found = await c.get<ListResponse<AsaasCustomer>>(
    `/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=1`
  );
  if (found.data.length > 0 && !found.data[0].deleted) {
    return found.data[0];
  }
  return c.post<AsaasCustomer>("/customers", { ...input, cpfCnpj: cpf });
}

// ── Cobranças ───────────────────────────────────────────────────────────────

export async function createPayment(
  cfg: AsaasConfig,
  input: PaymentInput
): Promise<AsaasPayment> {
  if (cfg.mock) {
    const isCard = input.billingType === "CREDIT_CARD";
    return {
      id: mockId("pay"),
      customer: input.customer,
      billingType: input.billingType,
      // cartão autoriza na hora; pix/boleto ficam pendentes
      status: isCard ? "CONFIRMED" : "PENDING",
      value: input.value,
      netValue: Math.round(input.value * 0.98 * 100) / 100,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
      invoiceUrl: "https://sandbox.asaas.com/i/mockinvoice",
      bankSlipUrl:
        input.billingType === "BOLETO" ? "https://sandbox.asaas.com/b/pdf/mockboleto" : undefined,
      installment: input.installmentCount ? mockId("ins") : undefined,
    };
  }
  return client(cfg).post<AsaasPayment>("/payments", input);
}

export async function getPayment(cfg: AsaasConfig, paymentId: string): Promise<AsaasPayment> {
  if (cfg.mock) {
    return {
      id: paymentId,
      customer: "cus_mock",
      billingType: "PIX",
      status: "PENDING",
      value: 0,
      dueDate: new Date().toISOString().slice(0, 10),
    };
  }
  return client(cfg).get<AsaasPayment>(`/payments/${paymentId}`);
}

export async function getPixQrCode(cfg: AsaasConfig, paymentId: string): Promise<PixQrCode> {
  if (cfg.mock) {
    // PNG 1x1 transparente
    return {
      encodedImage:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      payload: `00020126MOCKPIX${paymentId}5204000053039865802BR`,
      expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }
  return client(cfg).get<PixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

export async function getBoletoIdentification(
  cfg: AsaasConfig,
  paymentId: string
): Promise<BoletoIdentification> {
  if (cfg.mock) {
    return {
      identificationField: "00190.00009 01234.567890 12345.678901 2 99990000010000",
      barCode: "00192999900000100000000001234567891234567890",
    };
  }
  return client(cfg).get<BoletoIdentification>(`/payments/${paymentId}/identificationField`);
}

export async function refundPayment(
  cfg: AsaasConfig,
  paymentId: string,
  value?: number,
  description?: string
): Promise<AsaasPayment> {
  if (cfg.mock) {
    return {
      id: paymentId,
      customer: "cus_mock",
      billingType: "PIX",
      status: value ? "PARTIALLY_REFUNDED" : "REFUNDED",
      value: value ?? 0,
      dueDate: new Date().toISOString().slice(0, 10),
    };
  }
  const body: Record<string, unknown> = {};
  if (value != null) body.value = value;
  if (description) body.description = description;
  return client(cfg).post<AsaasPayment>(`/payments/${paymentId}/refund`, body);
}

export async function cancelPayment(cfg: AsaasConfig, paymentId: string): Promise<void> {
  if (cfg.mock) return;
  await client(cfg).delete(`/payments/${paymentId}`);
}

// ── Assinaturas ─────────────────────────────────────────────────────────────

export async function createSubscription(
  cfg: AsaasConfig,
  input: SubscriptionInput
): Promise<AsaasSubscription> {
  if (cfg.mock) {
    return {
      id: mockId("sub"),
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: input.cycle,
      description: input.description,
      status: "ACTIVE",
    };
  }
  return client(cfg).post<AsaasSubscription>("/subscriptions", input);
}

export async function cancelSubscription(cfg: AsaasConfig, subscriptionId: string): Promise<void> {
  if (cfg.mock) return;
  await client(cfg).delete(`/subscriptions/${subscriptionId}`);
}

export async function listSubscriptionPayments(
  cfg: AsaasConfig,
  subscriptionId: string
): Promise<AsaasPayment[]> {
  if (cfg.mock) return [];
  const res = await client(cfg).get<ListResponse<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments`
  );
  return res.data;
}

// ── Links de pagamento ──────────────────────────────────────────────────────

export async function createPaymentLink(
  cfg: AsaasConfig,
  input: PaymentLinkInput
): Promise<AsaasPaymentLink> {
  if (cfg.mock) {
    const id = mockId("paylnk");
    return {
      id,
      url: `https://sandbox.asaas.com/c/${id}`,
      name: input.name,
      active: true,
      value: input.value,
    };
  }
  return client(cfg).post<AsaasPaymentLink>("/paymentLinks", input);
}

// ── Operações de conta ──────────────────────────────────────────────────────

export async function getBalance(cfg: AsaasConfig): Promise<AsaasBalance> {
  if (cfg.mock) return { balance: 1234.56 };
  return client(cfg).get<AsaasBalance>("/finance/balance");
}

export async function listFinancialTransactions(
  cfg: AsaasConfig,
  limit = 10
): Promise<FinancialTransaction[]> {
  if (cfg.mock) {
    return [
      {
        id: "ft_mock1",
        value: 99.9,
        balance: 1234.56,
        type: "PAYMENT_RECEIVED",
        date: new Date().toISOString().slice(0, 10),
        description: "Cobrança recebida (mock)",
      },
    ];
  }
  const res = await client(cfg).get<ListResponse<FinancialTransaction>>(
    `/financialTransactions?limit=${limit}`
  );
  return res.data;
}

// ── Webhooks ────────────────────────────────────────────────────────────────

export async function listWebhooks(cfg: AsaasConfig): Promise<AsaasWebhookConfig[]> {
  if (cfg.mock) return [];
  const res = await client(cfg).get<ListResponse<AsaasWebhookConfig>>("/webhooks");
  return res.data;
}

/**
 * Registra (ou atualiza) o webhook desta aplicação no Asaas.
 * Procura por um webhook existente com a mesma URL antes de criar.
 */
export async function registerWebhook(
  cfg: AsaasConfig,
  overrides?: Partial<WebhookConfigInput>
): Promise<AsaasWebhookConfig> {
  if (!cfg.webhookUrl) throw new Error("ASAAS_WEBHOOK_URL não configurada");
  if (!cfg.webhookToken) throw new Error("ASAAS_WEBHOOK_TOKEN não configurada");
  const input: WebhookConfigInput = {
    name: cfg.userAgent,
    url: cfg.webhookUrl,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: cfg.webhookToken,
    sendType: "SEQUENTIALLY",
    events: DEFAULT_WEBHOOK_EVENTS,
    ...overrides,
  };
  if (cfg.mock) {
    return {
      id: mockId("webhook"),
      name: input.name,
      url: input.url,
      enabled: true,
      interrupted: false,
      events: input.events,
    };
  }
  const c = client(cfg);
  const existing = await listWebhooks(cfg);
  const match = existing.find((w) => w.url === input.url);
  if (match) {
    return c.put<AsaasWebhookConfig>(`/webhooks/${match.id}`, input);
  }
  return c.post<AsaasWebhookConfig>("/webhooks", input);
}

/**
 * Valida a autenticidade de um webhook recebido comparando o header
 * asaas-access-token com o segredo configurado (comparação constant-time).
 */
export function isValidWebhookToken(cfg: AsaasConfig, headerToken: string | undefined): boolean {
  if (!cfg.webhookToken || !headerToken) return false;
  const a = Buffer.from(cfg.webhookToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Faz o parse defensivo do corpo de um evento de webhook. */
export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const e = body as Record<string, unknown>;
  if (typeof e.event !== "string" || typeof e.id !== "string") return null;
  return e as unknown as WebhookEvent;
}

export { AsaasError };
