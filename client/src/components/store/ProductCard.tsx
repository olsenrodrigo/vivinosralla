import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { corHex, precoBR } from "@/lib/marca";

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
  /** Grade do hover: um item por tamanho distinto entre as variações ativas. */
  tamanhos?: { tamanho: string; disponivel: boolean }[];
}

interface ProductCardProps {
  product: ProdutoCard;
  /** Prioriza o carregamento das primeiras imagens da grade (LCP). */
  priority?: boolean;
}

/**
 * Card de produto da vitrine.
 *
 * Chapa reta, sem sombra e sem raio: a foto é o card. As setas trocam a
 * imagem sem tirar a cliente da grade — dá para conferir o caimento de
 * costas antes de decidir abrir a peça.
 *
 * Com o ponteiro sobre a chapa, a segunda foto entra no lugar da capa e a
 * grade de tamanhos sobe por baixo (REQ-2.8, REQ-2.14): dá para varrer a
 * vitrine sabendo o que serve, sem abrir peça por peça.
 *
 * Roupa exige escolher tamanho, então o card NÃO adiciona ao carrinho
 * direto: escolher o tamanho aqui leva à peça com ele já selecionado
 * (REQ-2.10). A cliente ainda vê medida e composição antes de comprar.
 */
export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const [indice, setIndice] = useState(0);
  // Hover e foco compartilham o mesmo estado: sem isso a grade seria
  // inalcançável por teclado (REQ-2.12). `pointer: coarse` nunca liga —
  // no toque não existe hover, e o dedo na foto tem de abrir a peça (REQ-2.13).
  const [aberto, setAberto] = useState(false);

  const emEstoque = product.stockQuantity > 0;
  const temDesconto =
    !!product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price);
  const descontoPct = temDesconto
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  // A capa vem primeiro; as demais fotos entram na ordem do catálogo, sem repetir.
  const capa = product.mainImage ?? product.images?.[0]?.url ?? null;
  const fotos = capa
    ? [capa, ...(product.images ?? []).map(i => i.url).filter(u => u !== capa)]
    : [];
  const varias = fotos.length > 1;
  // A troca no hover só vale enquanto a cliente não assumiu o comando pelas
  // setas: depois disso, mandar a foto de volta sozinha seria roubo de controle.
  const trocaNoHover = aberto && varias && indice === 0;
  const atual = (trocaNoHover ? fotos[1] : fotos[indice]) ?? capa;

  const tamanhos = product.tamanhos ?? [];
  const mostraGrade = aberto && emEstoque && tamanhos.length > 0;

  const irPara = (passo: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndice(i => (i + passo + fotos.length) % fotos.length);
  };

  return (
    <article
      className="group relative"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
      // Foco em qualquer elemento interno abre a grade; sair dela fecha.
      onFocus={() => setAberto(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
    >
      <div className="plate aspect-fashion">
        {atual ? (
          <img
            key={atual}
            src={atual}
            alt={product.title}
            width={523}
            height={697}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-vn-olive-300">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
              <rect x="3" y="3" width="18" height="18" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {varias && (
          <>
            <button
              type="button"
              onClick={irPara(-1)}
              aria-label={`Foto anterior de ${product.title}`}
              className="absolute left-0 top-1/2 z-20 hidden h-11 w-9 -translate-y-1/2 items-center justify-center bg-background/70 text-vn-ink opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 md:flex"
            >
              <ChevronLeft size={17} aria-hidden />
            </button>
            <button
              type="button"
              onClick={irPara(1)}
              aria-label={`Próxima foto de ${product.title}`}
              className="absolute right-0 top-1/2 z-20 hidden h-11 w-9 -translate-y-1/2 items-center justify-center bg-background/70 text-vn-ink opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 md:flex"
            >
              <ChevronRight size={17} aria-hidden />
            </button>
          </>
        )}

        {temDesconto && emEstoque && (
          <span className="nav-label absolute left-0 top-0 z-10 bg-vn-wine px-2.5 py-1.5 text-white">
            −{descontoPct}%
          </span>
        )}

        {!emEstoque && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-vn-ice/75">
            <span className="nav-label border border-vn-ink px-4 py-2 text-vn-ink">Esgotado</span>
          </div>
        )}

        {/* Grade de tamanhos (REQ-2.8 … REQ-2.12).
            z-30 fica acima do link esticado (z-10) e das setas (z-20), senão o
            clique no tamanho seria engolido pela capa clicável do card.
            `hidden` até md e `pointer-coarse:hidden`: no toque não há hover, e
            o dedo na foto precisa abrir a peça (REQ-2.13). */}
        {mostraGrade && (
          <div className="pointer-coarse:hidden absolute inset-x-0 bottom-0 z-30 hidden justify-center gap-1.5 overflow-x-auto bg-background/92 px-3 py-2.5 backdrop-blur-[2px] md:flex">
            {tamanhos.map(({ tamanho, disponivel }) =>
              disponivel ? (
                <Link
                  key={tamanho}
                  href={`/loja/produto/${product.slug}?tamanho=${encodeURIComponent(tamanho)}`}
                  aria-label={`${product.title}, tamanho ${tamanho}`}
                  className="nav-label flex h-9 min-w-9 shrink-0 items-center justify-center border border-vn-olive-200 px-2 text-vn-ink no-underline transition-colors hover:border-vn-olive-600 hover:bg-vn-olive-600 hover:text-white focus-visible:border-vn-olive-600"
                >
                  {tamanho}
                </Link>
              ) : (
                // Esgotado continua visível e não acionável (REQ-2.9): sumir
                // com ele esconderia que a peça existe naquele tamanho.
                <span
                  key={tamanho}
                  aria-disabled="true"
                  title={`Tamanho ${tamanho} esgotado`}
                  className="nav-label flex h-9 min-w-9 shrink-0 items-center justify-center border border-vn-olive-200/50 px-2 text-vn-ink-soft/45 line-through"
                >
                  {tamanho}
                </span>
              ),
            )}
          </div>
        )}
      </div>

      {/* O respiro à direita separa o texto desta coluna do da coluna vizinha,
          já que as chapas ficam a 2px uma da outra. */}
      <div className="pb-1 pr-5 pt-3.5 md:pr-8">
        {!!product.cores?.length && (
          <ul className="mb-2.5 flex items-center gap-[3px]" aria-label="Cores disponíveis">
            {product.cores.slice(0, 6).map(cor => (
              <li
                key={cor}
                title={cor}
                className="h-[3px] w-5 border border-vn-olive-200/60"
                style={{ background: corHex(cor) }}
              >
                <span className="sr-only">{cor}</span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="font-sans text-[0.9375rem] font-medium leading-snug text-vn-ink">
          {/* Link esticado: cobre a chapa inteira sem envolver as setas. */}
          <Link
            href={`/loja/produto/${product.slug}`}
            className="no-underline before:absolute before:inset-0 before:z-10 before:content-['']"
          >
            {product.title}
          </Link>
        </h3>

        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-sans text-[0.9375rem] text-vn-ink-soft">
            {precoBR(product.price)}
          </span>
          {temDesconto && (
            <span className="font-sans text-[0.8125rem] text-vn-ink-soft/60 line-through">
              {precoBR(product.compareAtPrice!)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
