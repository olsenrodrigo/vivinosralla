// Configuração do conector SmartEnvios.
// Framework-agnostic: lê tudo de variáveis de ambiente para poder ser copiado
// tanto no PuraFlora (piloto) quanto no motor do whitelabellojavirtual.

export type SmartEnviosEnv = "sandbox" | "production";

export interface SenderConfig {
  name: string;
  document: string; // CNPJ da loja
  zipcode: string; // CEP de origem (só dígitos)
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  phone?: string;
  email?: string;
}

export interface StoreRules {
  /** Frete grátis a partir deste subtotal (R$). 0 = desativado. */
  freeShippingAbove: number;
  /** Desconto percentual no frete (0–100). */
  discountPercent: number;
  /** Serviços (nomes) que ficam sempre grátis, ex.: retirada. */
  freeServices: string[];
}

export type DocumentMode = "nfe" | "dc";
export type LabelDocumentType =
  | "label_integrated_danfe"
  | "label_separate_danfe";

export interface DocumentConfig {
  /** "nfe" = pedido exige NF-e (chave/XML) · "dc" = Declaração de Conteúdo. */
  mode: DocumentMode;
  /** Como a DANFE entra na etiqueta (quando há NF-e). */
  labelType: LabelDocumentType;
}

export interface SmartEnviosConfig {
  token: string;
  env: SmartEnviosEnv;
  baseUrl: string;
  /** Quando true, não bate na API — retorna cotações/etiquetas simuladas. */
  mock: boolean;
  sender: SenderConfig;
  rules: StoreRules;
  document: DocumentConfig;
}

const BASE_URLS: Record<SmartEnviosEnv, string> = {
  production: "https://api.smartenvios.com/v1",
  sandbox: "https://sandbox.api.smartenvios.com",
};

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Monta a config a partir de process.env (com defaults seguros). */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env
): SmartEnviosConfig {
  const seEnv = (env.SMARTENVIOS_ENV as SmartEnviosEnv) || "sandbox";
  const token = env.SMARTENVIOS_TOKEN?.trim() || "";
  // Sem token → modo mock automático (permite validar a UX localmente).
  const mock = env.SMARTENVIOS_MOCK === "1" || token === "";

  return {
    token,
    env: seEnv === "production" ? "production" : "sandbox",
    baseUrl: BASE_URLS[seEnv === "production" ? "production" : "sandbox"],
    mock,
    sender: {
      name: env.SENDER_NAME || "PuraFlora",
      document: env.SENDER_DOCUMENT || "",
      zipcode: (env.SENDER_ZIPCODE || "").replace(/\D/g, ""),
      street: env.SENDER_STREET || "",
      number: env.SENDER_NUMBER || "",
      neighborhood: env.SENDER_NEIGHBORHOOD || "",
      complement: env.SENDER_COMPLEMENT || "",
      phone: env.SENDER_PHONE || "",
      email: env.SENDER_EMAIL || "",
    },
    rules: {
      freeShippingAbove: num(env.FREE_SHIPPING_ABOVE, 199),
      discountPercent: num(env.SHIPPING_DISCOUNT_PERCENT, 0),
      freeServices: (env.FREE_SHIPPING_SERVICES || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
    document: {
      mode: env.DOCUMENT_MODE === "nfe" ? "nfe" : "dc",
      labelType:
        env.LABEL_DOCUMENT_TYPE === "label_separate_danfe"
          ? "label_separate_danfe"
          : "label_integrated_danfe",
    },
  };
}
