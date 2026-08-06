import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Menu, X, Search, Store } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StoreNavbarProps {
  onSearch?: (q: string) => void;
  storeName?: string;
  primaryColor?: string;
  logoUrl?: string;
}

export default function StoreNavbar({ onSearch, storeName = "Loja Virtual", primaryColor = "#5B8C9B", logoUrl }: StoreNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const { itemCount } = useCart();
  const [, navigate] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQ);
    else navigate(`/loja?search=${encodeURIComponent(searchQ)}`);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: "1px solid #e5e7eb" }}>
      <div className="container mx-auto px-4">
        <div className="h-16 flex items-center justify-between gap-3">

          {/* Logo — always visible */}
          <Link href="/loja" className="flex items-center gap-2 font-bold text-xl no-underline shrink-0" style={{ color: primaryColor }}>
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-9 object-contain max-w-[160px]" />
            ) : (
              <>
                <Store size={22} />
                <span className="truncate max-w-[140px] sm:max-w-none">{storeName}</span>
              </>
            )}
          </Link>

          {/* Search bar — tablet and up (md+) */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-4">
            <div className="relative w-full">
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Buscar produtos..."
                className="pr-10"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Buscar"
              >
                <Search size={16} />
              </button>
            </div>
          </form>

          {/* Right-side actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* "Início do Site" link — desktop only */}
            <Link href="/" className="hidden lg:inline-flex text-sm text-gray-600 hover:text-gray-900 px-3 py-1 rounded no-underline whitespace-nowrap">
              Início do Site
            </Link>

            {/* Cart icon — always visible */}
            <Link href="/loja/carrinho" className="relative p-2 rounded-lg hover:bg-gray-100 no-underline" title="Carrinho">
              <ShoppingCart size={22} className="text-gray-700" />
              {itemCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                  style={{ background: primaryColor }}
                >
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-white px-4 py-3">
          <form onSubmit={handleSearch} className="mb-3">
            <div className="relative">
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Buscar produtos..."
                className="pr-10"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-label="Buscar"
              >
                <Search size={16} />
              </button>
            </div>
          </form>
          <Link href="/" className="block py-2 text-gray-600 no-underline" onClick={() => setMenuOpen(false)}>
            ← Voltar ao Site
          </Link>
        </div>
      )}
    </header>
  );
}
