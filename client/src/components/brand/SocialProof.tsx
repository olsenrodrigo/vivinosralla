import { Instagram, Truck, RefreshCcw, MessageCircle } from "lucide-react";
import { INSTAGRAM_URL, INSTAGRAM_HANDLE, FRETE_GRATIS_ACIMA, precoBR } from "@/lib/marca";

const GARANTIAS = [
  {
    icone: Truck,
    titulo: "Frete grátis",
    texto: `Em compras acima de ${precoBR(FRETE_GRATIS_ACIMA)} para todo o Brasil.`,
  },
  {
    icone: RefreshCcw,
    titulo: "Troca sem stress",
    texto: "7 dias para desistir e 30 dias para trocar tamanho.",
  },
  {
    icone: MessageCircle,
    titulo: "Provador por WhatsApp",
    texto: "Ficou em dúvida no tamanho? A gente te ajuda a escolher.",
  },
];

/** Fotos reais de clientes/looks do Instagram da marca. */
const FEED = ["vn-06.webp", "vn-08.webp", "vn-13.webp", "vn-23.webp", "vn-25.webp", "vn-01.webp"];

export default function SocialProof() {
  return (
    <>
      <section className="border-y border-vn-olive-100 bg-white py-12">
        <div className="container-vn">
          <ul className="grid gap-8 md:grid-cols-3">
            {GARANTIAS.map(g => (
              <li key={g.titulo} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vn-olive-50 text-vn-olive-700">
                  <g.icone size={20} aria-hidden />
                </span>
                <div>
                  <h3 className="font-sans font-semibold text-vn-ink">{g.titulo}</h3>
                  <p className="mt-1 font-sans text-[0.95rem] leading-snug text-vn-ink-soft">
                    {g.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-vn">
          <header className="mx-auto max-w-xl text-center">
            <p className="eyebrow">No nosso Instagram</p>
            <h2 className="mt-4 text-[2.25rem] md:text-[2.75rem]">Como as clientes usam</h2>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 font-sans font-semibold text-vn-olive-700 no-underline hover:text-vn-olive-800"
            >
              <Instagram size={18} aria-hidden />
              {INSTAGRAM_HANDLE}
            </a>
          </header>

          <ul className="mt-11 grid grid-cols-3 gap-3 md:grid-cols-6">
            {FEED.map(arquivo => (
              <li key={arquivo}>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block aspect-square overflow-hidden rounded-xl"
                >
                  <img
                    src={`/uploads/produtos/${arquivo}`}
                    alt="Look publicado no Instagram da Vivi Nosralla"
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
