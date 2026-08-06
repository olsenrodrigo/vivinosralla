import { Link } from "wouter";
import { Instagram, MapPin, MessageCircle, Mail } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { WHATSAPP_URL, WHATSAPP_LABEL, INSTAGRAM_URL, INSTAGRAM_HANDLE, EMAIL, CIDADE } from "@/lib/marca";

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

export default function Footer() {
  return (
    <footer className="bg-vn-olive-700 text-vn-ice">
      <div className="container-vn py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          {/* Marca — ícone do logo, conforme o brandbook */}
          <div>
            <Logo variante="icone" tom="gelo" className="h-14" />
            <p className="mt-5 max-w-xs font-sans text-[0.95rem] leading-relaxed text-vn-ice/90">
              Moda, beleza e poder desde 2017. Peças atemporais para mulheres objetivas.
            </p>
          </div>

          <nav aria-label="Institucional">
            <h2 className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-vn-ice/90">
              Institucional
            </h2>
            <ul className="mt-4 space-y-2.5">
              {INSTITUCIONAL.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-sans text-[0.95rem] text-vn-ice no-underline transition-opacity hover:opacity-75"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Ajuda">
            <h2 className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-vn-ice/90">
              Ajuda
            </h2>
            <ul className="mt-4 space-y-2.5">
              {AJUDA.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-sans text-[0.95rem] text-vn-ice no-underline transition-opacity hover:opacity-75"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.18em] text-vn-ice/90">
              Fale com a gente
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 font-sans text-[0.95rem] text-vn-ice no-underline transition-opacity hover:opacity-75"
                >
                  <MessageCircle size={17} aria-hidden />
                  {WHATSAPP_LABEL}
                </a>
              </li>
              <li>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 font-sans text-[0.95rem] text-vn-ice no-underline transition-opacity hover:opacity-75"
                >
                  <Instagram size={17} aria-hidden />
                  {INSTAGRAM_HANDLE}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="flex items-center gap-2.5 font-sans text-[0.95rem] text-vn-ice no-underline transition-opacity hover:opacity-75"
                >
                  <Mail size={17} aria-hidden />
                  {EMAIL}
                </a>
              </li>
              <li className="flex items-center gap-2.5 font-sans text-[0.95rem] text-vn-ice/90">
                <MapPin size={17} aria-hidden />
                {CIDADE}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-vn-ice/20 pt-7 md:flex-row md:items-center md:justify-between">
          <p className="font-sans text-sm text-vn-ice/90">
            © {new Date().getFullYear()} Viviane Nosralla. Todos os direitos reservados.
          </p>
          <p className="font-sans text-sm text-vn-ice/90">
            Enviamos para todo o Brasil · Frete grátis acima de R$ 399
          </p>
        </div>
      </div>
    </footer>
  );
}
