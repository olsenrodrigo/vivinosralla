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
import fs from "fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { storage } from "../storage";

const uploadsDir = path.join(process.cwd(), "uploads");
export const provadorDir = path.join(uploadsDir, "provador");
export const origemDir = path.join(provadorDir, "origem");
export const resultadoDir = path.join(provadorDir, "resultado");

for (const d of [provadorDir, origemDir, resultadoDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

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
}
