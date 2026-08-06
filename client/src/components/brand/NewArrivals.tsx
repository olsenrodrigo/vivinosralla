import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
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

  return (
    <section className="section-padding bg-alt">
      <div className="container-vn">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{chapeu}</p>
            <h2 className="mt-3 text-[2.25rem] md:text-[2.75rem]">{titulo}</h2>
          </div>
          <Link
            href="/loja"
            className="inline-flex items-center gap-2 font-sans font-semibold text-vn-olive-700 no-underline hover:text-vn-olive-800"
          >
            Ver tudo
            <ArrowRight size={17} aria-hidden />
          </Link>
        </header>

        {isLoading ? (
          <div className="mt-11 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-fashion animate-pulse rounded-xl bg-vn-olive-100" />
            ))}
          </div>
        ) : (
          <ul className="mt-11 grid grid-cols-2 gap-x-5 gap-y-9 lg:grid-cols-4">
            {produtos.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} priority={i < 2} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
