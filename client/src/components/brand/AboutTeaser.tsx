import { Link } from "wouter";
import { DESDE } from "@/lib/marca";

const NUMEROS = [
  { rotulo: "Vestindo mulheres há", valor: `${new Date().getFullYear() - DESDE} anos` },
  { rotulo: "Loja física", valor: "Monte Alto · SP" },
  { rotulo: "Entregamos em", valor: "Todo o Brasil" },
];

/**
 * Manifesto da marca na home — a pausa entre dois blocos de imagem.
 * Aqui a tipografia manda: uma única foto, texto grande e os três fatos
 * da operação separados por fio.
 */
export default function AboutTeaser() {
  return (
    <section className="bg-sand" aria-labelledby="marca-titulo">
      <div className="bleed py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-12 md:gap-x-10 md:gap-y-12">
          <div className="md:col-span-7 lg:col-span-6">
            <p className="eyebrow text-vn-olive-700">A marca</p>

            <h2 id="marca-titulo" className="display-lg mt-5 text-balance">
              Atemporal, para mulheres <em className="italic">objetivas</em>
            </h2>

            <div className="mt-7 max-w-xl space-y-4 font-sans text-[1.0625rem] leading-relaxed text-vn-ink-soft">
              <p>
                A VIVI NOSRALLA nasceu em {DESDE} com uma ideia simples: uma mulher não deveria
                precisar escolher entre se sentir confortável e se sentir bonita.
              </p>
              <p>
                Cada peça do nosso provador é escolhida pensando em quem vai vestir — do caimento
                que respeita o corpo real ao tecido que aguenta o dia inteiro. Aqui atendemos dos
                30 aos 70 anos, e isso não é detalhe: é o projeto.
              </p>
            </div>

            <Link href="/sobre" className="link-rule mt-9">
              Nossa história
            </Link>

            <dl className="mt-12 grid grid-cols-1 border-t border-vn-olive-400/40 sm:grid-cols-3">
              {NUMEROS.map(n => (
                <div
                  key={n.rotulo}
                  className="border-b border-vn-olive-400/40 py-5 sm:border-b-0 sm:pr-6"
                >
                  <dt className="eyebrow text-vn-olive-700">{n.rotulo}</dt>
                  <dd className="mt-2 font-display text-[1.375rem] leading-tight text-vn-ink">
                    {n.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="md:col-span-4 md:col-start-9 lg:col-span-3 lg:col-start-10">
            <div className="plate aspect-fashion bg-vn-sand-300">
              <img
                src="/uploads/produtos/vn-05.webp"
                alt="Blusa peplum bege com saia midi oliva, no provador da loja"
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
