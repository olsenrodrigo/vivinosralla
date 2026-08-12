import { INSTAGRAM_URL, INSTAGRAM_HANDLE } from "@/lib/marca";

/** Fotos reais de clientes/looks do Instagram da marca. */
const FEED = [
  "vn-06.webp",
  "vn-18.webp",
  "vn-13.webp",
  "vn-23.webp",
  "vn-25.webp",
  "vn-28.webp",
];

/**
 * Mural do Instagram — prova social em chapa quadrada, colada e sangrando.
 * As garantias de compra ficam na faixa de recados e na página da peça;
 * repeti-las aqui só somaria ruído.
 */
export default function SocialProof() {
  return (
    <section aria-labelledby="instagram-titulo" data-secao="prova-social">
      <div className="bleed pb-9">
        <div className="rule flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-6">
          <div>
            <p className="eyebrow">No nosso Instagram</p>
            <h2 id="instagram-titulo" className="display-md mt-2.5">
              Como as clientes usam
            </h2>
          </div>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="link-rule mb-1 text-vn-olive-600"
          >
            {INSTAGRAM_HANDLE}
          </a>
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-[var(--vn-gutter)] md:grid-cols-6">
        {FEED.map(arquivo => (
          <li key={arquivo}>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="plate group block aspect-square"
            >
              <img
                src={`/uploads/produtos/${arquivo}`}
                alt="Look publicado no Instagram da Vivi Nosralla"
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
