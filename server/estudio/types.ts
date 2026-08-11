// Interface de geração de imagem por IA, compartilhada pelo Estúdio Visual
// (catálogo, com aprovação de admin) e pelo Provador Virtual (prova efêmera
// para a cliente). O contrato interno do sistema é esta interface — trocar de
// provedor não deve tocar em fila, aprovação nem galeria.

// Modelos liberados. O provador exige >= 2 referências (pessoa + peça), e na
// API REST do Higgsfield o ENDPOINT é o modelo: `/v1/text2image/<modelo>`.
// Levantado contra a API real em 2026-08-11: `soul` responde 422 e todo o
// resto responde `model_not_found`, exceto `seedream` — que exige
// `params.input_images` e preserva as duas referências. `nano_banana_pro` e
// `gpt_image_2` existem no app do provedor, mas não nesta API.
export const MODELOS_MULTI_REFERENCIA = ["seedream"] as const;

export interface PedidoGeracao {
  /** ID do modelo no provedor. */
  modelo: string;
  /** Prompt já montado pelo consumidor: preset no estúdio, template fixo no provador. */
  prompt: string;
  /** Imagens locais já saneadas. Estúdio: 1 (a peça). Provador: 2 (pessoa + peça). */
  referencias: { caminho: string }[];
  /** Variações pedidas. O provador fixa 1; o estúdio usa até 4. */
  n?: number;
  /** Proporção da saída. A vitrine assume 3:4. */
  proporcao?: "3:4" | "1:1" | "9:16";
  /** Conclusão assíncrona, quando o provedor e o ambiente suportam. */
  webhook?: { url: string; secret: string };
}

export type StatusGeracao =
  | "na_fila"
  | "processando"
  | "concluida"
  | "falhou"
  /** Recusada pela moderação do provedor — caminho distinto de "falhou". */
  | "recusada";

export interface StatusJob {
  status: StatusGeracao;
  /** URLs de download no provedor, quando concluída. */
  imagens?: string[];
  /** Custo informado pelo provedor, quando informado. */
  custo?: number;
  erro?: string;
}

export interface ImageProvider {
  readonly id: string;
  submeter(pedido: PedidoGeracao): Promise<{ jobId: string }>;
  consultar(jobId: string): Promise<StatusJob>;
}

/** Provedor indisponível ou credencial ausente — distinto de falha de geração. */
export class ProvedorIndisponivelError extends Error {
  readonly status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "ProvedorIndisponivelError";
    this.status = status;
  }
}
