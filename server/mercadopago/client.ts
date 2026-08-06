// Cliente HTTP do MercadoPago: autenticação via Bearer, X-Idempotency-Key nos
// POSTs e normalização do formato de erro { message, error, cause: [...] }.
import { randomUUID } from "node:crypto";
import type { MPConfig } from "./config";

export class MPError extends Error {
  status: number;
  code: string;
  body: unknown;
  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = "MPError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

interface MPApiCause {
  code?: string | number;
  description?: string;
}

function extractError(status: number, body: unknown): MPError {
  const b = body as { message?: string; error?: string; cause?: MPApiCause[] } | null;
  const cause = Array.isArray(b?.cause) ? b!.cause : [];
  const causeMsg = cause
    .map((c) => c.description || (c.code != null ? String(c.code) : ""))
    .filter(Boolean)
    .join(" · ");
  const message = causeMsg || b?.message || b?.error || `MercadoPago HTTP ${status}`;
  const code = cause[0]?.code != null ? String(cause[0].code) : b?.error || "http_error";
  return new MPError(status, code, message, body);
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Chave de idempotência (recomendada em POST /v1/payments). */
  idempotencyKey?: string;
}

export class MPClient {
  constructor(private readonly cfg: MPConfig) {}

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const url = new URL(this.cfg.baseUrl + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.accessToken}`,
      "User-Agent": this.cfg.userAgent,
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    // X-Idempotency-Key: exigida nos POST do MP; UUID novo por TENTATIVA (o
    // chamador pode passar uma chave estável só para retransmitir a mesma tentativa).
    if (method === "POST") headers["X-Idempotency-Key"] = opts.idempotencyKey ?? randomUUID();
    else if (opts.idempotencyKey) headers["X-Idempotency-Key"] = opts.idempotencyKey;

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.body !== undefined && method !== "GET" ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new MPError(504, "timeout", "Tempo esgotado ao contatar o MercadoPago", null);
      }
      throw new MPError(502, "network_error", "Falha de rede ao contatar o MercadoPago", err);
    }

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) throw extractError(res.status, data);
    return data as T;
  }

  get<T = unknown>(path: string, query?: RequestOptions["query"]) {
    return this.request<T>("GET", path, { query });
  }
  post<T = unknown>(path: string, body?: unknown, idempotencyKey?: string) {
    return this.request<T>("POST", path, { body, idempotencyKey });
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body });
  }
  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
