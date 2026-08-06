import { Link } from "wouter";
import { precoBR } from "@/lib/marca";

export interface ProdutoCard {
  id: number;
  title: string;
  slug: string;
  price: string;
  compareAtPrice?: string | null;
  mainImage?: string | null;
  images?: { url: string; altText?: string | null }[];
  stockQuantity: number;
  status: string;
  cores?: string[];
}

interface ProductCardProps {
  product: ProdutoCard;
  /** Prioriza o carregamento das primeiras imagens da grade (LCP). */
  priority?: boolean;
}

/**
 * Card de produto da vitrine.
 *
 * Roupa exige escolher tamanho, então o card NÃO adiciona ao carrinho direto:
 * o clique leva à página do produto, onde tamanho e cor são selecionados.
 */
export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const emEstoque = product.stockQuantity > 0;
  const temDesconto =
    !!product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price);
  const descontoPct = temDesconto
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  const capa = product.mainImage ?? product.images?.[0]?.url ?? null;
  const hover = product.images?.[1]?.url ?? null;

  return (
    <Link
      href={`/loja/produto/${product.slug}`}
      className="group block no-underline focus-visible:outline-none"
    >
      <article>
        <div className="relative aspect-fashion overflow-hidden rounded-xl bg-vn-olive-50">
          {capa ? (
            <>
              <img
                src={capa}
                alt={product.title}
                width={523}
                height={697}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : undefined}
                className={`h-full w-full object-cover transition-opacity duration-500 ${
                  hover ? "group-hover:opacity-0" : "group-hover:scale-[1.03]"
                }`}
              />
              {hover && (
                <img
                  src={hover}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-vn-olive-300">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}

          {temDesconto && emEstoque && (
            <span className="absolute left-3 top-3 rounded-full bg-vn-wine px-2.5 py-1 font-sans text-xs font-bold text-white">
              −{descontoPct}%
            </span>
          )}

          {!emEstoque && (
            <div className="absolute inset-0 flex items-center justify-center bg-vn-ice/70">
              <span className="rounded-full bg-vn-ink px-4 py-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-vn-ice">
                Esgotado
              </span>
            </div>
          )}
        </div>

        <div className="pt-3.5">
          <h3 className="font-sans text-[0.975rem] font-medium leading-snug text-vn-ink">
            {product.title}
          </h3>

          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-sans text-[1.05rem] font-semibold text-vn-ink">
              {precoBR(product.price)}
            </span>
            {temDesconto && (
              <span className="font-sans text-sm text-vn-ink-soft/70 line-through">
                {precoBR(product.compareAtPrice!)}
              </span>
            )}
          </div>

          {!!product.cores?.length && (
            <ul className="mt-2.5 flex items-center gap-1.5" aria-label="Cores disponíveis">
              {product.cores.slice(0, 5).map(cor => (
                <li
                  key={cor}
                  title={cor}
                  className="h-3.5 w-3.5 rounded-full border border-vn-olive-200"
                  style={{ background: cor }}
                >
                  <span className="sr-only">{cor}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </Link>
  );
}
