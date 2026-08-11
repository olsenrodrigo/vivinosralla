// Expurgo automático das fotos e dos resultados vencidos.
//
// A retenção declarada no termo só vale se alguém a executa. Esta rotina é o
// que transforma "sua foto é apagada em 24 horas" de promessa em fato, e é a
// razão de `expires_at` ser NOT NULL na foto: a varredura não precisa saber as
// regras, só ler a data que cada linha carrega.
//
// O registro sobrevive ao arquivo, com `purged_at` preenchido: é a evidência de
// que o expurgo ocorreu. Apagar a linha deixaria a operação sem como provar que
// cumpriu o prazo.

import fs from "fs/promises";
import path from "path";
import { storage } from "../storage";

const INTERVALO_MS = 60 * 60 * 1000;

let armado = false;

async function apagarArquivo(relativo: string | null): Promise<void> {
  if (!relativo) return;
  // Tolerante a arquivo já removido: expurgo que quebra por ENOENT deixa de
  // expurgar todo o resto da rodada.
  await fs.unlink(path.resolve(process.cwd(), relativo)).catch(() => {});
}

export async function expurgarVencidos(): Promise<{ fotos: number; resultados: number }> {
  const agora = new Date();

  const resultados = await storage.listarProvasVencidas(agora);
  for (const p of resultados) await apagarArquivo(p.resultPath);
  if (resultados.length) {
    await storage.marcarProvasExpurgadas(resultados.map((p) => p.id), agora);
  }

  const fotos = await storage.listarFotosVencidas(agora);
  for (const f of fotos) await apagarArquivo(f.filePath);
  if (fotos.length) {
    await storage.marcarFotosExpurgadas(fotos.map((f) => f.id), agora);
  }

  // Contagem, nunca caminho nem token (REQ-6.9).
  if (fotos.length || resultados.length) {
    console.log(`[provador] expurgo: ${fotos.length} foto(s), ${resultados.length} resultado(s)`);
  }
  return { fotos: fotos.length, resultados: resultados.length };
}

/**
 * Roda uma vez no boot e depois de hora em hora. O boot importa: processo
 * parado a noite inteira não pode esticar a retenção prometida.
 */
export function iniciarExpurgoProvador(): void {
  if (armado) return;
  armado = true;
  void expurgarVencidos().catch(() => {});
  setInterval(() => { void expurgarVencidos().catch(() => {}); }, INTERVALO_MS).unref();
}
