import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { SlidersHorizontal, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import { corHex, precoBR } from "@/lib/marca";

interface Categoria {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}
interface Facetas {
  sizes: string[];
  colors: string[];
  minPrice: number;
  maxPrice: number;
}
interface RespostaProdutos {
  products: ProdutoCard[];
  total: number;
  page: number;
  pages: number;
}

const ORDENACOES = [
  { value: "newest", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "name_asc", label: "A – Z" },
];

/** Lê o estado dos filtros direto da query string (URL é a fonte da verdade). */
function lerFiltros(search: string) {
  const p = new URLSearchParams(search);
  const csv = (k: string) => (p.get(k) ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return {
    categoria: p.get("categoria") ?? "",
    busca: p.get("busca") ?? "",
    tamanhos: csv("tamanho"),
    cores: csv("cor"),
    max: p.get("ate") ?? "",
    ordenar: p.get("ordenar") ?? "newest",
    pagina: Math.max(1, Number(p.get("pagina")) || 1),
  };
}

/**
 * Vitrine.
 *
 * O conceito é o de uma prancha de contato: banner da coleção sangrando,
 * uma barra fina de controle grudada no topo e a grade colada logo abaixo.
 * Os filtros saíram da barra lateral para uma gaveta — a largura toda da
 * tela passa a ser das fotos.
 */
export default function StorePage() {
  const [, navigate] = useLocation();
  // `useSearch` é o único hook do wouter que reage a mudança só na query string.
  // Com `useLocation` (que devolve apenas o pathname), trocar `?busca=` ou
  // limpar os filtros não redisparava nada e a vitrine ficava desatualizada.
  const search = useSearch();

  const f = useMemo(() => lerFiltros(search), [search]);
  const [painelAberto, setPainelAberto] = useState(false);

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/store/categories"],
    queryFn: () => fetch("/api/store/categories").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const categoriaAtual = categorias.find(c => c.slug === f.categoria);

  const urlFacetas = `/api/store/filters${categoriaAtual ? `?category_id=${categoriaAtual.id}` : ""}`;
  const { data: facetas } = useQuery<Facetas>({
    queryKey: [urlFacetas],
    queryFn: () => fetch(urlFacetas).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  // Monta a query da API a partir dos filtros da URL
  const urlProdutos = useMemo(() => {
    const p = new URLSearchParams({ limit: "24", page: String(f.pagina), sort: f.ordenar });
    if (categoriaAtual) p.set("category", String(categoriaAtual.id));
    if (f.busca) p.set("search", f.busca);
    if (f.tamanhos.length) p.set("size", f.tamanhos.join(","));
    if (f.cores.length) p.set("color", f.cores.join(","));
    if (f.max) p.set("max_price", f.max);
    return `/api/store/products?${p}`;
  }, [f, categoriaAtual]);

  // Só busca depois que as categorias chegaram — senão o filtro de categoria é ignorado
  const prontoParaBuscar = !f.categoria || categorias.length > 0;
  const { data, isLoading } = useQuery<RespostaProdutos>({
    queryKey: [urlProdutos],
    queryFn: () => fetch(urlProdutos).then(r => r.json()),
    enabled: prontoParaBuscar,
    staleTime: 30_000,
  });

  const produtos = data?.products ?? [];
  const total = data?.total ?? 0;
  const paginas = data?.pages ?? 1;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [f.pagina]);

  // A gaveta trava o scroll do fundo enquanto está aberta
  useEffect(() => {
    document.body.style.overflow = painelAberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [painelAberto]);

  /** Grava um filtro na URL; qualquer mudança de filtro volta para a página 1. */
  function aplicar(mudancas: Record<string, string | string[] | null>, manterPagina = false) {
    const p = new URLSearchParams(window.location.search);
    for (const [chave, valor] of Object.entries(mudancas)) {
      const v = Array.isArray(valor) ? valor.join(",") : valor;
      if (!v) p.delete(chave);
      else p.set(chave, v);
    }
    if (!manterPagina) p.delete("pagina");
    const qs = p.toString();
    // `useSearch` reage sozinho à mudança da query — não há estado a sincronizar.
    navigate(`/loja${qs ? `?${qs}` : ""}`);
  }

  const alternar = (chave: "tamanho" | "cor", atuais: string[], valor: string) =>
    aplicar({ [chave]: atuais.includes(valor) ? atuais.filter(v => v !== valor) : [...atuais, valor] });

  const temFiltro = !!(f.categoria || f.busca || f.tamanhos.length || f.cores.length || f.max);
  const qtdFiltros = (f.categoria ? 1 : 0) + f.tamanhos.length + f.cores.length + (f.max ? 1 : 0);

  const titulo = categoriaAtual?.name ?? (f.busca ? `“${f.busca}”` : "Todas as peças");

  /** Etiquetas do que está filtrado agora, cada uma removível. */
  const chips: { rotulo: string; remover: () => void }[] = [
    ...(f.busca ? [{ rotulo: `Busca: ${f.busca}`, remover: () => aplicar({ busca: null }) }] : []),
    ...f.tamanhos.map(t => ({
      rotulo: `Tam. ${t}`,
      remover: () => alternar("tamanho", f.tamanhos, t),
    })),
    ...f.cores.map(c => ({ rotulo: c, remover: () => alternar("cor", f.cores, c) })),
    ...(f.max ? [{ rotulo: `Até ${precoBR(f.max)}`, remover: () => aplicar({ ate: null }) }] : []),
  ];

  const painelFiltros = (
    <div className="space-y-9">
      <fieldset>
        <legend className="eyebrow">Ordenar por</legend>
        <ul className="mt-4 space-y-1">
          {ORDENACOES.map(o => (
            <li key={o.value}>
              <button
                onClick={() => aplicar({ ordenar: o.value })}
                aria-pressed={f.ordenar === o.value}
                className={`w-full py-2 text-left font-sans text-[0.95rem] transition-colors ${
                  f.ordenar === o.value
                    ? "font-semibold text-vn-ink underline underline-offset-4"
                    : "text-vn-ink-soft hover:text-vn-ink"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="rule pt-7">
        <legend className="eyebrow">Categoria</legend>
        <ul className="mt-4 space-y-1">
          <li>
            <button
              onClick={() => aplicar({ categoria: null, tamanho: null, cor: null })}
              aria-pressed={!f.categoria}
              className={`w-full py-2 text-left font-sans text-[0.95rem] transition-colors ${
                !f.categoria
                  ? "font-semibold text-vn-ink underline underline-offset-4"
                  : "text-vn-ink-soft hover:text-vn-ink"
              }`}
            >
              Todas as peças
            </button>
          </li>
          {categorias.map(c => (
            <li key={c.id}>
              <button
                onClick={() => aplicar({ categoria: c.slug, tamanho: null, cor: null })}
                aria-pressed={f.categoria === c.slug}
                className={`w-full py-2 text-left font-sans text-[0.95rem] transition-colors ${
                  f.categoria === c.slug
                    ? "font-semibold text-vn-ink underline underline-offset-4"
                    : "text-vn-ink-soft hover:text-vn-ink"
                }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {!!facetas?.sizes.length && (
        <fieldset className="rule pt-7">
          <legend className="eyebrow">Tamanho</legend>
          <div className="mt-4 flex flex-wrap gap-2">
            {facetas.sizes.map(t => {
              const ativo = f.tamanhos.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => alternar("tamanho", f.tamanhos, t)}
                  aria-pressed={ativo}
                  className={`min-h-11 min-w-12 border px-3 font-sans text-[0.9rem] font-medium transition-colors ${
                    ativo
                      ? "border-vn-ink bg-vn-ink text-vn-ice"
                      : "border-vn-olive-200 text-vn-ink hover:border-vn-ink"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {!!facetas?.colors.length && (
        <fieldset className="rule pt-7">
          <legend className="eyebrow">Cor</legend>
          <ul className="mt-4 space-y-0.5">
            {facetas.colors.map(cor => {
              const ativo = f.cores.includes(cor);
              return (
                <li key={cor}>
                  <button
                    onClick={() => alternar("cor", f.cores, cor)}
                    aria-pressed={ativo}
                    className={`flex min-h-11 w-full items-center gap-3 text-left font-sans text-[0.95rem] transition-colors ${
                      ativo ? "font-semibold text-vn-ink" : "text-vn-ink-soft hover:text-vn-ink"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-4 w-8 shrink-0 border ${
                        ativo
                          ? "border-vn-ink outline outline-1 outline-offset-2 outline-vn-ink"
                          : "border-vn-olive-200"
                      }`}
                      style={{ background: corHex(cor) }}
                    />
                    {cor}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {!!facetas && facetas.maxPrice > facetas.minPrice && (
        <fieldset className="rule pt-7">
          <legend className="eyebrow">Preço até</legend>
          <label htmlFor="filtro-preco" className="mt-3 block font-display text-2xl text-vn-ink">
            {precoBR(Number(f.max) || facetas.maxPrice)}
          </label>
          <input
            id="filtro-preco"
            type="range"
            min={facetas.minPrice}
            max={facetas.maxPrice}
            step={10}
            value={Number(f.max) || facetas.maxPrice}
            onChange={e => aplicar({ ate: e.target.value })}
            className="mt-3 w-full accent-vn-ink"
          />
          <div className="mt-1 flex justify-between font-sans text-xs text-vn-ink-soft">
            <span>{precoBR(facetas.minPrice)}</span>
            <span>{precoBR(facetas.maxPrice)}</span>
          </div>
        </fieldset>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* Banner da coleção — foto da categoria quando existe, faixa areia quando não */}
        {categoriaAtual?.imageUrl ? (
          <div className="plate h-[30svh] min-h-[13rem] max-h-[22rem] w-full">
            <img
              src={categoriaAtual.imageUrl}
              alt=""
              aria-hidden
              fetchPriority="high"
              className="h-full w-full object-cover object-[center_18%]"
            />
            <div className="absolute inset-0 bg-vn-ink/40" />
            <div className="bleed absolute inset-0 flex items-end pb-8 md:pb-10">
              <div>
                <p className="eyebrow-ice">Coleção</p>
                <h1 className="display-lg mt-3 text-vn-ice">{titulo}</h1>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-sand">
            <div className="bleed py-12 md:py-16">
              <p className="eyebrow text-vn-olive-700">{f.busca ? "Resultados para" : "Vitrine"}</p>
              <h1 className="display-lg mt-3">{titulo}</h1>
            </div>
          </div>
        )}

        {categoriaAtual?.description && (
          <div className="bleed pt-8">
            <p className="measure font-sans text-[1.0625rem] leading-relaxed text-vn-ink-soft">
              {categoriaAtual.description}
            </p>
          </div>
        )}

        {/* Barra de controle — gruda logo abaixo do cabeçalho */}
        <div className="sticky top-[var(--vn-header)] z-30 mt-8 border-y border-vn-olive-200 bg-background">
          <div className="bleed">
            <div className="flex h-14 items-center justify-between gap-4">
              <nav aria-label="Você está em" className="eyebrow hidden text-vn-ink-soft sm:block">
                <Link href="/loja" className="text-vn-ink-soft no-underline hover:text-vn-ink">
                  Loja
                </Link>
                {categoriaAtual && (
                  <>
                    <span className="px-2" aria-hidden>
                      ·
                    </span>
                    <span className="text-vn-ink">{categoriaAtual.name}</span>
                  </>
                )}
              </nav>

              <button
                onClick={() => setPainelAberto(true)}
                aria-haspopup="dialog"
                className="nav-label flex items-center gap-2.5 border border-vn-ink px-4 py-2.5 text-vn-ink transition-colors hover:bg-vn-ink hover:text-vn-ice"
              >
                <SlidersHorizontal size={15} aria-hidden />
                Filtros &amp; ordenar
                {qtdFiltros > 0 && <span className="tabular-nums">({qtdFiltros})</span>}
              </button>

              <p className="eyebrow text-vn-ink-soft" aria-live="polite">
                {total} {total === 1 ? "peça" : "peças"}
              </p>
            </div>
          </div>
        </div>

        {/* Etiquetas do que está filtrado */}
        {chips.length > 0 && (
          <div className="bleed pt-5">
            <ul className="flex flex-wrap items-center gap-2">
              {chips.map(c => (
                <li key={c.rotulo}>
                  <button
                    onClick={c.remover}
                    className="flex items-center gap-2 border border-vn-olive-200 px-3 py-1.5 font-sans text-[0.85rem] text-vn-ink transition-colors hover:border-vn-ink"
                  >
                    {c.rotulo}
                    <X size={13} aria-hidden />
                    <span className="sr-only">— remover filtro</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={() => navigate("/loja")}
                  className="nav-label px-2 py-1.5 text-vn-wine underline underline-offset-4"
                >
                  Limpar tudo
                </button>
              </li>
            </ul>
          </div>
        )}

        <div className="bleed pb-20 pt-8 md:pb-28">
          {isLoading || !prontoParaBuscar ? (
            <ul className="grid-vitrine">
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i}>
                  <div className="aspect-fashion animate-pulse bg-vn-olive-100" />
                  <div className="mt-3 h-3.5 w-3/4 animate-pulse bg-vn-olive-100" />
                  <div className="mt-2 h-3.5 w-1/3 animate-pulse bg-vn-olive-100" />
                </li>
              ))}
            </ul>
          ) : produtos.length === 0 ? (
            <div className="rule border-b border-vn-olive-200 py-24 text-center">
              <p className="display-md">Nenhuma peça com esses filtros</p>
              <p className="mx-auto mt-4 max-w-md font-sans text-vn-ink-soft">
                Tente ampliar a busca ou fale com a gente no WhatsApp — o provador continua aberto.
              </p>
              <button onClick={() => navigate("/loja")} className="btn-ink mt-8">
                Ver todas as peças
              </button>
            </div>
          ) : (
            <ul className="grid-vitrine">
              {produtos.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} priority={i < 4} />
                </li>
              ))}
            </ul>
          )}

          {paginas > 1 && (
            <nav
              className="rule mt-16 flex items-center justify-between gap-4 pt-6"
              aria-label="Paginação"
            >
              <button
                className="nav-label text-vn-ink transition-opacity disabled:opacity-30"
                disabled={f.pagina <= 1}
                onClick={() => aplicar({ pagina: String(f.pagina - 1) }, true)}
              >
                ← Anterior
              </button>
              <span className="eyebrow text-vn-ink-soft">
                Página {f.pagina} de {paginas}
              </span>
              <button
                className="nav-label text-vn-ink transition-opacity disabled:opacity-30"
                disabled={f.pagina >= paginas}
                onClick={() => aplicar({ pagina: String(f.pagina + 1) }, true)}
              >
                Próxima →
              </button>
            </nav>
          )}
        </div>
      </main>

      {/* Filtros e ordenação — gaveta */}
      {painelAberto && (
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros e ordenação"
        >
          <div
            className="absolute inset-0 bg-vn-ink/45"
            onClick={() => setPainelAberto(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-[92%] max-w-md flex-col bg-background">
            <div className="flex items-center justify-between border-b border-vn-olive-200 px-6 py-5">
              <h2 className="eyebrow">Filtros &amp; ordenar</h2>
              <button
                onClick={() => setPainelAberto(false)}
                className="p-1.5 text-vn-ink hover:text-vn-olive-600"
                aria-label="Fechar filtros"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-7">{painelFiltros}</div>

            <div className="flex gap-3 border-t border-vn-olive-200 px-6 py-5">
              {temFiltro && (
                <button
                  onClick={() => {
                    navigate("/loja");
                    setPainelAberto(false);
                  }}
                  className="btn-line flex-1"
                >
                  Limpar
                </button>
              )}
              <button onClick={() => setPainelAberto(false)} className="btn-ink flex-[2]">
                Ver {total} {total === 1 ? "peça" : "peças"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
