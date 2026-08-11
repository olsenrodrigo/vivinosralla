// Adaptador Higgsfield — fetch direto, sem SDK (decisão do dono do repo).
//
// Contrato levantado contra a API real em 2026-08-10, não contra a documentação:
//   - autenticação por DOIS headers, hf-api-key e hf-secret. Sem nenhum: 401.
//     Com chave válida e secret errado: 401. Com chave válida e SEM o header de
//     secret: 500 (bug deles). Os dois corretos: passa.
//   - POST /v1/text2image/soul devolve 422 com o campo faltando quando o corpo
//     está incompleto, e 403 {"detail":"Not enough credits"} sem saldo de API.
//   - width_and_height é enumerado; 1536x2048 é o 3:4 da vitrine.
//
// A spec do provador previa "Authorization: key_id:key_secret" — divergência
// registrada e resolvida pela realidade da API.

import { readFile } from "fs/promises";
import type { EstudioConfig } from "./config";
import { ProvedorIndisponivelError, type ImageProvider, type PedidoGeracao, type StatusJob } from "./types";

/** Proporção → resolução aceita pela API (lista devolvida pelo próprio 422). */
const RESOLUCAO: Record<NonNullable<PedidoGeracao["proporcao"]>, string> = {
  "3:4": "1536x2048",
  "1:1": "1536x1536",
  "9:16": "1152x2048",
};

interface RespostaSubmissao {
  id?: string;
  job_id?: string;
  jobs?: { id?: string }[];
}

interface RespostaStatus {
  status?: string;
  jobs?: { status?: string; results?: { raw?: { url?: string }; min?: { url?: string } } }[];
  results?: { raw?: { url?: string } };
  cost?: number;
  error?: string;
  detail?: string;
}

const STATUS_PROVEDOR: Record<string, StatusJob["status"]> = {
  queued: "na_fila",
  pending: "na_fila",
  in_progress: "processando",
  processing: "processando",
  completed: "concluida",
  succeeded: "concluida",
  failed: "falhou",
  canceled: "falhou",
  nsfw: "recusada",
  rejected: "recusada",
};

export function criarHiggsfieldProvider(cfg: EstudioConfig): ImageProvider {
  async function chamar<T>(caminho: string, init: RequestInit): Promise<T> {
    if (!cfg.apiKey || !cfg.apiSecret) {
      throw new ProvedorIndisponivelError("provedor_nao_configurado");
    }
    let resposta: Response;
    try {
      resposta = await fetch(`${cfg.baseUrl}${caminho}`, {
        ...init,
        headers: {
          "hf-api-key": cfg.apiKey,
          "hf-secret": cfg.apiSecret,
          "Content-Type": "application/json",
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: AbortSignal.timeout(cfg.timeoutSeconds * 1000),
      });
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") {
        throw new ProvedorIndisponivelError("tempo_esgotado", 504);
      }
      throw new ProvedorIndisponivelError("falha_de_rede", 502);
    }

    const texto = await resposta.text();
    let corpo: any = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      corpo = texto;
    }

    if (!resposta.ok) {
      // A mensagem do provedor entra no erro; a credencial nunca.
      const detalhe = typeof corpo?.detail === "string" ? corpo.detail : `HTTP ${resposta.status}`;
      if (resposta.status === 401) throw new ProvedorIndisponivelError("credencial_recusada", 401);
      if (resposta.status === 403) throw new ProvedorIndisponivelError(`sem_credito: ${detalhe}`, 403);
      throw new ProvedorIndisponivelError(detalhe, resposta.status);
    }
    return corpo as T;
  }

  return {
    id: "higgsfield",

    async submeter(pedido: PedidoGeracao): Promise<{ jobId: string }> {
      // As referências vão como data URL: os arquivos vivem no volume local e o
      // provedor não alcança uploads/ deste servidor.
      const referencias = await Promise.all(
        pedido.referencias.map(async (r) => {
          const bytes = await readFile(r.caminho);
          const ext = r.caminho.toLowerCase().endsWith(".png") ? "png"
            : r.caminho.toLowerCase().endsWith(".webp") ? "webp" : "jpeg";
          return { type: "image_url", image_url: `data:image/${ext};base64,${bytes.toString("base64")}` };
        }),
      );

      const params: Record<string, unknown> = {
        model: pedido.modelo || cfg.modelo,
        prompt: pedido.prompt,
        width_and_height: RESOLUCAO[pedido.proporcao ?? "3:4"],
        batch_size: Math.min(Math.max(pedido.n ?? 1, 1), 4),
        enhance_prompt: false,
      };
      if (referencias.length) params.input_images = referencias;

      const corpo: Record<string, unknown> = { params };
      // Webhook só quando há URL pública: em dev o worker faz polling.
      if (pedido.webhook?.url) {
        corpo.webhook = { url: pedido.webhook.url, secret: pedido.webhook.secret };
      }

      const r = await chamar<RespostaSubmissao>("/v1/text2image/soul", {
        method: "POST",
        body: JSON.stringify(corpo),
      });
      const jobId = r.id ?? r.job_id ?? r.jobs?.[0]?.id;
      if (!jobId) throw new ProvedorIndisponivelError("resposta_sem_job_id", 502);
      return { jobId };
    },

    async consultar(jobId: string): Promise<StatusJob> {
      const r = await chamar<RespostaStatus>(`/v1/job-sets/${encodeURIComponent(jobId)}`, { method: "GET" });
      const bruto = (r.jobs?.[0]?.status ?? r.status ?? "").toLowerCase();
      const status = STATUS_PROVEDOR[bruto] ?? "processando";
      const imagens = (r.jobs ?? [])
        .map((j) => j.results?.raw?.url ?? j.results?.min?.url)
        .filter((u): u is string => Boolean(u));
      return {
        status,
        imagens: imagens.length ? imagens : undefined,
        custo: typeof r.cost === "number" ? r.cost : undefined,
        erro: status === "falhou" || status === "recusada" ? (r.error ?? r.detail ?? bruto) : undefined,
      };
    },
  };
}
