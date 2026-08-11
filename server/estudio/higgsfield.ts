// Adaptador Higgsfield — fetch direto, sem SDK (decisão do dono do repo).
//
// Contrato levantado contra a API real em 2026-08-10 e CORRIGIDO em 2026-08-11,
// não contra a documentação:
//   - autenticação por DOIS headers, hf-api-key e hf-secret. Sem nenhum: 401.
//     Com chave válida e secret errado: 401. Com chave válida e SEM o header de
//     secret: 500 (bug deles). Os dois corretos: passa.
//   - `/v1/text2image/<modelo>` — o ENDPOINT é o modelo. Mandar
//     `params.model` não troca nada: o campo nem existe no schema.
//   - `soul` tem UM slot de referência (`image_reference`), e ignorou em
//     silêncio o `input_images` que este adaptador enviava. Sem referência, o
//     modelo gerava pessoa e roupa do zero — o provador devolvia um
//     desconhecido vestindo outra peça. É o bug que esta versão corrige.
//   - `seedream` exige `params.input_images` e preserva as DUAS referências
//     (pessoa + peça). É o único modelo multi-referência desta API.
//   - referência vai por URL que o provedor alcança; data URL base64 não é
//     aceita. Como uploads/provador/ não pode ser público (REQ-6.12), cada
//     referência sobe antes por /files/generate-upload-url.
//
// CAMPO DESCONHECIDO É DESCARTADO EM SILÊNCIO por esta API — foi assim que o
// bug passou despercebido. Ao mexer aqui, confira o eco de `input_params` na
// resposta da submissão: o que não aparece lá não chegou ao modelo.

import { readFile } from "fs/promises";
import type { EstudioConfig } from "./config";
import { ProvedorIndisponivelError, type ImageProvider, type PedidoGeracao, type StatusJob } from "./types";

interface RespostaUpload {
  public_url: string;
  upload_url: string;
  upload_headers?: Record<string, string>;
}

const MIME: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function mimeDe(caminho: string): string {
  const ext = caminho.toLowerCase().split(".").pop() ?? "";
  return MIME[ext] ?? "image/jpeg";
}

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

  /**
   * Sobe uma referência local e devolve a URL que o provedor alcança. O arquivo
   * vive em uploads/provador/, que é fechado ao público de propósito
   * (REQ-6.12), então não dá para só apontar uma URL nossa. O provedor marca o
   * objeto como `retention=temporary` no próprio header de upload.
   */
  async function subirReferencia(caminho: string): Promise<string> {
    const contentType = mimeDe(caminho);
    const destino = await chamar<RespostaUpload>("/files/generate-upload-url", {
      method: "POST",
      body: JSON.stringify({ content_type: contentType }),
    });

    const bytes = await readFile(caminho);
    let resposta: Response;
    try {
      resposta = await fetch(destino.upload_url, {
        method: "PUT",
        headers: destino.upload_headers ?? { "Content-Type": contentType },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(cfg.timeoutSeconds * 1000),
      });
    } catch {
      throw new ProvedorIndisponivelError("falha_no_upload_da_referencia", 502);
    }
    if (!resposta.ok) {
      throw new ProvedorIndisponivelError(`upload_recusado_${resposta.status}`, 502);
    }
    return destino.public_url;
  }

  return {
    id: "higgsfield",

    async submeter(pedido: PedidoGeracao): Promise<{ jobId: string }> {
      const modelo = pedido.modelo || cfg.modelo;
      const urls = await Promise.all(pedido.referencias.map((r) => subirReferencia(r.caminho)));

      const params: Record<string, unknown> = {
        prompt: pedido.prompt,
        input_images: urls.map((u) => ({ type: "image_url", image_url: u })),
        aspect_ratio: pedido.proporcao ?? "3:4",
        quality: "high",
        batch_size: Math.min(Math.max(pedido.n ?? 1, 1), 4),
      };

      // O webhook é query param (`hf_webhook`), não campo do corpo. A doc do
      // provedor não descreve assinatura nem segredo no callback, e a nossa
      // rota exige um: enquanto isso não se resolver, o worker conclui por
      // polling e o webhook não é registrado.
      const caminho = `/v1/text2image/${encodeURIComponent(modelo)}`;

      const r = await chamar<RespostaSubmissao>(caminho, {
        method: "POST",
        body: JSON.stringify({ params }),
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
