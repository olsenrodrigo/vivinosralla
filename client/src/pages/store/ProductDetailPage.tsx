import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { ShoppingBag, Truck, Shield, RotateCcw, Ruler, MessageCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { trackViewItem, trackAddToCart, useAnalyticsReady } from "@/lib/analytics";
import ReviewsSection from "@/components/store/ReviewsSection";
import BundleOffer, { type ApiBundle } from "@/components/store/BundleOffer";
import { corHex, precoBR, whatsappCom, FRETE_GRATIS_ACIMA } from "@/lib/marca";

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

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [imagemAtual, setImagemAtual] = useState(0);
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
    setImagemAtual(0);
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
        <div className="container-vn grid gap-10 py-12 md:grid-cols-2">
          <div className="aspect-fashion animate-pulse rounded-2xl bg-vn-olive-100" />
          <div className="space-y-4">
            <div className="h-9 w-3/4 animate-pulse rounded bg-vn-olive-100" />
            <div className="h-7 w-1/3 animate-pulse rounded bg-vn-olive-100" />
            <div className="h-24 animate-pulse rounded bg-vn-olive-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-vn py-24 text-center">
          <h1 className="text-3xl">Peça não encontrada</h1>
          <p className="mt-3 font-sans text-vn-ink-soft">
            Ela pode ter saído do catálogo. Veja o que temos agora.
          </p>
          <Link href="/loja" className="btn-olive mt-7 no-underline">
            Ver a loja
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const imagens = [...product.images].sort((a, b) => a.position - b.position);
  const imagem = imagens[imagemAtual];
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

      <main className="container-vn py-8 md:py-12">
        <nav aria-label="Você está em" className="mb-7 font-sans text-sm text-vn-ink-soft">
          <Link href="/loja" className="no-underline hover:text-vn-ink">
            Loja
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span className="text-vn-ink">{product.title}</span>
        </nav>

        <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
          {/* Galeria */}
          <div>
            <div className="aspect-fashion overflow-hidden rounded-2xl bg-vn-olive-50">
              {imagem ? (
                <img
                  src={imagem.url}
                  alt={imagem.altText || product.title}
                  width={523}
                  height={697}
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-vn-olive-300">
                  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
            </div>

            {imagens.length > 1 && (
              <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {imagens.map((img, i) => (
                  <li key={img.id}>
                    <button
                      onClick={() => setImagemAtual(i)}
                      aria-label={`Ver imagem ${i + 1} de ${imagens.length}`}
                      aria-current={i === imagemAtual}
                      className={`h-24 w-[4.5rem] overflow-hidden rounded-lg border-2 transition-colors ${
                        i === imagemAtual ? "border-vn-olive-600" : "border-transparent hover:border-vn-olive-300"
                      }`}
                    >
                      <img src={img.url} alt="" aria-hidden className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Informações e compra */}
          <div>
            <h1 className="text-[2rem] leading-tight md:text-[2.5rem]">{product.title}</h1>
            {product.sku && (
              <p className="mt-2 font-sans text-sm text-vn-ink-soft">Ref. {product.sku}</p>
            )}

            <div className="mt-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-sans text-[2rem] font-semibold text-vn-ink">
                  {precoBR(preco)}
                </span>
                {temDesconto && (
                  <span className="font-sans text-lg text-vn-ink-soft/70 line-through">
                    {precoBR(precoDe!)}
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-sans text-[0.95rem] text-vn-ink-soft">
                em até 3x de {precoBR(valorParcela)} sem juros · ou {parcelas}x com juros
              </p>
              <p className="mt-1 font-sans text-[0.95rem] font-semibold text-vn-olive-700">
                {precoBR(Number(preco) * 0.95)} no PIX (5% de desconto)
              </p>
            </div>

            {/* Cor */}
            {cores.length > 0 && (
              <fieldset className="mt-8">
                <legend className="font-sans text-[0.95rem] font-semibold text-vn-ink">
                  Cor: <span className="font-normal text-vn-ink-soft">{cor}</span>
                </legend>
                <ul className="mt-3 flex flex-wrap gap-2.5">
                  {cores.map(c => {
                    const disponivel = corDisponivel(c);
                    return (
                      <li key={c}>
                        <button
                          onClick={() => setCor(c)}
                          aria-pressed={cor === c}
                          title={disponivel ? c : `${c} — esgotado`}
                          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all ${
                            cor === c ? "border-vn-olive-600" : "border-transparent hover:border-vn-olive-300"
                          } ${disponivel ? "" : "opacity-40"}`}
                        >
                          <span
                            aria-hidden
                            className="h-7 w-7 rounded-full border border-vn-olive-200"
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
              <fieldset className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <legend className="font-sans text-[0.95rem] font-semibold text-vn-ink">
                    Tamanho
                  </legend>
                  <Link
                    href="/guia-de-medidas"
                    className="inline-flex items-center gap-1.5 font-sans text-[0.9rem] font-medium text-vn-olive-700 underline underline-offset-4"
                  >
                    <Ruler size={15} aria-hidden />
                    Guia de medidas
                  </Link>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2.5">
                  {tamanhos.map(t => {
                    const disponivel = tamanhoDisponivel(t);
                    return (
                      <li key={t}>
                        <button
                          onClick={() => setTamanho(t)}
                          aria-pressed={tamanho === t}
                          disabled={!disponivel}
                          title={disponivel ? t : `${t} — esgotado nesta cor`}
                          className={`min-h-11 min-w-14 rounded-lg border px-3 font-sans font-medium transition-colors ${
                            tamanho === t
                              ? "border-vn-olive-600 bg-vn-olive-600 text-white"
                              : "border-vn-olive-200 text-vn-ink hover:border-vn-olive-400"
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
                  {estoque <= 3 ? `Últimas ${estoque} peças nesta combinação` : "Disponível para envio imediato"}
                </span>
              ) : (
                <span className="font-medium text-vn-wine">
                  Esgotado nesta combinação — tente outro tamanho ou cor.
                </span>
              )}
            </p>

            {/* Quantidade + sacola */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border border-vn-olive-200">
                <button
                  onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                  className="flex h-12 w-12 items-center justify-center rounded-l-full text-xl text-vn-ink hover:bg-vn-olive-50"
                  aria-label="Diminuir quantidade"
                >
                  −
                </button>
                <span className="w-10 text-center font-sans font-medium" aria-live="polite">
                  {quantidade}
                </span>
                <button
                  onClick={() => setQuantidade(q => Math.min(Math.max(estoque, 1), q + 1))}
                  className="flex h-12 w-12 items-center justify-center rounded-r-full text-xl text-vn-ink hover:bg-vn-olive-50"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>

              <Button
                onClick={adicionar}
                disabled={!emEstoque || cartLoading || precisaEscolher}
                className="btn-olive h-12 min-w-56 flex-1 text-base disabled:opacity-50"
              >
                <ShoppingBag size={18} aria-hidden />
                {emEstoque ? "Adicionar à sacola" : "Esgotado"}
              </Button>
            </div>

            <a
              href={whatsappCom(`Oi! Tenho dúvida sobre a peça "${product.title}".`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 font-sans text-[0.95rem] font-medium text-vn-olive-700 no-underline hover:text-vn-olive-800"
            >
              <MessageCircle size={17} aria-hidden />
              Dúvida no tamanho? Fale com a gente
            </a>

            <ul className="mt-8 space-y-3 border-t border-vn-olive-100 pt-7">
              {GARANTIAS.map(g => (
                <li key={g.texto} className="flex items-center gap-3 font-sans text-[0.95rem] text-vn-ink-soft">
                  <g.icone size={18} className="shrink-0 text-vn-olive-600" aria-hidden />
                  {g.texto}
                </li>
              ))}
            </ul>

            {product.description && (
              <div className="mt-8 border-t border-vn-olive-100 pt-7">
                <h2 className="font-sans text-lg font-semibold text-vn-ink">Sobre a peça</h2>
                <p className="mt-3 font-sans text-[1.0625rem] leading-relaxed text-vn-ink-soft">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {bundles.length > 0 && (
          <div className="mt-14">
            {bundles.map(b => (
              <BundleOffer key={b.id} bundle={b} primaryColor="#6d7561" />
            ))}
          </div>
        )}

        <div className="mt-16 border-t border-vn-olive-100 pt-12">
          <ReviewsSection slug={product.slug} primaryColor="#6d7561" />
        </div>

        {relacionados.length > 0 && (
          <section className="mt-16 border-t border-vn-olive-100 pt-14">
            <p className="eyebrow">Combina com</p>
            <h2 className="mt-3 text-[2rem] md:text-[2.5rem]">Complete o look</h2>
            <ul className="mt-9 grid grid-cols-2 gap-x-5 gap-y-9 lg:grid-cols-4">
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
