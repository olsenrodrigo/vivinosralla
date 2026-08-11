// Regras do provador: qual foto da peça alimenta a prova, que prompt vai ao
// provedor, e como o resultado vira arquivo publicável.

import path from "path";
import fs from "fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { storage } from "../storage";
import { resultadoDir } from "./paths";

/** Modelos que aceitam 2+ referências. soul_2 aceita 1: fica fora do provador. */
export const MODELOS_PERMITIDOS = ["nano_banana_pro", "gpt_image_2"] as const;
export const MODELO_PADRAO = "nano_banana_pro";

export function resolverModelo(configurado?: string | null): string {
  const m = (configurado || "").trim();
  return (MODELOS_PERMITIDOS as readonly string[]).includes(m) ? m : MODELO_PADRAO;
}

/**
 * Foto da peça que vai ao provedor, na ordem de preferência do REQ-2.3:
 * marcada como fonte de prova → imagem da variação da cor → principal → menor
 * position. A escolha é registrada em garment_image_id: a mesma peça em foto
 * diferente muda o resultado, e sem isso não dá para explicar por que mudou.
 */
export async function escolherFotoDaPeca(
  productId: number,
  variantId?: number | null,
): Promise<{ url: string; imageId: number | null } | null> {
  const imagens = await storage.getProductImages(productId);
  if (!imagens.length) return null;

  const fonte = imagens.find((i: any) => i.isTryonSource);
  if (fonte) return { url: fonte.url, imageId: fonte.id };

  if (variantId) {
    const variantes = await storage.getVariantsByProduct(productId);
    const v = variantes.find((x: any) => x.id === variantId);
    if (v?.imageUrl) {
      const casada = imagens.find((i: any) => i.url === v.imageUrl);
      return { url: v.imageUrl, imageId: casada?.id ?? null };
    }
  }

  const principal = imagens.find((i: any) => i.isMain);
  if (principal) return { url: principal.url, imageId: principal.id };

  const ordenadas = [...imagens].sort((a: any, b: any) => a.position - b.position);
  return { url: ordenadas[0].url, imageId: ordenadas[0].id };
}

/** URL da galeria (`/uploads/...`) → caminho no volume local. */
export function caminhoLocalDaImagem(url: string): string {
  const limpa = url.replace(/^\/+/, "");
  return path.join(process.cwd(), limpa);
}

/**
 * Prompt fixo, não editável pela cliente: campo livre chegando ao provedor a
 * partir de uma rota pública é injeção de prompt com foto de pessoa junto.
 */
export function montarPrompt(): string {
  return [
    "Vista a pessoa da primeira imagem com a peça de roupa da segunda imagem.",
    "Preserve o rosto, o corpo, o tom de pele e a pose da pessoa exatamente como estão.",
    "Ajuste o caimento da peça ao corpo de forma realista.",
    "Fundo limpo e neutro, luz suave de estúdio, enquadramento de corpo inteiro.",
  ].join(" ");
}

const MARCA = "Simulação · IA";

/**
 * Grava o resultado com a marca de simulação queimada no arquivo.
 *
 * O rótulo na tela (REQ-3.3) sai do print, do compartilhamento e do salvar-como;
 * a marca no arquivo não. Quem receber a imagem por WhatsApp continua sabendo
 * que aquilo é simulação — que é exatamente onde a confusão custaria uma
 * devolução.
 */
export async function gravarResultadoComMarca(imagem: Buffer): Promise<string> {
  const nome = `${randomUUID()}.jpg`;
  const destino = path.join(resultadoDir, nome);

  // 3:4, a proporção que a vitrine assume. As dimensões são fixas de propósito:
  // metadata() num pipeline devolve o tamanho da ENTRADA, não o da saída
  // redimensionada — usá-lo aqui punha a faixa no meio da imagem.
  const LARGURA = 1152;
  const ALTURA = 1536;
  const base = sharp(imagem).rotate().resize({
    width: LARGURA, height: ALTURA, fit: "cover", position: "attention",
  });
  const width = LARGURA;
  const height = ALTURA;

  const faixaAltura = Math.round(height * 0.055);
  const fonte = Math.round(faixaAltura * 0.5);
  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${height - faixaAltura}" width="${width}" height="${faixaAltura}"
            fill="rgba(0,0,0,0.55)"/>
      <text x="${Math.round(width / 2)}" y="${height - Math.round(faixaAltura * 0.32)}"
            font-family="Helvetica, Arial, sans-serif" font-size="${fonte}"
            fill="#ffffff" text-anchor="middle" letter-spacing="1">${MARCA}</text>
    </svg>`);

  await base
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toFile(destino);

  return path.relative(process.cwd(), destino);
}

/** Baixa a imagem do provedor. `file://` vem do mock e é lida do disco. */
export async function baixarImagem(url: string, timeoutMs: number): Promise<Buffer> {
  if (url.startsWith("file://")) {
    return fs.readFile(url.slice("file://".length));
  }
  const resposta = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!resposta.ok) throw new Error(`download_falhou_${resposta.status}`);
  return Buffer.from(await resposta.arrayBuffer());
}
