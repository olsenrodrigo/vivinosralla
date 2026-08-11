// Configuração do conector Higgsfield (geração de imagem por IA).
// Framework-agnostic: lê tudo de variáveis de ambiente, no mesmo padrão de
// server/asaas/config.ts e server/mercadopago/config.ts.

export interface EstudioConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  /** Sem credencial completa, ou HIGGSFIELD_MOCK=1: não bate na rede. */
  mock: boolean;
  /** Cenário forçado no mock: ok | erro | recusada | timeout. */
  mockScenario: "ok" | "erro" | "recusada" | "timeout";
  modelo: string;
  timeoutSeconds: number;
  /** URL pública para o webhook de conclusão; vazio = só polling. */
  publicUrl: string;
  webhookSecret: string;
}

const BASE_URL = "https://platform.higgsfield.ai";

const CENARIOS = ["ok", "erro", "recusada", "timeout"] as const;

export function loadEstudioConfig(env: NodeJS.ProcessEnv): EstudioConfig {
  const apiKey = (env.HIGGSFIELD_API_KEY || "").trim();
  const apiSecret = (env.HIGGSFIELD_API_SECRET || "").trim();
  const cenario = CENARIOS.includes(env.HIGGSFIELD_MOCK_SCENARIO as any)
    ? (env.HIGGSFIELD_MOCK_SCENARIO as EstudioConfig["mockScenario"])
    : "ok";

  return {
    apiKey,
    apiSecret,
    // Credencial pela metade é o mesmo que credencial ausente: a API do
    // Higgsfield confere as duas, e mandar só a chave devolve 500.
    mock: env.HIGGSFIELD_MOCK === "1" || !apiKey || !apiSecret,
    mockScenario: cenario,
    baseUrl: (env.HIGGSFIELD_BASE_URL || BASE_URL).replace(/\/$/, ""),
    modelo: (env.HIGGSFIELD_MODEL || "nano_banana_pro").trim(),
    timeoutSeconds: Number(env.HIGGSFIELD_TIMEOUT_SECONDS ?? 120) || 120,
    publicUrl: (env.PUBLIC_URL || "").replace(/\/$/, ""),
    webhookSecret: (env.HIGGSFIELD_WEBHOOK_SECRET || "").trim(),
  };
}

/** Nunca logar credencial (REQ-6.10 / regra 9 do harness). */
export function configParaLog(cfg: EstudioConfig): Record<string, unknown> {
  return {
    baseUrl: cfg.baseUrl,
    mock: cfg.mock,
    mockScenario: cfg.mock ? cfg.mockScenario : undefined,
    modelo: cfg.modelo,
    timeoutSeconds: cfg.timeoutSeconds,
    temCredencial: Boolean(cfg.apiKey && cfg.apiSecret),
  };
}
