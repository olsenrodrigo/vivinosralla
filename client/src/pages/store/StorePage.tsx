import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { SlidersHorizontal, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { corHex, precoBR } from "@/lib/marca";

interface Categoria {
  id: number;
  name: string;
  slug: string;
  description: string | null;
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

  const painelFiltros = (
    <div className="space-y-8">
      <fieldset>
        <legend className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-vn-olive-600">
          Categoria
        </legend>
        <ul className="mt-4 space-y-1">
          <li>
            <button
              onClick={() => aplicar({ categoria: null, tamanho: null, cor: null })}
              aria-pressed={!f.categoria}
              className={`w-full rounded-lg px-3 py-2.5 text-left font-sans text-[0.95rem] transition-colors ${
                !f.categoria
                  ? "bg-vn-olive-600 font-semibold text-white"
                  : "text-vn-ink hover:bg-vn-olive-50"
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
                className={`w-full rounded-lg px-3 py-2.5 text-left font-sans text-[0.95rem] transition-colors ${
                  f.categoria === c.slug
                    ? "bg-vn-olive-600 font-semibold text-white"
                    : "text-vn-ink hover:bg-vn-olive-50"
                }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {!!facetas?.sizes.length && (
        <fieldset>
          <legend className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-vn-olive-600">
            Tamanho
          </legend>
          <div className="mt-4 flex flex-wrap gap-2">
            {facetas.sizes.map(t => {
              const ativo = f.tamanhos.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => alternar("tamanho", f.tamanhos, t)}
                  aria-pressed={ativo}
                  className={`min-h-11 min-w-11 rounded-lg border px-3 font-sans text-[0.95rem] font-medium transition-colors ${
                    ativo
                      ? "border-vn-olive-600 bg-vn-olive-600 text-white"
                      : "border-vn-olive-200 text-vn-ink hover:border-vn-olive-400"
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
        <fieldset>
          <legend className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-vn-olive-600">
            Cor
          </legend>
          <ul className="mt-4 space-y-1.5">
            {facetas.colors.map(cor => {
              const ativo = f.cores.includes(cor);
              return (
                <li key={cor}>
                  <button
                    onClick={() => alternar("cor", f.cores, cor)}
                    aria-pressed={ativo}
                    className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left font-sans text-[0.95rem] transition-colors ${
                      ativo ? "bg-vn-olive-50 font-semibold text-vn-ink" : "text-vn-ink hover:bg-vn-olive-50"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-5 w-5 shrink-0 rounded-full border ${
                        ativo ? "ring-2 ring-vn-olive-600 ring-offset-2" : "border-vn-olive-200"
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
        <fieldset>
          <legend className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-vn-olive-600">
            Preço até
          </legend>
          <label htmlFor="filtro-preco" className="mt-4 block font-sans text-[0.95rem] text-vn-ink">
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
            className="mt-2 w-full accent-vn-olive-600"
          />
          <div className="mt-1 flex justify-between font-sans text-xs text-vn-ink-soft">
            <span>{precoBR(facetas.minPrice)}</span>
            <span>{precoBR(facetas.maxPrice)}</span>
          </div>
        </fieldset>
      )}

      {temFiltro && (
        <button
          onClick={() => navigate("/loja")}
          className="font-sans text-[0.95rem] font-semibold text-vn-wine underline underline-offset-4"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container-vn py-10 md:py-14">
        <header className="mb-9">
          <p className="eyebrow">{total} {total === 1 ? "peça" : "peças"}</p>
          <h1 className="mt-3 text-[2.25rem] md:text-[2.75rem]">
            {categoriaAtual?.name ?? (f.busca ? `Resultados para “${f.busca}”` : "Todas as peças")}
          </h1>
          {categoriaAtual?.description && (
            <p className="mt-3 max-w-2xl font-sans text-[1.0625rem] text-vn-ink-soft">
              {categoriaAtual.description}
            </p>
          )}
          {f.busca && (
            <button
              onClick={() => aplicar({ busca: null })}
              className="mt-3 inline-flex items-center gap-1.5 font-sans text-sm text-vn-ink-soft hover:text-vn-ink"
            >
              <X size={14} aria-hidden /> limpar busca
            </button>
          )}
        </header>

        <div className="flex gap-10">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-28">{painelFiltros}</div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              {/* O wrapper é quem esconde no desktop: as classes .btn-* definem
                  `display`, então `lg:hidden` aplicado no próprio botão perde. */}
              <div className="lg:hidden">
                <button
                  onClick={() => setPainelAberto(true)}
                  className="btn-outline-olive"
                  aria-haspopup="dialog"
                >
                  <SlidersHorizontal size={17} aria-hidden />
                  Filtrar
                </button>
              </div>

              <label className="ml-auto flex items-center gap-2 font-sans text-[0.95rem] text-vn-ink-soft">
                Ordenar por
                <select
                  value={f.ordenar}
                  onChange={e => aplicar({ ordenar: e.target.value })}
                  className="min-h-11 rounded-full border border-vn-olive-200 bg-white px-4 font-sans text-[0.95rem] font-medium text-vn-ink"
                >
                  {ORDENACOES.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {isLoading || !prontoParaBuscar ? (
              <ul className="grid grid-cols-2 gap-x-5 gap-y-9 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i}>
                    <div className="aspect-fashion animate-pulse rounded-xl bg-vn-olive-100" />
                    <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-vn-olive-100" />
                    <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-vn-olive-100" />
                  </li>
                ))}
              </ul>
            ) : produtos.length === 0 ? (
              <div className="rounded-2xl bg-alt py-20 text-center">
                <p className="font-display text-2xl text-vn-ink">Nenhuma peça com esses filtros</p>
                <p className="mt-2 font-sans text-vn-ink-soft">
                  Tente ampliar a busca ou fale com a gente no WhatsApp.
                </p>
                <button onClick={() => navigate("/loja")} className="btn-olive mt-6">
                  Ver todas as peças
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-x-5 gap-y-9 lg:grid-cols-3 xl:grid-cols-4">
                {produtos.map((p, i) => (
                  <li key={p.id}>
                    <ProductCard product={p} priority={i < 4} />
                  </li>
                ))}
              </ul>
            )}

            {paginas > 1 && (
              <nav className="mt-14 flex items-center justify-center gap-3" aria-label="Paginação">
                <Button
                  variant="outline"
                  className="min-h-11 rounded-full"
                  disabled={f.pagina <= 1}
                  onClick={() => aplicar({ pagina: String(f.pagina - 1) }, true)}
                >
                  Anterior
                </Button>
                <span className="font-sans text-[0.95rem] text-vn-ink-soft">
                  Página {f.pagina} de {paginas}
                </span>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-full"
                  disabled={f.pagina >= paginas}
                  onClick={() => aplicar({ pagina: String(f.pagina + 1) }, true)}
                >
                  Próxima
                </Button>
              </nav>
            )}
          </div>
        </div>
      </main>

      {/* Filtros em gaveta — mobile */}
      {painelAberto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div
            className="absolute inset-0 bg-vn-ink/40"
            onClick={() => setPainelAberto(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 w-[86%] max-w-sm overflow-y-auto bg-background p-6">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="font-display text-2xl">Filtros</h2>
              <button
                onClick={() => setPainelAberto(false)}
                className="rounded-full p-2 hover:bg-vn-olive-50"
                aria-label="Fechar filtros"
              >
                <X size={22} aria-hidden />
              </button>
            </div>
            {painelFiltros}
            <button onClick={() => setPainelAberto(false)} className="btn-olive mt-9 w-full">
              Ver {total} {total === 1 ? "peça" : "peças"}
            </button>
          </div>
        </div>
      )}

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
