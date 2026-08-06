import { Link } from "wouter";
import { DESDE } from "@/lib/marca";

const NUMEROS = [
  { valor: `${new Date().getFullYear() - DESDE}+`, rotulo: "anos vestindo mulheres" },
  { valor: "Monte Alto", rotulo: "loja física, SP" },
  { valor: "Brasil", rotulo: "enviamos para todo o país" },
];

/** Prévia do "Sobre" na home — dá contexto humano antes de pedir a compra. */
export default function AboutTeaser() {
  return (
    <section className="section-padding">
      <div className="container-vn">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <div className="order-2 grid grid-cols-2 gap-4 md:order-1">
            <div className="aspect-fashion overflow-hidden rounded-2xl">
              <img
                src="/uploads/produtos/vn-02.webp"
                alt="Cliente vestindo blazer de alfaiataria azul-marinho"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-10 aspect-fashion overflow-hidden rounded-2xl">
              <img
                src="/uploads/produtos/vn-14.webp"
                alt="Camisa de tricoline com saia midi no provador da loja"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="order-1 md:order-2">
            <p className="eyebrow">A marca</p>
            <h2 className="mt-4 text-[2.25rem] text-balance md:text-[2.75rem]">
              Atemporal, para mulheres objetivas
            </h2>

            <div className="mt-6 space-y-4 font-sans text-[1.0625rem] leading-relaxed text-vn-ink-soft">
              <p>
                A VIVI NOSRALLA nasceu em {DESDE} com uma ideia simples: uma mulher não deveria
                precisar escolher entre se sentir confortável e se sentir bonita.
              </p>
              <p>
                Cada peça do nosso provador é escolhida pensando em quem vai vestir — do
                caimento que respeita o corpo real ao tecido que aguenta o dia inteiro. Aqui
                atendemos dos 30 aos 70 anos, e isso não é detalhe: é o projeto.
              </p>
            </div>

            <dl className="mt-9 grid grid-cols-3 gap-5 border-t border-vn-olive-200 pt-7">
              {NUMEROS.map(n => (
                <div key={n.rotulo}>
                  <dt className="sr-only">{n.rotulo}</dt>
                  <dd>
                    <span className="block font-display text-2xl font-semibold text-vn-olive-700 md:text-[1.75rem]">
                      {n.valor}
                    </span>
                    <span className="mt-1 block font-sans text-sm leading-snug text-vn-ink-soft">
                      {n.rotulo}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            <Link href="/sobre" className="btn-outline-olive mt-9 no-underline">
              Nossa história
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
