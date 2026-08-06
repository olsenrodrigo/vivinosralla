/**
 * Popula a loja VIVI NOSRALLA: configurações, categorias, produtos, variantes,
 * imagens, cupom de boas-vindas e zonas de frete.
 *
 * Uso:  npm run seed          (limpa o catálogo e recria)
 *       npm run seed -- --keep  (mantém o que já existe, só adiciona o que falta)
 *
 * Convenção de variantes: option1 = Tamanho, option2 = Cor.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Carrega o .env antes de qualquer import que toque no banco
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key && !process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
} catch {}

import { sql } from "drizzle-orm";
import { db } from "../server/storage";
import {
  categories, products, productImages, productAttributes, variants,
  storeSettings, coupons, shippingZones, shippingRates, productRelations,
} from "@shared/schema";
import { CATEGORIAS, PRODUTOS, CORES } from "./catalogo";

const KEEP = process.argv.includes("--keep");
const IMG = (arquivo: string) => `/uploads/produtos/${arquivo}`;

/** SKU no padrão VN-<CATEGORIA>-<SEQ>[-<TAM>-<COR>] */
function sku(categoria: string, seq: number, tamanho?: string, cor?: string) {
  const cat = categoria.slice(0, 3).toUpperCase();
  const base = `VN-${cat}-${String(seq).padStart(3, "0")}`;
  if (!tamanho) return base;
  const c = cor!.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return `${base}-${tamanho}-${c}`;
}

/** Estoque plausível: tamanhos do meio da grade saem mais, então têm mais peças. */
function estoque(tamanho: string) {
  const meio = ["P", "M", "G"].includes(tamanho);
  return meio ? 4 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3);
}

async function limparCatalogo() {
  console.log("Limpando catálogo anterior…");
  // ordem respeita as FKs
  await db.execute(sql`TRUNCATE TABLE
    product_relations, product_images, product_attributes, variants, products, categories
    RESTART IDENTITY CASCADE`);
}

async function seedConfiguracoes() {
  const dados = {
    storeName: "VIVI NOSRALLA",
    storeDescription:
      "Moda feminina atemporal para mulheres objetivas. Alfaiataria, tricô e peças de festa em Monte Alto (SP), com envio para todo o Brasil.",
    logoUrl: "/brand/logo-vn-oliva.svg",
    faviconUrl: "/brand/favicon.svg",
    primaryColor: "#6d7561",
    secondaryColor: "#6b2336",
    accentColor: "#ad2a4c",
    contactEmail: "contato@vivinosralla.com.br",
    contactPhone: "1699173-7463",
    contactWhatsapp: "5516991737463",
    address: "Monte Alto — SP",
    freeShippingAbove: "399.00",
    maxInstallments: 6,
    freeInstallments: 3,
    reviewsEnabled: true,
    reviewsRequireModeration: true,
  };

  const existente = await db.select({ id: storeSettings.id }).from(storeSettings).limit(1);
  if (existente.length) {
    await db.update(storeSettings).set(dados).where(sql`${storeSettings.id} = ${existente[0].id}`);
  } else {
    await db.insert(storeSettings).values(dados);
  }
  console.log("✓ Configurações da loja");
}

async function seedCategorias() {
  const mapa = new Map<string, number>();
  for (let i = 0; i < CATEGORIAS.length; i++) {
    const c = CATEGORIAS[i];
    const [row] = await db.insert(categories).values({
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: IMG(c.imagem),
      sortOrder: i + 1,
      active: true,
    }).returning({ id: categories.id });
    mapa.set(c.slug, row.id);
  }
  console.log(`✓ ${CATEGORIAS.length} categorias`);
  return mapa;
}

async function seedProdutos(catIds: Map<string, number>) {
  const idsPorSlug = new Map<string, number>();
  const porCategoria = new Map<string, number[]>();

  for (let i = 0; i < PRODUTOS.length; i++) {
    const p = PRODUTOS[i];
    const categoryId = catIds.get(p.categoria);
    if (!categoryId) throw new Error(`Categoria desconhecida: ${p.categoria} (${p.slug})`);

    const [prod] = await db.insert(products).values({
      categoryId,
      title: p.titulo,
      slug: p.slug,
      description: p.descricao,
      brand: "Vivi Nosralla",
      type: p.categoria,
      tags: p.tags.join(", "),
      sku: sku(p.categoria, i + 1),
      price: p.preco.toFixed(2),
      compareAtPrice: p.precoDe ? p.precoDe.toFixed(2) : null,
      weightG: p.pesoG,
      requiresShipping: true,
      trackInventory: true,
      stockQuantity: 0, // recalculado abaixo a partir das variantes
      status: "active",
      published: true,
      featured: !!p.destaque,
      freeShipping: p.preco >= 399,
      seoTitle: `${p.titulo} | VIVI NOSRALLA`,
      seoDescription: p.descricao.slice(0, 155),
    }).returning({ id: products.id });

    idsPorSlug.set(p.slug, prod.id);
    porCategoria.set(p.categoria, [...(porCategoria.get(p.categoria) ?? []), prod.id]);

    // Atributos que definem a grade
    await db.insert(productAttributes).values([
      { productId: prod.id, name: "Tamanho", position: 0 },
      { productId: prod.id, name: "Cor", position: 1 },
    ]);

    // Imagens
    await db.insert(productImages).values(
      p.imagens.map((arquivo: string, idx: number) => ({
        productId: prod.id,
        url: IMG(arquivo),
        altText: `${p.titulo} — Vivi Nosralla`,
        position: idx,
        isMain: idx === 0,
      }))
    );

    // Grade tamanho × cor
    let total = 0;
    const linhas = [];
    for (const cor of p.cores) {
      if (!CORES[cor]) throw new Error(`Cor sem hex no catálogo: "${cor}" (${p.slug})`);
      for (const tamanho of p.tamanhos) {
        const qtd = estoque(tamanho);
        total += qtd;
        linhas.push({
          productId: prod.id,
          sku: sku(p.categoria, i + 1, tamanho, cor),
          price: p.preco.toFixed(2),
          compareAtPrice: p.precoDe ? p.precoDe.toFixed(2) : null,
          weightG: p.pesoG,
          stockQuantity: qtd,
          option1: tamanho,
          option2: cor,
          imageUrl: IMG(p.imagens[0]),
          active: true,
        });
      }
    }
    await db.insert(variants).values(linhas);
    await db.update(products).set({ stockQuantity: total }).where(sql`${products.id} = ${prod.id}`);
  }

  console.log(`✓ ${PRODUTOS.length} produtos com variantes e imagens`);
  return { idsPorSlug, porCategoria };
}

/** "Complete o look": liga cada produto a outros dois da mesma categoria. */
async function seedRelacionados(porCategoria: Map<string, number[]>) {
  const linhas: { productId: number; relatedProductId: number; sortOrder: number }[] = [];
  for (const ids of Array.from(porCategoria.values())) {
    if (ids.length < 2) continue;
    ids.forEach((id: number, i: number) => {
      [ids[(i + 1) % ids.length], ids[(i + 2) % ids.length]]
        .filter(rel => rel !== id)
        .forEach((rel, ordem) => linhas.push({ productId: id, relatedProductId: rel, sortOrder: ordem }));
    });
  }
  if (linhas.length) await db.insert(productRelations).values(linhas);
  console.log(`✓ ${linhas.length} relações "complete o look"`);
}

async function seedCupomEFrete() {
  const cupomExiste = await db.select({ id: coupons.id }).from(coupons)
    .where(sql`${coupons.code} = 'BEMVINDA10'`).limit(1);
  if (!cupomExiste.length) {
    await db.insert(coupons).values({
      code: "BEMVINDA10",
      type: "percentage",
      value: "10.00",
      minOrderValue: "199.00",
      maxUses: 500,
      active: true,
    });
  }

  const zonasExistem = await db.select({ id: shippingZones.id }).from(shippingZones).limit(1);
  if (!zonasExistem.length) {
    const [sp] = await db.insert(shippingZones)
      .values({ name: "São Paulo", states: "SP", active: true })
      .returning({ id: shippingZones.id });
    const [br] = await db.insert(shippingZones)
      .values({ name: "Demais estados", states: null, active: true })
      .returning({ id: shippingZones.id });
    await db.insert(shippingRates).values([
      { zoneId: sp.id, name: "Sedex", price: "24.90", estimatedDaysMin: 1, estimatedDaysMax: 3, active: true },
      { zoneId: sp.id, name: "PAC", price: "16.90", estimatedDaysMin: 3, estimatedDaysMax: 7, active: true },
      { zoneId: br.id, name: "Sedex", price: "39.90", estimatedDaysMin: 2, estimatedDaysMax: 5, active: true },
      { zoneId: br.id, name: "PAC", price: "27.90", estimatedDaysMin: 6, estimatedDaysMax: 12, active: true },
    ]);
  }
  console.log("✓ Cupom BEMVINDA10 e zonas de frete");
}

async function main() {
  console.log(`\nSeed VIVI NOSRALLA — banco: ${process.env.DATABASE_URL?.split("/").pop()}\n`);
  if (!KEEP) await limparCatalogo();

  await seedConfiguracoes();
  const catIds = await seedCategorias();
  const { porCategoria } = await seedProdutos(catIds);
  await seedRelacionados(porCategoria);
  await seedCupomEFrete();

  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(variants);
  console.log(`\nPronto. ${PRODUTOS.length} produtos e ${n} variantes na vitrine.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error("\nFalha no seed:", err);
  process.exit(1);
});
