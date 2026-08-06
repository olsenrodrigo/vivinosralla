import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface Categoria {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

/** Grade de categorias — porta de entrada do catálogo a partir da home. */
export default function CollectionsGrid() {
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/store/categories"],
    queryFn: () => fetch("/api/store/categories").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  if (!categorias.length) return null;

  return (
    <section className="section-padding">
      <div className="container-vn">
        <header className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Escolha por categoria</p>
          <h2 className="mt-4 text-[2.25rem] md:text-[2.75rem]">Onde começar o seu look</h2>
        </header>

        <ul className="mt-12 grid grid-cols-2 gap-5 lg:grid-cols-3">
          {categorias.map(c => (
            <li key={c.id}>
              <Link
                href={`/loja?categoria=${c.slug}`}
                className="group relative block overflow-hidden rounded-2xl no-underline"
              >
                <div className="aspect-[4/5] overflow-hidden bg-vn-olive-50 md:aspect-fashion">
                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                </div>
                {/* Gradiente garante contraste do texto sobre qualquer foto,
                    inclusive as de fundo claro (linho, off-white) */}
                <div className="absolute inset-0 bg-gradient-to-t from-vn-ink/90 via-vn-ink/45 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                  <h3 className="font-sans text-lg font-semibold text-white md:text-xl">{c.name}</h3>
                  {c.description && (
                    <p className="mt-1 hidden font-sans text-sm leading-snug text-white/85 md:block">
                      {c.description}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
