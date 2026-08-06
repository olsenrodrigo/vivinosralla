// Configuração do conector Asaas (gateway de pagamento).
// Framework-agnostic: lê tudo de variáveis de ambiente. Portátil — copie a
// pasta server/asaas/ entre projetos para reaproveitar o mesmo código.

export type AsaasEnv = "sandbox" | "production";

export interface AsaasConfig {
  /** Chave da API (access_token). Vazia = modo MOCK. */
  apiKey: string;
  env: AsaasEnv;
  baseUrl: string;
  /** Quando true, não bate na API — retorna respostas simuladas. */
  mock: boolean;
  /** User-Agent obrigatório nas requisições (exigência Asaas). */
  userAgent: string;
  /** Segredo validado no header asaas-access-token dos webhooks recebidos. */
  webhookToken: string;
  /** URL pública do endpoint de webhook (para registro via API). */
  webhookUrl: string;
  /** Gerar etiqueta SmartEnvios automaticamente ao confirmar pagamento. */
  autoLabel: boolean;
  /** Intervalo do poller de reconciliação em minutos (0 = desligado). */
  reconcileMinutes: number;
  /** Máximo de parcelas no cartão oferecidas no checkout. */
  maxInstallments: number;
}

const BASE_URLS: Record<AsaasEnv, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

export function loadConfig(env: NodeJS.ProcessEnv): AsaasConfig {
  const apiKey = (env.ASAAS_API_KEY || "").trim();
  const asaasEnv: AsaasEnv = env.ASAAS_ENV === "production" ? "production" : "sandbox";
  const mock = env.ASAAS_MOCK === "1" || !apiKey;

  return {
    apiKey,
    env: asaasEnv,
    baseUrl: BASE_URLS[asaasEnv],
    mock,
    userAgent: env.ASAAS_USER_AGENT || "LojaVirtual",
    webhookToken: env.ASAAS_WEBHOOK_TOKEN || "",
    webhookUrl: env.ASAAS_WEBHOOK_URL || "",
    autoLabel: env.ASAAS_AUTO_LABEL === "1",
    reconcileMinutes: Number(env.ASAAS_RECONCILE_MINUTES ?? 5) || 0,
    maxInstallments: Number(env.ASAAS_MAX_INSTALLMENTS ?? 12) || 12,
  };
}
