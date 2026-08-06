import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Menu, X, Search, ChevronDown } from "lucide-react";
import { useCart } from "@/context/CartContext";
import Logo from "@/components/brand/Logo";

interface Categoria {
  id: number;
  name: string;
  slug: string;
}

const LINKS_FIXOS = [
  { href: "/sobre", label: "Sobre" },
  { href: "/guia-de-medidas", label: "Guia de medidas" },
  { href: "/contato", label: "Contato" },
];

/** Cabeçalho único do site e da loja. */
export default function Navbar() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [categoriasAbertas, setCategoriasAbertas] = useState(false);
  const [busca, setBusca] = useState("");
  const { itemCount } = useCart();
  const [location, navigate] = useLocation();

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/store/categories"],
    queryFn: () => fetch("/api/store/categories").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  // Fecha os menus a cada troca de rota
  useEffect(() => {
    setMenuAberto(false);
    setCategoriasAbertas(false);
  }, [location]);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = busca.trim();
    navigate(q ? `/loja?busca=${encodeURIComponent(q)}` : "/loja");
    setMenuAberto(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-vn-olive-100 bg-[#faf9f3]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#faf9f3]/85">
      <div className="container-vn">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link href="/" className="shrink-0" aria-label="Vivi Nosralla — página inicial">
            <Logo variante="lockup" tom="oliva" className="h-11 md:h-12" />
          </Link>

          {/* Navegação — desktop */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
            <Link
              href="/loja"
              className="rounded-full px-4 py-2 font-sans text-[0.95rem] font-medium text-vn-ink no-underline transition-colors hover:bg-vn-olive-50"
            >
              Loja
            </Link>

            <div
              className="relative"
              onMouseEnter={() => setCategoriasAbertas(true)}
              onMouseLeave={() => setCategoriasAbertas(false)}
            >
              <button
                type="button"
                onClick={() => setCategoriasAbertas(v => !v)}
                aria-expanded={categoriasAbertas}
                className="flex items-center gap-1 rounded-full px-4 py-2 font-sans text-[0.95rem] font-medium text-vn-ink transition-colors hover:bg-vn-olive-50"
              >
                Categorias
                <ChevronDown size={16} aria-hidden />
              </button>
              {categoriasAbertas && (
                <div className="absolute left-0 top-full w-60 overflow-hidden rounded-xl border border-vn-olive-100 bg-white py-2 shadow-[0_16px_40px_rgb(52_55_46/0.12)]">
                  {categorias.map(c => (
                    <Link
                      key={c.id}
                      href={`/loja?categoria=${c.slug}`}
                      className="block px-5 py-2.5 font-sans text-[0.95rem] text-vn-ink no-underline transition-colors hover:bg-vn-olive-50"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {LINKS_FIXOS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-2 font-sans text-[0.95rem] font-medium text-vn-ink no-underline transition-colors hover:bg-vn-olive-50"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Busca — tablet e acima */}
          <form onSubmit={buscar} className="hidden max-w-xs flex-1 md:flex" role="search">
            <div className="relative w-full">
              <label htmlFor="busca-topo" className="sr-only">
                Buscar produtos
              </label>
              <input
                id="busca-topo"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar peças…"
                className="w-full rounded-full border border-vn-olive-200 bg-white py-2.5 pl-4 pr-10 font-sans text-[0.95rem] text-vn-ink placeholder:text-vn-ink-soft/70"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-vn-olive-600"
                aria-label="Buscar"
              >
                <Search size={17} />
              </button>
            </div>
          </form>

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/loja/carrinho"
              className="relative rounded-full p-2.5 no-underline transition-colors hover:bg-vn-olive-50"
              aria-label={`Carrinho${itemCount > 0 ? ` — ${itemCount} ${itemCount === 1 ? "item" : "itens"}` : " vazio"}`}
            >
              <ShoppingBag size={22} className="text-vn-ink" aria-hidden />
              {itemCount > 0 && (
                <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-vn-wine px-1 font-sans text-[0.7rem] font-bold text-white">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>

            <button
              className="rounded-full p-2.5 transition-colors hover:bg-vn-olive-50 lg:hidden"
              onClick={() => setMenuAberto(v => !v)}
              aria-expanded={menuAberto}
              aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            >
              {menuAberto ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {menuAberto && (
        <div className="border-t border-vn-olive-100 bg-[#faf9f3] lg:hidden">
          <div className="container-vn py-5">
            <form onSubmit={buscar} className="mb-5 md:hidden" role="search">
              <label htmlFor="busca-mobile" className="sr-only">
                Buscar produtos
              </label>
              <div className="relative">
                <input
                  id="busca-mobile"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar peças…"
                  className="w-full rounded-full border border-vn-olive-200 bg-white py-3 pl-4 pr-11 font-sans text-vn-ink"
                />
                <button
                  type="submit"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-vn-olive-600"
                  aria-label="Buscar"
                >
                  <Search size={18} />
                </button>
              </div>
            </form>

            <nav className="flex flex-col" aria-label="Principal">
              <Link
                href="/loja"
                className="border-b border-vn-olive-100 py-3.5 font-sans font-semibold text-vn-ink no-underline"
              >
                Ver toda a loja
              </Link>
              {categorias.map(c => (
                <Link
                  key={c.id}
                  href={`/loja?categoria=${c.slug}`}
                  className="border-b border-vn-olive-100 py-3.5 font-sans text-vn-ink no-underline"
                >
                  {c.name}
                </Link>
              ))}
              {LINKS_FIXOS.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="border-b border-vn-olive-100 py-3.5 font-sans text-vn-ink no-underline"
                >
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
