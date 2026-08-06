// Cliente HTTP do Asaas: autenticação via header access_token, User-Agent
// obrigatório e normalização do formato de erro {errors: [{code, description}]}.
import type { AsaasConfig } from "./config";

export class AsaasError extends Error {
  status: number;
  code: string;
  body: unknown;
  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

interface AsaasApiError {
  code?: string;
  description?: string;
}

function extractError(status: number, body: unknown): AsaasError {
  const errors = (body as { errors?: AsaasApiError[] })?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const message = errors
      .map((e) => e.description || e.code)
      .filter(Boolean)
      .join(" · ");
    return new AsaasError(status, errors[0].code || "unknown", message || `HTTP ${status}`, body);
  }
  return new AsaasError(status, "http_error", `Asaas HTTP ${status}`, body);
}

export class AsaasClient {
  constructor(private readonly cfg: AsaasConfig) {}

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.cfg.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          access_token: this.cfg.apiKey,
          "User-Agent": this.cfg.userAgent,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        // GET no Asaas deve ter corpo vazio (corpo em GET pode causar 403)
        body: body !== undefined && method !== "GET" ? JSON.stringify(body) : undefined,
        // evita requisição pendurada indefinidamente numa conexão lenta
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new AsaasError(504, "timeout", "Tempo esgotado ao contatar o Asaas", null);
      }
      throw new AsaasError(502, "network_error", "Falha de rede ao contatar o Asaas", err);
    }

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw extractError(res.status, data);
    }
    return data as T;
  }

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }
  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
