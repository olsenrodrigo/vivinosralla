// Limites de uso do provador.
//
// O estúdio visual é do admin; o provador é de qualquer visitante. A diferença
// não é de grau: lá o custo é disparado por quem paga a conta, aqui por quem
// passa na rua. Sem estes limites o recurso é uma torneira aberta ligada ao
// cartão da loja.

import { storage } from "../storage";

/** Requisições por IP na janela. Vale para upload e para prova (REQ-5.1). */
const LIMITE_IP = 10;
const JANELA_MS = 60 * 60 * 1000;

const porIp = new Map<string, { n: number; expiraEm: number }>();

// Mesmo padrão do limpador do rate limit de pedidos: unref() para não segurar
// o processo vivo só por causa do timer.
setInterval(() => {
  const agora = Date.now();
  porIp.forEach((v, k) => { if (agora > v.expiraEm) porIp.delete(k); });
}, 10 * 60_000).unref();

export function ipExcedeu(ip: string): boolean {
  const agora = Date.now();
  const atual = porIp.get(ip);
  if (!atual || agora > atual.expiraEm) {
    porIp.set(ip, { n: 1, expiraEm: agora + JANELA_MS });
    return false;
  }
  atual.n += 1;
  return atual.n > LIMITE_IP;
}

/** Só para teste: zera a janela. */
export function resetLimitesIp(): void {
  porIp.clear();
}

export type MotivoBloqueio =
  | { status: 429; error: "limite_de_provas" }
  | { status: 429; error: "limite_diario_atingido" }
  | { status: 429; error: "teto_de_provas_atingido" }
  | { status: 409; error: "prova_em_andamento" };

/**
 * Checagens de custo, na ordem do mais barato para o mais caro: o teto mensal e
 * a cota diária são contagens indexadas; a prova concorrente é um join.
 */
export async function bloqueioParaNovaProva(
  sessionId: string,
  settings: { tryonMonthlyLimit: number; tryonSessionDailyLimit: number },
): Promise<MotivoBloqueio | null> {
  if (await storage.contarTryonDoMes() >= settings.tryonMonthlyLimit) {
    return { status: 429, error: "teto_de_provas_atingido" };
  }
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  if (await storage.contarTryonPorSessao(sessionId, inicioDoDia) >= settings.tryonSessionDailyLimit) {
    return { status: 429, error: "limite_diario_atingido" };
  }
  if (await storage.temProvaEmAndamento(sessionId)) {
    return { status: 409, error: "prova_em_andamento" };
  }
  return null;
}
