// Configuração do conector MercadoPago (gateway de pagamento).
// Framework-agnostic: lê tudo de variáveis de ambiente. Portátil — copie a
// pasta server/mercadopago/ entre projetos para reaproveitar o mesmo código.

export type MPEnv = "sandbox" | "production";

export interface MPConfig {
  /** Access token (Bearer). Vazio = modo MOCK. Sandbox começa com "TEST-". */
  accessToken: string;
  /** Public key (só para tokenizar cartão de TESTE no sandbox). */
  publicKey: string;
  env: MPEnv;
  baseUrl: string;
  /** Quando true, não bate na API — retorna respostas simuladas. */
  mock: boolean;
  /** User-Agent enviado nas requisições. */
  userAgent: string;
  /** Segredo do webhook (assinatura x-signature). Configurado no painel MP. */
  webhookSecret: string;
  /** Máximo de parcelas oferecidas no cartão. */
  maxInstallments: number;
}

// O MercadoPago não tem host separado de sandbox: o ambiente é definido pelo
// prefixo do token (TEST-... = sandbox). A base é sempre a mesma.
const BASE_URL = "https://api.mercadopago.com";

export function loadConfig(env: NodeJS.ProcessEnv): MPConfig {
  const accessToken = (env.MP_ACCESS_TOKEN || "").trim();
  const explicitEnv = env.MP_ENV === "production" ? "production" : env.MP_ENV === "sandbox" ? "sandbox" : null;
  // Deriva o ambiente do prefixo do token quando não informado explicitamente.
  const mpEnv: MPEnv = explicitEnv ?? (accessToken.startsWith("TEST-") ? "sandbox" : "production");
  const mock = env.MP_MOCK === "1" || !accessToken;

  return {
    accessToken,
    publicKey: (env.MP_PUBLIC_KEY || "").trim(),
    env: mpEnv,
    baseUrl: BASE_URL,
    mock,
    userAgent: env.MP_USER_AGENT || "LojaVirtual",
    webhookSecret: env.MP_WEBHOOK_SECRET || "",
    maxInstallments: Number(env.MP_MAX_INSTALLMENTS ?? 12) || 12,
  };
}
