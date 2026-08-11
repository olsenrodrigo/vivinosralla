import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { EMAIL } from "@/lib/marca";

const secoes = [
  ["Dados que coletamos", "Podemos coletar dados fornecidos no cadastro e no checkout, como nome, e-mail, telefone, CPF quando necessário, endereço de entrega e informações do pedido. Também registramos dados de navegação, preferências, itens do carrinho e carrinhos abandonados para manter a experiência de compra e, quando permitido, retomar o atendimento."],
  ["Como usamos seus dados", "Usamos essas informações para criar e administrar sua conta, processar pagamentos e pedidos, entregar produtos, prestar atendimento, prevenir fraudes, cumprir obrigações legais e fiscais e melhorar a loja. Comunicações promocionais são enviadas com consentimento ou outra base legal aplicável, sempre com opção de cancelamento."],
  ["Bases legais", "O tratamento ocorre conforme a Lei Geral de Proteção de Dados (LGPD), principalmente para executar o contrato de compra, cumprir obrigações legais, atender interesses legítimos com respeito aos seus direitos e, quando exigido, com seu consentimento."],
  ["Compartilhamento", "Compartilhamos somente os dados necessários com meios de pagamento, instituições financeiras, plataformas de tecnologia, transportadoras e serviços de entrega. Esses parceiros recebem as informações indispensáveis para executar suas funções e devem protegê-las de acordo com a legislação."],
  ["Provador virtual", "Se você usar o Provador Virtual, a foto que enviar é tratada apenas para gerar a simulação daquela peça em você. Para isso, ela é enviada ao Higgsfield, provedor de inteligência artificial parceiro, que pode processá-la em servidores fora do Brasil — essa transferência internacional acontece exclusivamente para essa finalidade. A foto é apagada em até 24 horas e a simulação em até 7 dias, automaticamente. Você pode apagar as duas antes disso, a qualquer momento, pelo botão \"Apagar minha foto\" na própria página da peça, ou pelo canal de privacidade abaixo. Sua foto não entra no catálogo, não fica visível para a equipe da loja e não é usada para treinar modelos de inteligência artificial. O envio só acontece depois do seu aceite explícito, e o recurso é destinado a maiores de 18 anos."],
  ["Cookies", "Usamos cookies essenciais para o funcionamento da loja, a manutenção do carrinho e a segurança. Cookies de análise e publicidade podem ser usados para entender a navegação e melhorar nossas comunicações. O aviso do componente CookieConsent permite aceitar ou gerenciar essa escolha, quando aplicável; você também pode ajustar cookies no navegador."],
  ["Conservação e segurança", "Mantemos os dados pelo tempo necessário às finalidades informadas e aos prazos legais. Adotamos medidas técnicas e administrativas para reduzir riscos de acesso, alteração, perda ou divulgação indevida, embora nenhum ambiente digital seja totalmente isento de riscos."],
];

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bleed py-16 md:py-24">
          <div className="w-full max-w-4xl">
            <p className="eyebrow">Seus dados, nosso cuidado</p>
            <h1 className="display-hero mt-5 max-w-4xl text-balance">Política de privacidade</h1>
            <p className="mt-6 text-[1.125rem] text-vn-ink-soft">Última atualização: 11 de agosto de 2026.</p>
            <p className="mt-5 text-[1.0625rem] leading-relaxed text-vn-ink-soft">
              Esta política explica como a VIVI NOSRALLA trata dados pessoais durante sua navegação, compra e relacionamento conosco.
            </p>
          </div>
        </section>

        <section className="bleed py-16 md:py-24 bg-alt">
          <div className="w-full max-w-4xl space-y-10">
            {secoes.map(([titulo, texto]) => (
              <section key={titulo} aria-labelledby={`secao-${titulo.toLowerCase().replaceAll(" ", "-")}`}>
                <h2 id={`secao-${titulo.toLowerCase().replaceAll(" ", "-")}`} className="display-md">{titulo}</h2>
                <p className="mt-4 text-[1.0625rem] leading-relaxed text-vn-ink-soft">{texto}</p>
              </section>
            ))}
            <section aria-labelledby="direitos-titulo">
              <h2 id="direitos-titulo" className="display-md">Seus direitos</h2>
              <p className="mt-4 text-[1.0625rem] leading-relaxed text-vn-ink-soft">
                Você pode solicitar confirmação e acesso aos dados, correção, anonimização, bloqueio ou eliminação quando cabíveis, portabilidade, informação sobre compartilhamentos, revisão de decisões automatizadas e revogação do consentimento. Alguns dados poderão ser mantidos para cumprir deveres legais.
              </p>
            </section>
            <section aria-labelledby="canal-titulo">
              <h2 id="canal-titulo" className="display-md">Canal de privacidade</h2>
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
