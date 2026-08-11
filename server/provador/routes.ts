// Provador Virtual — rotas públicas.
//
// A titular aqui é uma sessão anônima, não uma usuária logada, e o que ela
// envia é uma foto do próprio corpo. Duas consequências que valem para todo
// este módulo:
//   - nenhuma resposta pública devolve id serial (REQ-3.7); o endereço de tudo
//     é o token UUIDv4;
//   - nada de caminho de arquivo, token ou credencial vai para log (REQ-6.9).

import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { storage } from "../storage";
import { origemDir, resultadoDir } from "./paths";
import { escolherFotoDaPeca, resolverModelo } from "./service";
import { aplicarStatus, iniciarFilaProvador } from "./queue";
import { iniciarExpurgoProvador } from "./purge";
import { getImageProvider, loadEstudioConfig } from "../estudio/index";
import { bloqueioParaNovaProva, ipExcedeu } from "./limites";
import fs from "fs";
import fsp from "fs/promises";


const MAX_BYTES = 10 * 1024 * 1024;
/** Sem .gif: o filtro do catálogo aceita, o do provador não (REQ-1.5). */
const EXTENSOES = [".jpg", ".jpeg", ".png", ".webp"];
const MIMES = ["image/jpeg", "image/png", "image/webp"];
/** Maior lado da foto saneada. */
const LADO_MAX = 1536;

/** Erro de formato tem de virar 400 com corpo próprio, não rejeição silenciosa. */
class FormatoInvalidoError extends Error {}

const uploadFoto = multer({
  // Memória, não disco: o arquivo cru da cliente não chega a tocar o volume —
  // só a versão saneada por sharp é gravada.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const extOk = EXTENSOES.includes(path.extname(file.originalname).toLowerCase());
    const mimeOk = MIMES.includes(file.mimetype);
    if (!extOk || !mimeOk) return cb(new FormatoInvalidoError());
    cb(null, true);
  },
}).single("file");

const consentimentoSchema = z.object({
  consentimento: z.literal("aceito"),
  maioridade: z.literal("sim"),
  termoVersao: z.string().min(1).max(40),
});

export function registerProvadorRoutes(app: Express): void {
  app.post("/api/provador/:sessionId/foto", (req: Request, res: Response) => {
    uploadFoto(req, res, async (err: unknown) => {
      if (err instanceof FormatoInvalidoError) {
        return res.status(400).json({ error: "formato_invalido" });
      }
      if (err && (err as any).code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "arquivo_muito_grande" });
      }
      if (err) return res.status(400).json({ error: "upload_invalido" });

      try {
        const settings = await storage.getStoreSettings();
        // Kill-switch: com o recurso desligado a rota não existe (REQ-5.6).
        if (!settings?.tryonEnabled) return res.status(404).json({ error: "nao_encontrado" });

        if (ipExcedeu(ipDe(req))) return res.status(429).json({ error: "limite_de_provas" });

        // Consentimento é conferido ANTES de qualquer escrita: sem as duas
        // marcações, nada da foto toca o disco (REQ-1.4).
        const parsed = consentimentoSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "consentimento_ausente" });

        const arquivo = (req as any).file as Express.Multer.File | undefined;
        if (!arquivo) return res.status(400).json({ error: "formato_invalido" });

        const sessionId = String(req.params.sessionId || "").trim();
        if (!sessionId || sessionId.length > 100) {
          return res.status(400).json({ error: "sessao_invalida" });
        }

        const nome = `${randomUUID()}.jpg`;
        const destino = path.join(origemDir, nome);

        // rotate() aplica a orientação que vinha no EXIF antes de descartá-lo —
        // sem isso a foto de celular chega deitada. A ausência de
        // withMetadata() é o que joga fora EXIF e GPS (REQ-1.7).
        try {
          await sharp(arquivo.buffer)
            .rotate()
            .resize({ width: LADO_MAX, height: LADO_MAX, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toFile(destino);
        } catch {
          // Arquivo com extensão certa e conteúdo que não é imagem cai aqui.
          return res.status(400).json({ error: "formato_invalido" });
        }

        const horas = settings.tryonPhotoTtlHours ?? 24;
        const expiraEm = new Date(Date.now() + horas * 3600 * 1000);
        const token = randomUUID();

        await storage.criarTryonPhoto({
          token,
          sessionId,
          filePath: path.relative(process.cwd(), destino),
          consentVersion: parsed.data.termoVersao,
          consentedAt: new Date(),
          adultDeclared: true,
          expiresAt: expiraEm,
        });

        // Nenhum id serial na resposta (REQ-1.8, REQ-3.7).
        return res.status(201).json({ fotoToken: token, expiraEm: expiraEm.toISOString() });
      } catch (e) {
        // Mensagem genérica no log: caminho de arquivo e token não entram.
        console.error("[provador] falha ao processar upload");
        return res.status(500).json({ error: "erro_interno" });
      }
    });
  });
  // ── Solicitar a prova ────────────────────────────────────────────────────
  const provaSchema = z.object({
    fotoToken: z.string().uuid(),
    productId: z.number().int().positive(),
    variantId: z.number().int().positive().optional(),
  });

  app.post("/api/provador/:sessionId/prova", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getStoreSettings();
      if (!settings?.tryonEnabled) return res.status(404).json({ error: "nao_encontrado" });

      if (ipExcedeu(ipDe(req))) return res.status(429).json({ error: "limite_de_provas" });

      const parsed = provaSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "dados_invalidos" });
      const { fotoToken, productId, variantId } = parsed.data;
      const sessionId = String(req.params.sessionId || "").trim();

      // Busca por token E sessão: foto de outra sessão responde igual a foto
      // inexistente, sem revelar qual dos dois é o caso (REQ-2.2, INV-A).
      const foto = await storage.getTryonPhotoByToken(fotoToken, sessionId);
      if (!foto || foto.purgedAt || foto.expiresAt.getTime() < Date.now()) {
        return res.status(404).json({ error: "nao_encontrado" });
      }

      // Só peça publicada: o provador não é porta dos fundos para o rascunho.
      const produtos = await storage.listProducts({ status: "active", published: true, limit: 1000 });
      const peca = produtos.products.find((p: any) => p.id === productId);
      if (!peca) return res.status(404).json({ error: "nao_encontrado" });

      if (variantId != null) {
        // Variante validada contra o produto dono dela (INV-C).
        const variantes = await storage.getVariantsByProduct(productId);
        if (!variantes.some((v: any) => v.id === variantId && v.active)) {
          return res.status(404).json({ error: "nao_encontrado" });
        }
      }

      // Custo antes de trabalho: teto mensal, cota diária e prova concorrente.
      const bloqueio = await bloqueioParaNovaProva(sessionId, {
        tryonMonthlyLimit: settings.tryonMonthlyLimit,
        tryonSessionDailyLimit: settings.tryonSessionDailyLimit,
      });
      if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

      const fotoPeca = await escolherFotoDaPeca(productId, variantId);
      if (!fotoPeca) return res.status(422).json({ error: "peca_sem_foto" });

      const prova = await storage.criarTryonGeneration({
        token: randomUUID(),
        photoId: foto.id,
        productId,
        variantId: variantId ?? null,
        garmentImageId: fotoPeca.imageId,
        model: resolverModelo(settings.tryonModel),
      });

      return res.status(202).json({ provaToken: prova.token, status: prova.status });
    } catch {
      console.error("[provador] falha ao criar prova");
      return res.status(500).json({ error: "erro_interno" });
    }
  });

  // ── Webhook de conclusão ─────────────────────────────────────────────────
  app.post("/api/provador/webhook/higgsfield", async (req: Request, res: Response) => {
    const cfg = loadEstudioConfig(process.env);
    const enviado = String(req.headers["hf-webhook-secret"] ?? req.query.secret ?? "");
    // Comparação de tempo constante, mesmo padrão do webhook do Asaas.
    const ok = Boolean(cfg.webhookSecret) && enviado.length === cfg.webhookSecret.length
      && timingSafeEqual(Buffer.from(enviado), Buffer.from(cfg.webhookSecret));
    if (!ok) return res.status(401).json({ error: "nao_autorizado" });

    const jobId = String((req.body as any)?.id ?? (req.body as any)?.job_id ?? "");
    if (!jobId) return res.status(400).json({ error: "evento_invalido" });

    const prova = await storage.getProvaPorJobDoProvedor(jobId);
    // Evento órfão termina em 200: reentrega de job desconhecido não é erro do
    // provedor, e devolver 5xx faria o Higgsfield reenviar para sempre.
    if (!prova) return res.status(200).json({ ok: true });

    try {
      // O corpo do webhook não é fonte de verdade: relemos o status no provedor.
      // Assim um POST forjado com o segredo certo não consegue plantar imagem.
      const status = await getImageProvider(process.env).consultar(jobId);
      await aplicarStatus(prova.id, status);
    } catch {
      console.error("[provador] falha ao aplicar webhook");
    }
    return res.status(200).json({ ok: true });
  });

  // ── Status da prova ──────────────────────────────────────────────────────
  app.get("/api/provador/prova/:provaToken", async (req: Request, res: Response) => {
    const par = await storage.getProvaComFoto(String(req.params.provaToken || ""));
    // Expirada, expurgada ou inexistente respondem igual (REQ-3.6, REQ-6.5).
    if (!par || par.prova.purgedAt || vencida(par.prova.expiresAt)) {
      return res.status(404).json({ error: "nao_encontrado" });
    }
    const { prova } = par;
    return res.json({
      status: prova.status,
      // O caminho no disco não sai daqui: a imagem vem por rota com token.
      resultadoUrl: prova.status === "concluida" ? `/api/provador/resultado/${prova.token}` : undefined,
      erro: prova.errorMessage ?? undefined,
      variantId: prova.variantId ?? undefined,
    });
  });

  // ── Bytes do resultado ───────────────────────────────────────────────────
  app.get("/api/provador/resultado/:provaToken", async (req: Request, res: Response) => {
    const par = await storage.getProvaComFoto(String(req.params.provaToken || ""));
    if (!par || par.prova.purgedAt || vencida(par.prova.expiresAt)
        || par.prova.status !== "concluida" || !par.prova.resultPath) {
      return res.status(404).json({ error: "nao_encontrado" });
    }
    const caminho = path.resolve(process.cwd(), par.prova.resultPath);
    // Defesa em profundidade: o caminho vem do banco, mas confinar em
    // resultadoDir impede que uma linha adulterada sirva arquivo arbitrário.
    if (!caminho.startsWith(resultadoDir) || !fs.existsSync(caminho)) {
      return res.status(404).json({ error: "nao_encontrado" });
    }
    // Imagem de corpo de pessoa não entra em cache de navegador nem de proxy.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "image/jpeg");
    return res.sendFile(caminho);
  });

  // ── Direito de exclusão da titular ───────────────────────────────────────
  app.delete("/api/provador/:sessionId/foto/:fotoToken", async (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId || "").trim();
    const foto = await storage.getTryonPhotoByToken(String(req.params.fotoToken || ""), sessionId);
    // Foto de outra sessão responde como inexistente (INV-A).
    if (!foto) return res.status(404).json({ error: "nao_encontrado" });

    // Executa imediatamente o que o expurgo faria: apaga os arquivos e marca o
    // registro. A linha fica como evidência de que o expurgo ocorreu.
    const resultados = await storage.listarArquivosDaFoto(foto.id);
    for (const rel of [...resultados, foto.filePath]) {
      await fsp.unlink(path.resolve(process.cwd(), rel)).catch(() => {});
    }
    await storage.marcarExpurgado(foto.id);
    return res.status(204).send();
  });

  iniciarFilaProvador();
  iniciarExpurgoProvador();
}

function ipDe(req: Request): string {
  return req.ip || req.socket.remoteAddress || "desconhecido";
}

function vencida(expiresAt: Date | null): boolean {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}
