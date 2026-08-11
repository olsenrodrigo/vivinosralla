// Adaptador local: nenhuma chamada de rede, nenhum crédito gasto.
//
// É o que torna os caminhos tristes verificáveis. HIGGSFIELD_MOCK_SCENARIO
// força erro, recusa por moderação e tempo esgotado — sem ele, esses ramos só
// seriam exercitáveis quebrando o provedor de propósito.

import type { EstudioConfig } from "./config";
import type { ImageProvider, PedidoGeracao, StatusJob } from "./types";

interface JobMock {
  concluiEm: number;
  referencias: string[];
  n: number;
}

const jobs = new Map<string, JobMock>();
let contador = 0;

/** Tempo simulado de geração. Curto o bastante para não travar teste. */
const ATRASO_MS = 2000;

export function criarMockProvider(cfg: EstudioConfig): ImageProvider {
  return {
    id: "higgsfield-mock",

    async submeter(pedido: PedidoGeracao): Promise<{ jobId: string }> {
      contador += 1;
      const jobId = `mock_${Date.now()}_${contador}`;
      jobs.set(jobId, {
        concluiEm: Date.now() + (cfg.mockScenario === "timeout" ? cfg.timeoutSeconds * 1000 * 2 : ATRASO_MS),
        referencias: pedido.referencias.map((r) => r.caminho),
        n: Math.min(Math.max(pedido.n ?? 1, 1), 4),
      });
      return { jobId };
    },

    async consultar(jobId: string): Promise<StatusJob> {
      const job = jobs.get(jobId);
      if (!job) return { status: "falhou", erro: "job_desconhecido" };
      if (Date.now() < job.concluiEm) return { status: "processando" };

      switch (cfg.mockScenario) {
        case "erro":
          return { status: "falhou", erro: "provedor_indisponivel (mock)" };
        case "recusada":
          return { status: "recusada", erro: "conteudo_recusado_pela_moderacao (mock)" };
        case "timeout":
          return { status: "processando" };
        default: {
          // Devolve a própria foto da peça: o resto do fluxo (download,
          // watermark, aprovação) exercita o caminho real sem gastar crédito.
          const origem = job.referencias[job.referencias.length - 1];
          return {
            status: "concluida",
            imagens: Array.from({ length: job.n }, () => `file://${origem}`),
            custo: 0,
          };
        }
      }
    },
  };
}
