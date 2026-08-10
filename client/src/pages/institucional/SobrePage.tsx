import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { CIDADE, DESDE } from "@/lib/marca";

const CHAPAS: [string, string][] = [
  ["vn-02.webp", "Cliente usando blazer de alfaiataria azul-marinho"],
  ["vn-14.webp", "Camisa de tricoline com saia midi no provador da loja"],
  ["vn-22.webp", "Produção feminina contemporânea selecionada pela VIVI NOSRALLA"],
];

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bleed pb-12 pt-16 md:pb-16 md:pt-24">
          <p className="eyebrow">Sobre a VIVI NOSRALLA</p>
          <h1 className="display-hero mt-5 max-w-4xl text-balance">
            Moda para a vida real, desde {DESDE}
          </h1>
          <p className="measure mt-7 text-[1.125rem] leading-relaxed text-vn-ink-soft">
            Atemporal, para mulheres objetivas. Nossa história é feita de escolhas cuidadosas,
            conversa próxima e roupas que acompanham cada mulher com beleza e confiança.
          </p>
        </section>

        <div className="grid grid-cols-3 gap-[var(--vn-gutter)]">
          {CHAPAS.map(([arquivo, alt]) => (
            <div key={arquivo} className="plate aspect-fashion">
              <img
                src={`/uploads/produtos/${arquivo}`}
                alt={alt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>

        <section className="bleed py-16 md:py-24">
          <div className="rule grid gap-8 pt-8 md:grid-cols-12 md:gap-x-10">
            <div className="md:col-span-5">
              <p className="eyebrow">Nossa história</p>
              <h2 className="display-lg mt-4 text-balance">Uma marca que nasceu do encontro</h2>
            </div>
            <div className="space-y-5 text-[1.0625rem] leading-relaxed text-vn-ink-soft md:col-span-6 md:col-start-7">
              <p>
                A VIVI NOSRALLA nasceu em {DESDE}, em {CIDADE}, com o desejo de tornar o vestir mais
                simples, elegante e verdadeiro. A loja física continua sendo nosso ponto de encontro:
                um espaço para experimentar, conversar e descobrir novas possibilidades.
              </p>
              <p>
                Nossa curadoria é feita peça a peça. Entre alfaiataria, vestidos, tricô, conjuntos,
                blusas e peças de festa, procuramos qualidade, versatilidade e aquele detalhe que faz
                uma roupa permanecer no armário por muitas estações.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-sand">
          <div className="bleed py-16 md:py-24">
            <div className="grid gap-8 md:grid-cols-12 md:gap-x-10">
              <div className="md:col-span-5">
                <p className="eyebrow text-vn-olive-700">Nosso compromisso</p>
                <h2 className="display-lg mt-4 text-balance">
                  Caimento que respeita corpos reais
                </h2>
              </div>
              <div className="md:col-span-6 md:col-start-7">
                <p className="text-[1.0625rem] leading-relaxed text-vn-ink-soft">
                  Atendemos mulheres dos 30 aos 70 anos porque estilo não tem prazo. Observamos
                  modelagem, tecido e conforto para indicar o que realmente funciona em cada corpo e
                  rotina. Esse cuidado atravessa o balcão da loja e chega a todo o Brasil pelo nosso
                  atendimento online.
                </p>
                <Link href="/loja" className="btn-ink mt-9 no-underline">
                  Conheça nossa curadoria
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
