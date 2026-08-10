import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Menu, X, Search } from "lucide-react";
import { useCart } from "@/context/CartContext";
import Logo from "@/components/brand/Logo";

interface Categoria {
  id: number;
  name: string;
  slug: string;
}

const LINKS_FIXOS = [
  { href: "/sobre", label: "Sobre" },
  { href: "/guia-de-medidas", label: "Medidas" },
  { href: "/contato", label: "Contato" },
];

/**
 * Cabeçalho único do site e da loja.
 *
 * Fino, reto e quase sem cor: a única coisa que separa o cabeçalho da página
 * é um fio. Busca e categorias abrem em painéis de largura total, no lugar
 * de dropdowns — a navegação também é parte do lookbook.
 */
export default function Navbar() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [painel, setPainel] = useState<"categorias" | "busca" | null>(null);
  const [busca, setBusca] = useState("");
  const { itemCount } = useCart();
  const [location, navigate] = useLocation();
  const campoBusca = useRef<HTMLInputElement>(null);

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/store/categories"],
    queryFn: () => fetch("/api/store/categories").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  // Fecha os painéis a cada troca de rota
  useEffect(() => {
    setMenuAberto(false);
    setPainel(null);
  }, [location]);

  // Abrir a busca sem o cursor dentro do campo obriga um clique extra
  useEffect(() => {
    if (painel === "busca") campoBusca.current?.focus();
  }, [painel]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPainel(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = busca.trim();
    navigate(q ? `/loja?busca=${encodeURIComponent(q)}` : "/loja");
    setPainel(null);
    setMenuAberto(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-vn-olive-200 bg-[#faf9f3]">
      <div className="bleed">
        <div className="flex h-[var(--vn-header)] items-center justify-between gap-6">
          <Link href="/" className="shrink-0" aria-label="Vivi Nosralla — página inicial">
            <Logo variante="lockup" tom="oliva" className="h-11 md:h-12" />
          </Link>

          {/* Navegação — desktop */}
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
            <Link href="/loja" className="nav-label text-vn-ink no-underline hover:text-vn-olive-600">
              Loja
            </Link>

            <button
              type="button"
              onClick={() => setPainel(p => (p === "categorias" ? null : "categorias"))}
              aria-expanded={painel === "categorias"}
              className={`nav-label transition-colors ${
                painel === "categorias" ? "text-vn-olive-600" : "text-vn-ink hover:text-vn-olive-600"
              }`}
            >
              Categorias
            </button>

            {LINKS_FIXOS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="nav-label text-vn-ink no-underline hover:text-vn-olive-600"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPainel(p => (p === "busca" ? null : "busca"))}
              aria-expanded={painel === "busca"}
              aria-label="Buscar peças"
              className="p-2.5 text-vn-ink transition-colors hover:text-vn-olive-600"
            >
              <Search size={19} aria-hidden />
            </button>

            <Link
              href="/loja/carrinho"
              className="flex items-center gap-1.5 p-2.5 text-vn-ink no-underline transition-colors hover:text-vn-olive-600"
              aria-label={`Sacola${itemCount > 0 ? ` — ${itemCount} ${itemCount === 1 ? "item" : "itens"}` : " vazia"}`}
            >
              <ShoppingBag size={19} aria-hidden />
              <span className="font-sans text-[0.75rem] font-semibold tabular-nums" aria-hidden>
                {itemCount}
              </span>
            </Link>

            <button
              className="p-2.5 text-vn-ink transition-colors hover:text-vn-olive-600 lg:hidden"
              onClick={() => setMenuAberto(v => !v)}
              aria-expanded={menuAberto}
              aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            >
              {menuAberto ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {/* Painel de busca — largura total */}
      {painel === "busca" && (
        <div className="border-t border-vn-olive-200 bg-[#faf9f3]">
          <div className="bleed py-8 md:py-12">
            <form onSubmit={buscar} role="search" className="mx-auto max-w-3xl">
              <label htmlFor="busca-topo" className="eyebrow">
                O que você procura
              </label>
              <div className="mt-3 flex items-end gap-4 border-b border-vn-ink pb-2">
                <input
                  id="busca-topo"
                  ref={campoBusca}
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Blazer, vestido, tricô…"
                  className="w-full bg-transparent font-display text-[1.75rem] text-vn-ink outline-none placeholder:text-vn-olive-300 md:text-[2.25rem]"
                />
                <button type="submit" className="nav-label shrink-0 pb-2 text-vn-olive-600">
                  Buscar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Painel de categorias — largura total */}
      {painel === "categorias" && categorias.length > 0 && (
        <div className="hidden border-t border-vn-olive-200 bg-[#faf9f3] lg:block">
          <div className="bleed py-10">
            <p className="eyebrow">Escolha por categoria</p>
            <ul className="mt-6 grid grid-cols-4 gap-x-8 gap-y-1">
              {categorias.map(c => (
                <li key={c.id}>
                  <Link
                    href={`/loja?categoria=${c.slug}`}
                    className="block py-2 font-display text-[1.375rem] text-vn-ink no-underline transition-colors hover:text-vn-olive-600"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/loja"
                  className="block py-2 font-display text-[1.375rem] italic text-vn-olive-600 no-underline hover:text-vn-ink"
                >
                  Ver tudo
                </Link>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Menu mobile */}
      {menuAberto && (
        <div className="border-t border-vn-olive-200 bg-[#faf9f3] lg:hidden">
          <div className="bleed py-6">
            <form onSubmit={buscar} role="search" className="mb-7">
              <label htmlFor="busca-mobile" className="eyebrow">
                Buscar
              </label>
              <div className="mt-2 flex items-center gap-3 border-b border-vn-ink pb-2">
                <input
                  id="busca-mobile"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Blazer, vestido, tricô…"
                  className="w-full bg-transparent font-display text-xl text-vn-ink outline-none placeholder:text-vn-olive-300"
                />
                <button type="submit" aria-label="Buscar" className="text-vn-olive-600">
                  <Search size={19} />
                </button>
              </div>
            </form>

            <nav className="flex flex-col" aria-label="Principal">
              <Link
                href="/loja"
                className="rule py-3.5 font-display text-xl text-vn-ink no-underline"
              >
                Ver toda a loja
              </Link>
              {categorias.map(c => (
                <Link
                  key={c.id}
                  href={`/loja?categoria=${c.slug}`}
                  className="rule py-3.5 font-display text-xl text-vn-ink no-underline"
                >
                  {c.name}
                </Link>
              ))}
              {LINKS_FIXOS.map(l => (
                <Link key={l.href} href={l.href} className="rule py-3.5 nav-label text-vn-ink no-underline">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
