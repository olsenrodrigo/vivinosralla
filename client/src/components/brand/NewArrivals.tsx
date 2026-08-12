import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";

interface Resposta {
  products: ProdutoCard[];
}

interface NewArrivalsProps {
  /** `featured` mostra os destaques; caso contrário, os produtos mais recentes. */
  destaques?: boolean;
  titulo: string;
  chapeu: string;
  limite?: number;
}

/** Recorte da vitrine na home — mesma grade colada da loja. */
export default function NewArrivals({
  destaques = false,
  titulo,
  chapeu,
  limite = 8,
}: NewArrivalsProps) {
  const params = new URLSearchParams({ limit: String(limite) });
  if (destaques) params.set("featured", "true");
  const url = `/api/store/products?${params}`;

  const { data, isLoading } = useQuery<Resposta>({
    queryKey: [url],
    queryFn: () => fetch(url).then(r => r.json()),
    staleTime: 60_000,
  });

  const produtos = data?.products ?? [];

  // Loja sem peça publicada não mostra "Favoritas da estação" com nada embaixo
  // (REQ-1.4). O bloco só some depois de a resposta chegar: enquanto carrega, o
  // esqueleto segura o lugar e evita a home pulando na frente da visitante.
  if (!isLoading && produtos.length === 0) return null;

  return (
    <section className="bleed py-16 md:py-24" data-secao="novidades">
      <header className="rule flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-6">
        <div>
          <p className="eyebrow">{chapeu}</p>
          <h2 className="display-md mt-2.5">{titulo}</h2>
        </div>
        <Link href="/loja" className="link-rule mb-1 text-vn-olive-600">
          Ver tudo
        </Link>
      </header>

      {isLoading ? (
        <div className="grid-vitrine mt-9">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-fashion animate-pulse bg-vn-olive-100" />
          ))}
        </div>
      ) : (
        <ul className="grid-vitrine mt-9">
          {produtos.map((p, i) => (
            <li key={p.id}>
              <ProductCard product={p} priority={i < 2} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
