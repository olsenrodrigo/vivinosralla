/**
 * Carrega o .env por efeito colateral de import.
 *
 * Imports ESM são içados: todo módulo importado é avaliado ANTES do corpo de
 * quem o importou. Enquanto o loader viveu no corpo de server/index.ts,
 * server/auth.ts já tinha avaliado `const JWT_SECRET = process.env.JWT_SECRET`
 * como undefined — e como setup/setup.sh grava o .env e o PM2 injeta só
 * NODE_ENV=production, o boot de produção morria em "JWT_SECRET é obrigatório".
 *
 * Por isso este módulo precisa ser o PRIMEIRO import de qualquer entrypoint que
 * leia variável de ambiente em topo de módulo. Ele não importa nada da aplicação
 * justamente para não arrastar ninguém para antes de si.
 */
import { readFileSync } from "fs";
import { dirname, resolve } from "path";

function candidatos(): string[] {
  const lista = [resolve(process.cwd(), ".env")];
  // Cobre processo iniciado fora do diretório da aplicação (PM2 roda
  // dist/index.cjs por caminho absoluto): dist/../.env, server/../.env,
  // script/../.env. process.argv[1] funciona tanto no tsx (ESM, sem __dirname)
  // quanto no bundle CJS (sem import.meta).
  const entrypoint = process.argv[1];
  if (entrypoint) lista.push(resolve(dirname(entrypoint), "../.env"));
  return lista;
}

function carregarEnv(): void {
  for (const caminho of candidatos()) {
    let envFile: string;
    try {
      envFile = readFileSync(caminho, "utf-8");
    } catch {
      continue;
    }
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      // Variável já presente no ambiente vence o arquivo.
      if (key && !process.env[key]) process.env[key] = val;
    }
    return;
  }
}

carregarEnv();
