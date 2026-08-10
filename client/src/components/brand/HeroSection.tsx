import { Link } from "wouter";

/**
 * Abertura da home.
 *
 * A tela abre com uma faixa de chapas fotográficas sangrando de borda a
 * borda — o contato de fotografia de um lookbook. A legenda entra por baixo,
 * à esquerda, recortando a faixa: é o gesto que dá identidade à página.
 *
 * As fotos do acervo são retrato (523×697), então a faixa as usa na
 * proporção nativa em vez de esticar uma única imagem em tela cheia.
 * A primeira chapa é a única com carregamento prioritário (LCP).
 */
const CHAPAS = [
  { arquivo: "vn-04.webp", alt: "Blazer de alfaiataria azul-marinho no provador da loja" },
  { arquivo: "vn-01.webp", alt: "Blusa de tricô oliva bordada com calça de linho clara" },
  { arquivo: "vn-06.webp", alt: "Blazer marrom sobre camiseta e jeans reto" },
  { arquivo: "vn-08.webp", alt: "Conjunto de moletom cru com casaco marrom no ombro" },
];

export default function HeroSection() {
  return (
    <section aria-labelledby="hero-titulo">
      <div className="grid h-[52svh] min-h-[19rem] max-h-[34rem] grid-cols-2 gap-[var(--vn-gutter)] md:h-[62svh] md:max-h-[40rem] md:grid-cols-3 xl:grid-cols-4">
        {CHAPAS.map((c, i) => (
          <div
            key={c.arquivo}
            className={`plate h-full ${i === 2 ? "hidden md:block" : ""} ${i === 3 ? "hidden xl:block" : ""}`}
          >
            <img
              src={`/uploads/produtos/${c.arquivo}`}
              alt={c.alt}
              width={523}
              height={697}
              fetchPriority={i === 0 ? "high" : undefined}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <div className="bleed">
        <div className="relative -mt-14 max-w-[41rem] bg-background pb-14 pr-4 pt-7 md:-mt-24 md:pb-20 md:pr-14 md:pt-12">
          <p className="eyebrow">Coleção outono · inverno</p>

          <h1 id="hero-titulo" className="display-hero mt-5 text-balance">
            Fica boa em você <em className="italic">muito</em> depois da temporada
          </h1>

          <p className="measure mt-7 font-sans text-[1.0625rem] leading-relaxed text-vn-ink-soft md:text-[1.125rem]">
            Alfaiataria, tricô e vestidos escolhidos peça a peça em Monte Alto. Moda, beleza e
            poder desde 2017 — para mulheres que sabem o que querem.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-5">
            <Link href="/loja" className="btn-ink no-underline">
              Ver a coleção
            </Link>
            <Link href="/sobre" className="link-rule">
              Conheça a marca
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
