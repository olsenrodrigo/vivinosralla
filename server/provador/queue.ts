// Fila de provas: submissão ao provedor, conclusão por webhook ou por polling,
// e as duas formas de uma prova morrer (erro e tempo esgotado).
//
// Webhook e polling produzem o MESMO efeito final (REQ-2.9), e ambos passam
// pela mesma função de conclusão — é o que torna a idempotência (INV-D) uma
// propriedade de um lugar só, em vez de uma regra repetida em dois caminhos.

import fs from "fs/promises";
import { storage } from "../storage";
import { getImageProvider, loadEstudioConfig, ProvedorIndisponivelError } from "../estudio/index";
import type { StatusJob } from "../estudio/index";
import {
  baixarImagem, caminhoLocalDaImagem, escolherFotoDaPeca,
  gravarResultadoComMarca, montarPrompt, resolverModelo,
} from "./service";

const INTERVALO_WORKER_MS = 3_000;
const INTERVALO_POLLER_MS = 10_000;

let rodando = false;

async function timeoutSegundos(): Promise<number> {
  const s = await storage.getStoreSettings();
  return s?.tryonTimeoutSeconds ?? 180;
}

/** Submete uma prova da fila ao provedor. */
async function processarUma(): Promise<boolean> {
  const prova = await storage.reservarProximaProva();
  if (!prova) return false;

  try {
    const foto = await storage.getTryonPhotoById(prova.photoId);
    // A foto pode ter expirado entre a solicitação e a vez dela na fila.
    if (!foto || foto.purgedAt) {
      await storage.falharProva(prova.id, "falhou", "foto_expirada");
      return true;
    }

    const peca = await escolherFotoDaPeca(prova.productId, prova.variantId);
    if (!peca) {
      await storage.falharProva(prova.id, "falhou", "peca_sem_foto");
      return true;
    }

    const settings = await storage.getStoreSettings();
    const cfg = loadEstudioConfig(process.env);
    const provider = getImageProvider(process.env);

    const webhook = cfg.publicUrl && cfg.webhookSecret
      ? { url: `${cfg.publicUrl}/api/provador/webhook/higgsfield`, secret: cfg.webhookSecret }
      : undefined;

    const { jobId } = await provider.submeter({
      modelo: resolverModelo(settings?.tryonModel ?? prova.model),
      prompt: montarPrompt(),
      // Ordem importa: a pessoa primeiro, a peça depois — é o que o prompt diz.
      referencias: [
        { caminho: foto.filePath },
        { caminho: caminhoLocalDaImagem(peca.url) },
      ],
      n: 1,
      proporcao: "3:4",
      webhook,
    });

    await storage.registrarJobDoProvedor(prova.id, jobId);
  } catch (e) {
    const msg = e instanceof ProvedorIndisponivelError ? e.message : "falha_ao_submeter";
    // Uma prova que morre não pode levar a fila junto (REQ-4.1).
    await storage.falharProva(prova.id, "falhou", msg);
  }
  return true;
}

/**
 * Fecha a prova a partir de um status do provedor. Chamada pelo webhook e pelo
 * poller — a guarda de status dentro de concluirProva/falharProva faz a segunda
 * chegada não produzir efeito (REQ-2.8).
 */
export async function aplicarStatus(provaId: number, status: StatusJob): Promise<void> {
  if (status.status === "recusada") {
    await storage.falharProva(provaId, "recusada", status.erro ?? "recusada_pela_moderacao");
    return;
  }
  if (status.status === "falhou") {
    await storage.falharProva(provaId, "falhou", status.erro ?? "falha_no_provedor");
    return;
  }
  if (status.status !== "concluida") return;

  const url = status.imagens?.[0];
  if (!url) {
    await storage.falharProva(provaId, "falhou", "provedor_sem_imagem");
    return;
  }

  const settings = await storage.getStoreSettings();
  const ttlHoras = settings?.tryonResultTtlHours ?? 168;

  let resultPath: string;
  try {
    const bytes = await baixarImagem(url, (settings?.tryonTimeoutSeconds ?? 180) * 1000);
    resultPath = await gravarResultadoComMarca(bytes);
  } catch {
    await storage.falharProva(provaId, "falhou", "falha_ao_baixar_resultado");
    return;
  }

  const ok = await storage.concluirProva(provaId, {
    resultPath,
    custo: status.custo,
    expiresAt: new Date(Date.now() + ttlHoras * 3600 * 1000),
  });

  // Entrega repetida: a prova já estava fechada. O arquivo recém-baixado vira
  // órfão e é removido aqui — sem isso, cada reentrega do webhook deixaria uma
  // cópia da imagem no disco.
  if (!ok) await fs.unlink(resultPath).catch(() => {});
}

/** Consulta as provas em andamento; conclui as prontas, mata as vencidas. */
async function pollar(): Promise<void> {
  const emAndamento = await storage.listarProvasProcessando();
  if (!emAndamento.length) return;

  const limite = await timeoutSegundos();
  const provider = getImageProvider(process.env);

  for (const prova of emAndamento) {
    const idadeS = (Date.now() - new Date(prova.createdAt).getTime()) / 1000;
    if (idadeS > limite) {
      await storage.falharProva(prova.id, "falhou", "tempo_esgotado");
      continue;
    }
    if (!prova.providerJobId) continue;
    try {
      await aplicarStatus(prova.id, await provider.consultar(prova.providerJobId));
    } catch {
      // Falha de consulta é transitória: a prova segue até estourar o timeout.
    }
  }
}

/**
 * Sobe worker e poller. O poller continua ativo mesmo com webhook configurado:
 * webhook atrasado ou perdido é concluído pela consulta, e o efeito é o mesmo.
 */
export function iniciarFilaProvador(): void {
  if (rodando) return;
  rodando = true;

  // Queda do processo deixaria prova presa em `processando` para sempre.
  timeoutSegundos()
    .then((limite) => storage.devolverProvasTravadas(new Date(Date.now() - limite * 2000)))
    .then((n) => { if (n) console.log(`[provador] ${n} prova(s) devolvida(s) à fila no boot`); })
    .catch(() => {});

  setInterval(() => { void processarUma().catch(() => {}); }, INTERVALO_WORKER_MS).unref();
  setInterval(() => { void pollar().catch(() => {}); }, INTERVALO_POLLER_MS).unref();
}

/** Só para teste: força um ciclo completo sem esperar o intervalo. */
export async function cicloManual(): Promise<void> {
  while (await processarUma()) { /* drena a fila */ }
  await pollar();
}
