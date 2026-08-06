import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

/**
 * Abertura da home: promessa da marca à esquerda, editorial à direita.
 * A imagem é a única com carregamento prioritário da página (LCP).
 */
export default function HeroSection() {
  return (
    <section className="bg-sand">
      <div className="container-vn">
        <div className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-14 md:py-20 lg:py-24">
          <div>
            <p className="eyebrow">Coleção outono · inverno</p>

            <h1 className="mt-5 text-[2.75rem] leading-[1.08] text-balance md:text-[3.5rem] lg:text-[4rem]">
              Peças que ficam <em className="italic">boas</em> em você
              <br />
              muito depois da temporada
            </h1>

            <p className="mt-6 max-w-lg font-sans text-[1.0625rem] leading-relaxed text-vn-ink-soft md:text-[1.125rem]">
              Alfaiataria, tricô e vestidos escolhidos peça a peça em Monte Alto. Moda,
              beleza e poder desde 2017 — para mulheres que sabem o que querem.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/loja" className="btn-olive no-underline">
                Ver a coleção
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/sobre" className="btn-outline-olive no-underline">
                Conheça a marca
              </Link>
            </div>

            <p className="mt-7 font-sans text-sm text-vn-ink-soft">
              Enviamos para todo o Brasil · Frete grátis acima de R$ 399
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-fashion overflow-hidden rounded-2xl">
              <img
                src="/uploads/produtos/vn-03.webp"
                alt="Conjunto de alfaiataria em linho off-white"
                width={523}
                height={697}
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-10 aspect-fashion overflow-hidden rounded-2xl">
              <img
                src="/uploads/produtos/vn-07.webp"
                alt="Trench coat caramelo com jeans"
                width={523}
                height={697}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
