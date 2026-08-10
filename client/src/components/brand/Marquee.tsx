import { FRETE_GRATIS_ACIMA, precoBR } from "@/lib/marca";
import { PIX_DESCONTO } from "@shared/pagamento";

/**
 * Faixa de recados logo abaixo da abertura.
 *
 * É o único movimento contínuo do site — e carrega informação real de
 * compra, não enfeite. Congela para quem pediu menos movimento no sistema
 * (regra em index.css).
 */
const RECADOS = [
  "Enviamos para todo o Brasil",
  `Frete grátis acima de ${precoBR(FRETE_GRATIS_ACIMA)}`,
  "30 dias para trocar o tamanho",
  `${Math.round(PIX_DESCONTO * 100)}% de desconto no PIX`,
  "Dúvida de caimento? Chame no WhatsApp",
  "Loja física em Monte Alto · SP",
];

export default function Marquee() {
  return (
    <div className="overflow-hidden border-y border-vn-olive-200 bg-vn-ink py-3.5" role="complementary" aria-label="Informações de compra">
      <div className="marquee-track">
        {/* Duas voltas idênticas: a animação desloca -50% e emenda sem corte. */}
        {[0, 1].map(volta => (
          <ul key={volta} className="flex shrink-0 items-center" aria-hidden={volta === 1}>
            {RECADOS.map(r => (
              <li
                key={r}
                className="nav-label flex items-center whitespace-nowrap text-vn-ice/85"
              >
                <span className="px-7">{r}</span>
                <span className="h-1 w-1 rounded-full bg-vn-olive-400" aria-hidden />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
