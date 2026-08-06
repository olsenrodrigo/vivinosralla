import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { CIDADE, DESDE } from "@/lib/marca";

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="section-padding">
          <div className="container-vn">
            <div className="max-w-3xl">
              <p className="eyebrow">Sobre a VIVI NOSRALLA</p>
              <h1 className="mt-4 text-[2.75rem] text-balance md:text-[4rem]">Moda para a vida real, desde {DESDE}</h1>
              <p className="mt-6 text-[1.125rem] leading-relaxed text-vn-ink-soft">
                Atemporal, para mulheres objetivas. Nossa história é feita de escolhas cuidadosas,
                conversa próxima e roupas que acompanham cada mulher com beleza e confiança.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                ["vn-02.webp", "Mulher usando blazer de alfaiataria azul-marinho"],
                ["vn-14.webp", "Mulher com camisa e saia midi em uma produção elegante"],
                ["vn-22.webp", "Produção feminina contemporânea selecionada pela VIVI NOSRALLA"],
              ].map(([arquivo, alt], index) => (
                <div key={arquivo} className={`aspect-fashion overflow-hidden rounded-2xl ${index === 1 ? "md:mt-10" : ""}`}>
                  <img src={`/uploads/produtos/${arquivo}`} alt={alt} loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-padding bg-alt">
          <div className="container-vn grid gap-12 md:grid-cols-2 md:gap-20">
            <div>
              <p className="eyebrow">Nossa história</p>
              <h2 className="mt-4 text-[2.25rem] md:text-[2.75rem]">Uma marca que nasceu do encontro</h2>
            </div>
            <div className="space-y-5 text-[1.0625rem] leading-relaxed text-vn-ink-soft">
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

        <section className="section-padding">
          <div className="container-vn">
            <div className="mx-auto max-w-4xl text-center">
              <p className="eyebrow">Nosso compromisso</p>
              <h2 className="mt-4 text-[2.25rem] text-balance md:text-[2.75rem]">Caimento que respeita corpos reais</h2>
              <p className="mx-auto mt-6 max-w-3xl text-[1.0625rem] leading-relaxed text-vn-ink-soft">
                Atendemos mulheres dos 30 aos 70 anos porque estilo não tem prazo. Observamos modelagem,
                tecido e conforto para indicar o que realmente funciona em cada corpo e rotina. Esse
                cuidado atravessa o balcão da loja e chega a todo o Brasil pelo nosso atendimento online.
              </p>
              <div className="divider-vn mx-auto mt-10 max-w-xs" aria-hidden>vn</div>
              <Link href="/loja" className="btn-olive mt-10 no-underline">Conheça nossa curadoria</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
