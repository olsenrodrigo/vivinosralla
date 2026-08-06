// Resolve a configuração efetiva de formas de pagamento.
// Precedência: paymentConfig do banco → fallback do env PAYMENT_GATEWAY →
// default (todos os métodos ativos). Retrocompatível: sem config no banco,
// mantém o comportamento anterior (gateway do env, tudo habilitado).
// Sanitiza valores (gateway/modo) para config malformada não quebrar o dispatch.
import type {
  PaymentCardMode,
  PaymentConfig,
  PaymentGatewayId,
  PaymentMethodConfig,
  StoreSettings,
} from "@shared/schema";

function coerceGateway(g: unknown, fallback: PaymentGatewayId): PaymentGatewayId {
  return g === "asaas" || g === "mercadopago" ? g : fallback;
}
function coerceMode(m: unknown, fallback: PaymentCardMode): PaymentCardMode {
  return m === "embedded" || m === "redirect" ? m : fallback;
}
function merge(
  raw: Partial<PaymentMethodConfig> | undefined,
  base: PaymentMethodConfig
): PaymentMethodConfig {
  const out: PaymentMethodConfig = {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : base.enabled,
    gateway: coerceGateway(raw?.gateway, base.gateway),
  };
  if (base.mode !== undefined || raw?.mode !== undefined) {
    out.mode = coerceMode(raw?.mode, base.mode ?? "embedded");
  }
  return out;
}

export function resolvePaymentConfig(
  settings?: Pick<StoreSettings, "paymentConfig"> | null
): PaymentConfig {
  const envGateway: PaymentGatewayId = process.env.PAYMENT_GATEWAY === "asaas" ? "asaas" : "mercadopago";
  const base: PaymentConfig = {
    pix: { enabled: true, gateway: envGateway },
    boleto: { enabled: true, gateway: envGateway },
    credit_card: { enabled: true, gateway: envGateway, mode: "embedded" },
  };
  const cfg = settings?.paymentConfig;
  if (!cfg) return base;
  return {
    pix: merge(cfg.pix, base.pix),
    boleto: merge(cfg.boleto, base.boleto),
    credit_card: merge(cfg.credit_card, base.credit_card),
  };
}

/** Config do método informado (aceita debit_card como cartão). */
export function methodConfig(cfg: PaymentConfig, method: string): PaymentMethodConfig | undefined {
  if (method === "pix") return cfg.pix;
  if (method === "boleto") return cfg.boleto;
  if (method === "credit_card" || method === "debit_card") return cfg.credit_card;
  return undefined;
}
