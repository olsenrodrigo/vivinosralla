import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { EMAIL } from "@/lib/marca";

const secoes = [
  ["Dados que coletamos", "Podemos coletar dados fornecidos no cadastro e no checkout, como nome, e-mail, telefone, CPF quando necessário, endereço de entrega e informações do pedido. Também registramos dados de navegação, preferências, itens do carrinho e carrinhos abandonados para manter a experiência de compra e, quando permitido, retomar o atendimento."],
  ["Como usamos seus dados", "Usamos essas informações para criar e administrar sua conta, processar pagamentos e pedidos, entregar produtos, prestar atendimento, prevenir fraudes, cumprir obrigações legais e fiscais e melhorar a loja. Comunicações promocionais são enviadas com consentimento ou outra base legal aplicável, sempre com opção de cancelamento."],
  ["Bases legais", "O tratamento ocorre conforme a Lei Geral de Proteção de Dados (LGPD), principalmente para executar o contrato de compra, cumprir obrigações legais, atender interesses legítimos com respeito aos seus direitos e, quando exigido, com seu consentimento."],
  ["Compartilhamento", "Compartilhamos somente os dados necessários com meios de pagamento, instituições financeiras, plataformas de tecnologia, transportadoras e serviços de entrega. Esses parceiros recebem as informações indispensáveis para executar suas funções e devem protegê-las de acordo com a legislação."],
  ["Cookies", "Usamos cookies essenciais para o funcionamento da loja, a manutenção do carrinho e a segurança. Cookies de análise e publicidade podem ser usados para entender a navegação e melhorar nossas comunicações. O aviso do componente CookieConsent permite aceitar ou gerenciar essa escolha, quando aplicável; você também pode ajustar cookies no navegador."],
  ["Conservação e segurança", "Mantemos os dados pelo tempo necessário às finalidades informadas e aos prazos legais. Adotamos medidas técnicas e administrativas para reduzir riscos de acesso, alteração, perda ou divulgação indevida, embora nenhum ambiente digital seja totalmente isento de riscos."],
];

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="section-padding">
          <div className="container-vn max-w-4xl">
            <p className="eyebrow">Seus dados, nosso cuidado</p>
            <h1 className="mt-4 text-[2.75rem] text-balance md:text-[4rem]">Política de privacidade</h1>
            <p className="mt-6 text-[1.125rem] text-vn-ink-soft">Última atualização: 4 de agosto de 2026.</p>
            <p className="mt-5 text-[1.0625rem] leading-relaxed text-vn-ink-soft">
              Esta política explica como a VIVI NOSRALLA trata dados pessoais durante sua navegação, compra e relacionamento conosco.
            </p>
          </div>
        </section>

        <section className="section-padding bg-alt">
          <div className="container-vn max-w-4xl space-y-10">
            {secoes.map(([titulo, texto]) => (
              <section key={titulo} aria-labelledby={`secao-${titulo.toLowerCase().replaceAll(" ", "-")}`}>
                <h2 id={`secao-${titulo.toLowerCase().replaceAll(" ", "-")}`} className="text-[2rem]">{titulo}</h2>
                <p className="mt-4 text-[1.0625rem] leading-relaxed text-vn-ink-soft">{texto}</p>
              </section>
            ))}
            <section aria-labelledby="direitos-titulo">
              <h2 id="direitos-titulo" className="text-[2rem]">Seus direitos</h2>
              <p className="mt-4 text-[1.0625rem] leading-relaxed text-vn-ink-soft">
                Você pode solicitar confirmação e acesso aos dados, correção, anonimização, bloqueio ou eliminação quando cabíveis, portabilidade, informação sobre compartilhamentos, revisão de decisões automatizadas e revogação do consentimento. Alguns dados poderão ser mantidos para cumprir deveres legais.
              </p>
            </section>
            <section aria-labelledby="canal-titulo">
              <h2 id="canal-titulo" className="text-[2rem]">Canal de privacidade</h2>
              <p className="mt-4 text-[1.0625rem] leading-relaxed text-vn-ink-soft">
                Para exercer seus direitos ou tirar dúvidas, escreva para <a href={`mailto:${EMAIL}`} className="inline-flex min-h-11 items-center break-all font-semibold text-vn-olive-700 underline">{EMAIL}</a>. Poderemos pedir informações para confirmar sua identidade e proteger seus dados.
              </p>
            </section>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
