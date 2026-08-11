import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { Truck, Shield, RotateCcw } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { trackViewItem, trackAddToCart, useAnalyticsReady } from "@/lib/analytics";
import ReviewsSection from "@/components/store/ReviewsSection";
import BundleOffer, { type ApiBundle } from "@/components/store/BundleOffer";
import ProvadorVirtual from "@/components/store/ProvadorVirtual";
import { corHex, precoBR, whatsappCom, FRETE_GRATIS_ACIMA } from "@/lib/marca";
import { descontoPix, PIX_DESCONTO } from "@shared/pagamento";

interface ProductImage { id: number; url: string; altText?: string; isMain: boolean; position: number; }
interface Variant {
  id: number; sku?: string; price: string; compareAtPrice?: string;
  stockQuantity: number; option1?: string; option2?: string; option3?: string;
  imageUrl?: string; active: boolean;
}
interface Product {
  id: number; title: string; slug: string; description?: string; brand?: string;
  price: string; compareAtPrice?: string; stockQuantity: number; status: string;
  sku?: string; tags?: string;
  images: ProductImage[]; variants: Variant[];
}

const GARANTIAS = [
  { icone: Truck, texto: `Frete grátis acima de ${precoBR(FRETE_GRATIS_ACIMA)}` },
  { icone: RotateCcw, texto: "30 dias para trocar o tamanho" },
  { icone: Shield, texto: "Pagamento seguro" },
];

/**
 * Página da peça.
 *
 * A galeria ocupa a coluna esquerda inteira e sangra até a borda: todas as
 * fotos empilhadas, sem miniatura e sem moldura. A coluna de compra fica
 * grudada à direita enquanto a cliente desce pelas fotos.
 */
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [cor, setCor] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [bundles, setBundles] = useState<ApiBundle[]>([]);
  const [relacionados, setRelacionados] = useState<ProdutoCard[]>([]);
  const { addToCart, loading: cartLoading } = useCart();
  const { toast } = useToast();
  const analyticsOn = useAnalyticsReady();

  useEffect(() => {
    setLoading(true);
    setQuantidade(1);

    fetch(`/api/store/products/${slug}`)
      // Sem checar r.ok, o JSON de erro {message} virava "product" e a página
      // quebrava em branco ao ler product.variants de um produto inexistente.
      .then(r => (r.ok ? r.json() : null))
      .then((data: Product | null) => {
        setProduct(data);
        if (!data) return;
        // Pré-seleciona a primeira combinação com estoque
        const disponivel = data.variants?.find(v => v.active && v.stockQuantity > 0) ?? data.variants?.[0];
        setTamanho(disponivel?.option1 ?? null);
        setCor(disponivel?.option2 ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`/api/store/products/${slug}/related`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setBundles(d?.bundles ?? []);
        setRelacionados(d?.related ?? []);
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (product && analyticsOn) {
      trackViewItem({ slug: product.slug, name: product.title, price: Number(product.price) });
    }
  }, [product, analyticsOn]);

  const ativos = useMemo(() => product?.variants?.filter(v => v.active) ?? [], [product]);
  const tamanhos = useMemo(
    () => Array.from(new Set(ativos.map(v => v.option1).filter((s): s is string => !!s))),
    [ativos]
  );
  const cores = useMemo(
    () => Array.from(new Set(ativos.map(v => v.option2).filter((c): c is string => !!c))),
    [ativos]
  );

  // Variante = interseção das duas escolhas (ou o único eixo existente)
  const variante = useMemo(() => {
    if (!ativos.length) return null;
    return (
      ativos.find(
        v => (!tamanhos.length || v.option1 === tamanho) && (!cores.length || v.option2 === cor)
      ) ?? null
    );
  }, [ativos, tamanho, cor, tamanhos.length, cores.length]);

  /** Um tamanho está disponível se existir variante com estoque na cor escolhida. */
  const tamanhoDisponivel = (t: string) =>
    ativos.some(v => v.option1 === t && (!cores.length || v.option2 === cor) && v.stockQuantity > 0);
  const corDisponivel = (c: string) =>
    ativos.some(v => v.option2 === c && v.stockQuantity > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="grid lg:grid-cols-[1.12fr_1fr]">
          <div className="aspect-fashion animate-pulse bg-vn-olive-100" />
          <div className="space-y-4 px-4 py-10 md:px-8 lg:px-12">
            <div className="h-9 w-3/4 animate-pulse bg-vn-olive-100" />
            <div className="h-7 w-1/3 animate-pulse bg-vn-olive-100" />
            <div className="h-24 animate-pulse bg-vn-olive-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="bleed py-28 text-center">
          <h1 className="display-lg">Peça não encontrada</h1>
          <p className="mx-auto mt-4 max-w-md font-sans text-vn-ink-soft">
            Ela pode ter saído do catálogo. Veja o que temos agora.
          </p>
          <Link href="/loja" className="btn-ink mt-8 no-underline">
            Ver a loja
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const imagens = [...product.images].sort((a, b) => a.position - b.position);
  /*
   * A chapa segue a proporção nativa das fotos do catálogo (3:4). Qualquer
   * outra caixa faria o `object-cover` decepar a peça — que é justamente o
   * que a cliente veio conferir aqui.
   *
   * No desktop a chapa é presa a uma fração da largura da janela e limitada
   * a 44rem: ocupar a coluna inteira levaria a foto a mais de 800px e o
   * original tem 523px de largura — passaria a borrar.
   */
  const classeChapa =
    "plate aspect-fashion w-full shrink-0 snap-center lg:w-[min(42vw,44rem)]";

  const preco = variante?.price ?? product.price;
  const precoDe = variante?.compareAtPrice ?? product.compareAtPrice;
  const estoque = variante?.stockQuantity ?? product.stockQuantity;
  const emEstoque = estoque > 0;
  const temDesconto = !!precoDe && Number(precoDe) > Number(preco);
  const precisaEscolher = (tamanhos.length > 0 && !tamanho) || (cores.length > 0 && !cor);

  const parcelas = 6;
  const valorParcela = Number(preco) / 3;

  const adicionar = async () => {
    if (!variante && ativos.length) {
      toast({ title: "Escolha tamanho e cor", variant: "destructive" });
      return;
    }
    await addToCart(product.id, variante?.id ?? null, quantidade);
    trackAddToCart({
      slug: product.slug, name: product.title,
      price: Number(preco), quantity: quantidade,
    });
    toast({
      title: "Adicionado à sacola",
      description: `${product.title}${variante ? ` · ${[variante.option1, variante.option2].filter(Boolean).join(" · ")}` : ""}`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* A coluna da galeria encolhe até a largura da chapa (que vem da
            altura da tela), então não sobra vão entre a foto e a compra. */}
        <div className="grid lg:grid-cols-[max-content_minmax(0,1fr)]">
          {/*
            Galeria. No celular vira um carrossel que encaixa foto a foto;
            no desktop, todas as chapas empilhadas sangrando à esquerda.
          */}
          {/* A galeria rola normalmente — só a coluna de compra fica grudada.
              Uma chapa mais alta que a tela e sticky nunca revelaria o pé da
              foto, que é onde está o comprimento da peça. */}
          <div className="flex snap-x snap-mandatory gap-[var(--vn-gutter)] overflow-x-auto lg:grid lg:snap-none lg:grid-cols-1 lg:justify-items-start lg:gap-[var(--vn-gutter)] lg:overflow-visible">
            {imagens.length > 0 ? (
              imagens.map((img, i) => (
                <div key={img.id} className={classeChapa}>
                  <img
                    src={img.url}
                    alt={img.altText || `${product.title} — foto ${i + 1}`}
                    width={523}
                    height={697}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : undefined}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="plate aspect-fashion flex w-full items-center justify-center text-vn-olive-300">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
          </div>

          {/* Compra — grudada enquanto a galeria rola. O `max-w` segura o
              comprimento da linha de texto agora que a coluna é larga. */}
          <div className="w-full max-w-3xl px-4 py-10 md:px-8 lg:sticky lg:top-[var(--vn-header)] lg:h-fit lg:px-12 lg:py-14 xl:px-16">
            <nav aria-label="Você está em" className="eyebrow text-vn-ink-soft">
              <Link href="/loja" className="text-vn-ink-soft no-underline hover:text-vn-ink">
                Loja
              </Link>
              <span className="px-2" aria-hidden>
                ·
              </span>
              <span className="text-vn-ink">{product.title}</span>
            </nav>

            <h1 className="display-md mt-5">{product.title}</h1>
            {product.sku && (
              <p className="mt-2 font-sans text-sm text-vn-ink-soft">Ref. {product.sku}</p>
            )}

            <div className="rule mt-7 pt-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-[1.875rem] text-vn-ink">{precoBR(preco)}</span>
                {temDesconto && (
                  <span className="font-sans text-base text-vn-ink-soft/60 line-through">
                    {precoBR(precoDe!)}
                  </span>
                )}
              </div>
              <p className="mt-2 font-sans text-[0.95rem] text-vn-ink-soft">
                em até 3x de {precoBR(valorParcela)} sem juros · ou {parcelas}x com juros
              </p>
              <p className="mt-1 font-sans text-[0.95rem] font-semibold text-vn-olive-700">
                {precoBR(Number(preco) - descontoPix(Number(preco)))} no PIX ({Math.round(PIX_DESCONTO * 100)}% de desconto)
              </p>
            </div>

            {/* Cor */}
            {cores.length > 0 && (
              <fieldset className="mt-8">
                <legend className="eyebrow">
                  Cor — <span className="normal-case tracking-normal text-vn-ink">{cor}</span>
                </legend>
                <ul className="mt-4 flex flex-wrap gap-2.5">
                  {cores.map(c => {
                    const disponivel = corDisponivel(c);
                    return (
                      <li key={c}>
                        <button
                          onClick={() => setCor(c)}
                          aria-pressed={cor === c}
                          title={disponivel ? c : `${c} — esgotado`}
                          className={`flex h-11 w-11 items-center justify-center border transition-colors ${
                            cor === c ? "border-vn-ink" : "border-transparent hover:border-vn-olive-300"
                          } ${disponivel ? "" : "opacity-40"}`}
                        >
                          <span
                            aria-hidden
                            className="h-7 w-7 border border-vn-olive-200"
                            style={{ background: corHex(c) }}
                          />
                          {/* O leitor de tela precisa ouvir a indisponibilidade —
                              a opacidade sozinha só comunica a quem enxerga. */}
                          <span className="sr-only">{disponivel ? c : `${c} — esgotado`}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {/* Tamanho */}
            {tamanhos.length > 0 && (
              <fieldset className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <legend className="eyebrow">Tamanho</legend>
                  <Link
                    href="/guia-de-medidas"
                    className="nav-label text-vn-olive-600 underline underline-offset-4"
                  >
                    Guia de medidas
                  </Link>
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {tamanhos.map(t => {
                    const disponivel = tamanhoDisponivel(t);
                    return (
                      <li key={t}>
                        <button
                          onClick={() => setTamanho(t)}
                          aria-pressed={tamanho === t}
                          disabled={!disponivel}
                          title={disponivel ? t : `${t} — esgotado nesta cor`}
                          className={`min-h-12 min-w-14 border px-3 font-sans font-medium transition-colors ${
                            tamanho === t
                              ? "border-vn-ink bg-vn-ink text-vn-ice"
                              : "border-vn-olive-200 text-vn-ink hover:border-vn-ink"
                          } ${disponivel ? "" : "cursor-not-allowed text-vn-ink-soft/50 line-through"}`}
                        >
                          {t}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {/* Disponibilidade */}
            <p className="mt-6 font-sans text-[0.95rem]" aria-live="polite">
              {precisaEscolher ? (
                <span className="text-vn-ink-soft">Escolha tamanho e cor para continuar.</span>
              ) : emEstoque ? (
                <span className="font-medium text-vn-olive-700">
                  {estoque <= 3
                    ? `Últimas ${estoque} peças nesta combinação`
                    : "Disponível para envio imediato"}
                </span>
              ) : (
                <span className="font-medium text-vn-wine">
                  Esgotado nesta combinação — tente outro tamanho ou cor.
                </span>
              )}
            </p>

            {/* Quantidade + sacola */}
            <div className="mt-6 flex flex-wrap items-stretch gap-3">
              <div className="flex items-center border border-vn-olive-200">
                <button
                  onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                  className="flex h-12 w-12 items-center justify-center text-xl text-vn-ink hover:bg-vn-olive-50"
                  aria-label="Diminuir quantidade"
                >
                  −
                </button>
                <span className="w-10 text-center font-sans font-medium tabular-nums" aria-live="polite">
                  {quantidade}
                </span>
                <button
                  onClick={() => setQuantidade(q => Math.min(Math.max(estoque, 1), q + 1))}
                  className="flex h-12 w-12 items-center justify-center text-xl text-vn-ink hover:bg-vn-olive-50"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>

              <button
                onClick={adicionar}
                disabled={!emEstoque || cartLoading || precisaEscolher}
                className="btn-ink flex-1 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-56"
              >
                {emEstoque ? "Adicionar à sacola" : "Esgotado"}
              </button>
            </div>

            <ProvadorVirtual
              productId={product.id}
              variantId={variante?.id ?? null}
              corLabel={cor}
            />

            <a
              href={whatsappCom(`Oi! Tenho dúvida sobre a peça "${product.title}".`)}
              target="_blank"
              rel="noopener noreferrer"
              className="link-rule mt-8 text-vn-olive-600"
            >
              Dúvida no tamanho? Fale com a gente
            </a>

            {product.description && (
              <div className="rule mt-9 pt-7">
                <h2 className="eyebrow">Sobre a peça</h2>
                <p className="mt-4 font-sans text-[1.0625rem] leading-relaxed text-vn-ink-soft">
                  {product.description}
                </p>
              </div>
            )}

            <ul className="rule mt-9 space-y-3 pt-7">
              {GARANTIAS.map(g => (
                <li
                  key={g.texto}
                  className="flex items-center gap-3 font-sans text-[0.95rem] text-vn-ink-soft"
                >
                  <g.icone size={17} className="shrink-0 text-vn-olive-600" aria-hidden />
                  {g.texto}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {bundles.length > 0 && (
          <div className="bleed pt-16">
            {bundles.map(b => (
              <BundleOffer key={b.id} bundle={b} primaryColor="#34372e" />
            ))}
          </div>
        )}

        <div className="bleed pt-12">
          <ReviewsSection slug={product.slug} primaryColor="#34372e" />
        </div>

        {relacionados.length > 0 && (
          <section className="bleed py-16 md:py-24">
            <header className="rule pt-6">
              <p className="eyebrow">Combina com</p>
              <h2 className="display-md mt-2.5">Complete o look</h2>
            </header>
            <ul className="grid-vitrine mt-9">
              {relacionados.slice(0, 4).map(p => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* SEO: dados estruturados do produto */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            description: product.description,
            sku: product.sku,
            brand: { "@type": "Brand", name: "Vivi Nosralla" },
            image: imagens.map(i => i.url),
            offers: {
              "@type": "Offer",
              price: Number(preco),
              priceCurrency: "BRL",
              availability: emEstoque
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            },
            ...(Number((product as any).ratingCount) > 0 && {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: (product as any).ratingAvg,
                reviewCount: (product as any).ratingCount,
              },
            }),
          }),
        }}
      />

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
