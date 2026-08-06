// Cliente HTTP fino para a API SmartEnvios.
// Autenticação: header `token` (identificador estático, sem prefixo Bearer).
import type { SmartEnviosConfig } from "./config";

export class SmartEnviosError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "SmartEnviosError";
    this.status = status;
    this.body = body;
  }
}

export class SmartEnviosClient {
  constructor(private readonly cfg: SmartEnviosConfig) {}

  async request<T = unknown>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    opts: { body?: unknown; query?: Record<string, string | undefined>; headers?: Record<string, string> } = {}
  ): Promise<T> {
    if (!this.cfg.token) {
      throw new SmartEnviosError(401, "SMARTENVIOS_TOKEN não configurado", null);
    }
    const url = new URL(this.cfg.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query || {})) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          token: this.cfg.token,
          ...opts.headers,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      throw new SmartEnviosError(0, `Falha de rede: ${(err as Error).message}`, null);
    }

    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* mantém texto cru */
    }

    if (!res.ok) {
      const d = data as any;
      const raw =
        d?.message ??
        d?.error ??
        d?.results?.[0]?.reason ?? // /labels: {results:[{status:"ERROR",reason}]}
        d?.result?.reason;
      const msg = Array.isArray(raw)
        ? raw.join("; ")
        : raw || `SmartEnvios ${res.status}`;
      throw new SmartEnviosError(res.status, msg, data);
    }
    return data as T;
  }
}
