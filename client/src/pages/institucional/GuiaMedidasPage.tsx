import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { whatsappCom } from "@/lib/marca";

const medidas = [
  ["PP", "80–84", "62–66", "88–92"],
  ["P", "85–89", "67–71", "93–97"],
  ["M", "90–96", "72–78", "98–104"],
  ["G", "97–103", "79–85", "105–111"],
  ["GG", "104–112", "86–94", "112–120"],
];

export default function GuiaMedidasPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bleed py-16 md:py-24">
          <div className="w-full">
            <p className="eyebrow">Escolha com confiança</p>
            <h1 className="display-hero mt-5 max-w-4xl text-balance">Guia de medidas</h1>
            <p className="mt-6 max-w-3xl text-[1.125rem] leading-relaxed text-vn-ink-soft">
              Compare suas medidas com a tabela para encontrar o tamanho mais próximo. A modelagem pode variar entre peças; por isso, consulte também a descrição do produto.
            </p>
          </div>
        </section>

        <section className="bleed py-16 md:py-24 bg-alt">
          <div className="w-full">
            <div className="overflow-x-auto  border border-vn-olive-200 bg-white">
              <table className="w-full min-w-[40rem] border-collapse text-left text-[1.0625rem] text-vn-ink-soft">
                <caption className="p-5 text-left font-display text-[1.75rem] font-semibold text-vn-ink">Medidas do corpo em centímetros</caption>
                <thead className="bg-vn-olive-100 text-vn-ink">
                  <tr><th scope="col" className="p-4">Tamanho</th><th scope="col" className="p-4">Busto</th><th scope="col" className="p-4">Cintura</th><th scope="col" className="p-4">Quadril</th></tr>
                </thead>
                <tbody>
                  {medidas.map(([tamanho, busto, cintura, quadril]) => (
                    <tr key={tamanho} className="border-t border-vn-olive-100">
                      <th scope="row" className="p-4 font-semibold text-vn-ink">{tamanho}</th><td className="p-4">{busto}</td><td className="p-4">{cintura}</td><td className="p-4">{quadril}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bleed py-16 md:py-24">
          <div className="w-full grid gap-12 md:grid-cols-2 md:gap-20">
            <div>
              <p className="eyebrow">Passo a passo</p>
              <h2 className="display-md mt-4">Como se medir</h2>
              <p className="mt-5 text-[1.0625rem] text-vn-ink-soft">Use uma fita métrica flexível, mantenha-a paralela ao chão e vista roupas leves. Não aperte a fita e, se puder, peça ajuda a alguém.</p>
            </div>
            <dl className="space-y-6 text-[1.0625rem] text-vn-ink-soft">
              <div><dt className="font-semibold text-vn-ink">Busto</dt><dd className="mt-1">Contorne a parte mais cheia do busto, passando a fita pelas costas.</dd></div>
              <div><dt className="font-semibold text-vn-ink">Cintura</dt><dd className="mt-1">Meça a parte mais estreita do tronco, sem prender a respiração.</dd></div>
              <div><dt className="font-semibold text-vn-ink">Quadril</dt><dd className="mt-1">Contorne a região mais larga do quadril e dos glúteos, com os pés juntos.</dd></div>
            </dl>
          </div>
          <div className="w-full mt-14">
            <div className="bg-sand p-7 text-center md:p-10">
              <h2 className="display-md">Ficou entre dois tamanhos?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-[1.0625rem] text-vn-ink-soft">Chame a gente no WhatsApp. Conhecemos o caimento de cada peça e ajudamos você a escolher com segurança.</p>
              <a href={whatsappCom("Oi! Preciso de ajuda para escolher meu tamanho.")} target="_blank" rel="noopener noreferrer" className="btn-ink mt-7 no-underline">Pedir ajuda no WhatsApp</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
