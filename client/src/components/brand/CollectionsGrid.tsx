import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface Categoria {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

/**
 * Grade de categorias — porta de entrada do catálogo a partir da home.
 *
 * Aqui as chapas sangram até a borda da tela, sem margem: é o bloco mais
 * "revista" da página. O nome da categoria vive sobre a foto, na base.
 */
export default function CollectionsGrid() {
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/store/categories"],
    queryFn: () => fetch("/api/store/categories").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  if (!categorias.length) return null;

  return (
    <section aria-labelledby="categorias-titulo" data-secao="colecoes">
      <div className="bleed pb-9">
        <div className="rule flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-6">
          <div>
            <p className="eyebrow">Escolha por categoria</p>
            <h2 id="categorias-titulo" className="display-md mt-2.5">
              Onde começar o seu look
            </h2>
          </div>
          <Link href="/loja" className="link-rule mb-1 text-vn-olive-600">
            Toda a loja
          </Link>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-[var(--vn-gutter)] md:grid-cols-3">
        {categorias.map(c => (
          <li key={c.id}>
            <Link
              href={`/loja?categoria=${c.slug}`}
              className="plate group block aspect-fashion no-underline"
            >
              {c.imageUrl && (
                <img
                  src={c.imageUrl}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                />
              )}
              {/* Gradiente garante contraste do texto sobre qualquer foto,
                  inclusive as de fundo claro (linho, off-white) */}
              <div className="absolute inset-0 bg-gradient-to-t from-vn-ink/85 via-vn-ink/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                <h3 className="font-display text-[1.375rem] text-vn-ice md:text-[1.75rem]">
                  {c.name}
                </h3>
                {c.description && (
                  <p className="mt-1.5 hidden max-w-xs font-sans text-sm leading-snug text-vn-ice/80 md:block">
                    {c.description}
                  </p>
                )}
                <span className="nav-label mt-3.5 inline-block text-vn-ice/90">Ver peças</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
