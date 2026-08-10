import { Link } from "wouter";
import Logo from "@/components/brand/Logo";
import {
  WHATSAPP_URL,
  WHATSAPP_LABEL,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  EMAIL,
  CIDADE,
  FRETE_GRATIS_ACIMA,
  precoBR,
} from "@/lib/marca";

const INSTITUCIONAL = [
  { href: "/sobre", label: "Sobre a marca" },
  { href: "/loja", label: "Loja" },
  { href: "/contato", label: "Contato" },
];

const AJUDA = [
  { href: "/guia-de-medidas", label: "Guia de medidas" },
  { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
  { href: "/privacidade", label: "Política de privacidade" },
];

/** Rodapé editorial: fios finos, caixa-alta e nada de caixa central. */
export default function Footer() {
  return (
    <footer className="border-t border-vn-olive-200 bg-background">
      <div className="bleed py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Logo variante="lockup" tom="oliva" className="h-10" />
            <p className="measure mt-6 font-sans text-[0.95rem] leading-relaxed text-vn-ink-soft">
              Moda, beleza e poder desde 2017. Peças atemporais para mulheres objetivas, escolhidas
              peça a peça em Monte Alto.
            </p>
          </div>

          <nav aria-label="Institucional" className="md:col-span-2">
            <h2 className="eyebrow">Institucional</h2>
            <ul className="mt-5 space-y-3">
              {INSTITUCIONAL.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-sans text-[0.95rem] text-vn-ink no-underline transition-colors hover:text-vn-olive-600"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Ajuda" className="md:col-span-3">
            <h2 className="eyebrow">Ajuda</h2>
            <ul className="mt-5 space-y-3">
              {AJUDA.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-sans text-[0.95rem] text-vn-ink no-underline transition-colors hover:text-vn-olive-600"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-3">
            <h2 className="eyebrow">Fale com a gente</h2>
            <ul className="mt-5 space-y-3 font-sans text-[0.95rem]">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vn-ink no-underline transition-colors hover:text-vn-olive-600"
                >
                  WhatsApp {WHATSAPP_LABEL}
                </a>
              </li>
              <li>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vn-ink no-underline transition-colors hover:text-vn-olive-600"
                >
                  Instagram {INSTAGRAM_HANDLE}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="text-vn-ink no-underline transition-colors hover:text-vn-olive-600"
                >
                  {EMAIL}
                </a>
              </li>
              <li className="text-vn-ink-soft">{CIDADE}</li>
            </ul>
          </div>
        </div>

        <div className="rule mt-14 flex flex-col gap-2 pt-6 font-sans text-sm text-vn-ink-soft md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Viviane Nosralla. Todos os direitos reservados.</p>
          <p>
            Enviamos para todo o Brasil · Frete grátis acima de {precoBR(FRETE_GRATIS_ACIMA)}
          </p>
        </div>
      </div>
    </footer>
  );
}
