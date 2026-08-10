import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { whatsappCom } from "@/lib/marca";

export default function TrocasPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bleed py-16 md:py-24">
          <div className="w-full">
            <p className="eyebrow">Atendimento e cuidado</p>
            <h1 className="display-hero mt-5 max-w-4xl text-balance">Trocas e devoluções</h1>
            <p className="mt-6 max-w-3xl text-[1.125rem] leading-relaxed text-vn-ink-soft">
              Queremos que sua escolha vista bem e faça sentido para você. Reunimos aqui as condições e o passo a passo para uma solicitação tranquila.
            </p>
          </div>
        </section>

        <section className="bleed py-16 md:py-24 bg-alt">
          <div className="w-full grid gap-8 md:grid-cols-2">
            <article className="bg-white p-7 md:p-9">
              <h2 className="display-md">Devolução por arrependimento</h2>
              <p className="mt-4 text-[1.0625rem] text-vn-ink-soft">
                Em compras online, você pode desistir da compra em até 7 dias corridos após o recebimento, conforme o artigo 49 do Código de Defesa do Consumidor. Nesse caso, a devolução e o frete de retorno ficam por nossa conta.
              </p>
            </article>
            <article className="bg-white p-7 md:p-9">
              <h2 className="display-md">Troca de tamanho</h2>
              <p className="mt-4 text-[1.0625rem] text-vn-ink-soft">
                Para trocar o tamanho, fale conosco em até 30 dias corridos após o recebimento. O frete de retorno e o novo envio ficam por conta da cliente, salvo quando houver erro no pedido ou defeito confirmado.
              </p>
            </article>
            <article className="bg-white p-7 md:p-9">
              <h2 className="display-md">Condições da peça</h2>
              <p className="mt-4 text-[1.0625rem] text-vn-ink-soft">
                A peça deve estar sem uso, sem lavagem, sem odores ou ajustes, com a etiqueta original fixada e, sempre que possível, em sua embalagem. Após o recebimento, faremos uma conferência antes de concluir a troca ou devolução.
              </p>
            </article>
            <article className="bg-white p-7 md:p-9">
              <h2 className="display-md">Defeito ou envio incorreto</h2>
              <p className="mt-4 text-[1.0625rem] text-vn-ink-soft">
                Se a peça apresentar defeito ou for diferente do pedido, avise nossa equipe e envie fotos. Após a confirmação, assumimos os custos de frete e orientamos a solução adequada.
              </p>
            </article>
          </div>
        </section>

        <section className="bleed py-16 md:py-24">
          <div className="w-full max-w-4xl">
            <h2 className="display-md">Como solicitar</h2>
            <ol className="mt-6 list-decimal space-y-3 pl-6 text-[1.0625rem] text-vn-ink-soft">
              <li>Entre em contato pelo WhatsApp e informe o número do pedido.</li>
              <li>Conte o motivo da solicitação e, se necessário, envie fotos da peça.</li>
              <li>Aguarde as orientações de postagem antes de enviar o produto.</li>
            </ol>
            <h2 className="display-md mt-12">Reembolso</h2>
            <p className="mt-5 text-[1.0625rem] text-vn-ink-soft">
              Depois que a peça chegar e for conferida, solicitaremos o reembolso em até 7 dias úteis. O valor será devolvido pelo mesmo meio de pagamento; o prazo para aparecer na conta ou fatura depende da instituição financeira e, no cartão, pode seguir o fechamento da fatura.
            </p>
            <a href={whatsappCom("Olá! Gostaria de solicitar uma troca ou devolução.")} target="_blank" rel="noopener noreferrer" className="btn-wine mt-9 no-underline">Solicitar pelo WhatsApp</a>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
