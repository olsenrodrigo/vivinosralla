// Registry do provedor de imagem, no padrão de server/gateway/index.ts.
// Quem consome (estúdio visual, provador virtual) fala com a interface; quem
// atende é decidido aqui pela configuração.

import { loadEstudioConfig, configParaLog, type EstudioConfig } from "./config";
import { criarHiggsfieldProvider } from "./higgsfield";
import { criarMockProvider } from "./mock";
import type { ImageProvider } from "./types";

export * from "./types";
export { loadEstudioConfig, configParaLog, type EstudioConfig };

let cache: { cfg: EstudioConfig; provider: ImageProvider } | null = null;

/**
 * Provedor ativo. A configuração é lida na primeira chamada, não em topo de
 * módulo: em produção o .env é carregado por server/env.ts antes dos imports,
 * mas ler tardio mantém o módulo testável com env trocado em tempo de execução.
 */
export function getImageProvider(env: NodeJS.ProcessEnv = process.env): ImageProvider {
  const cfg = loadEstudioConfig(env);
  if (cache && sameConfig(cache.cfg, cfg)) return cache.provider;
  const provider = cfg.mock ? criarMockProvider(cfg) : criarHiggsfieldProvider(cfg);
  cache = { cfg, provider };
  return provider;
}

function sameConfig(a: EstudioConfig, b: EstudioConfig): boolean {
  return a.mock === b.mock
    && a.mockScenario === b.mockScenario
    && a.baseUrl === b.baseUrl
    && a.apiKey === b.apiKey
    && a.apiSecret === b.apiSecret
    && a.timeoutSeconds === b.timeoutSeconds;
}

/** Só para teste: força releitura da configuração. */
export function resetImageProvider(): void {
  cache = null;
}
