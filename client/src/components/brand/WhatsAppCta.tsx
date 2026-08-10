import Logo from "@/components/brand/Logo";
import { GRUPO_OUTLET_URL, WHATSAPP_LABEL, whatsappCom } from "@/lib/marca";

/**
 * Fechamento da home. A marca vende de fato pelo WhatsApp (atendimento +
 * grupo de outlet), então o CTA aponta para os canais reais, não para uma
 * newsletter que ninguém opera.
 */
export default function WhatsAppCta() {
  return (
    <section className="bg-vn-ink text-vn-ice">
      <div className="bleed py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Logo variante="icone" tom="gelo" className="h-12" decorativo />

            <h2 className="display-lg mt-8 max-w-2xl text-balance text-vn-ice">
              Atendimento de loja, na palma da mão
            </h2>

            <p className="mt-6 max-w-lg font-sans text-[1.0625rem] leading-relaxed text-vn-ice/80">
              Dúvida de tamanho, caimento ou composição de look? Chame no WhatsApp que a gente
              responde — como se você estivesse no provador.
            </p>
          </div>

          <div className="md:col-span-5 md:col-start-8">
            <div className="flex flex-col items-stretch gap-3">
              <a
                href={whatsappCom("Oi! Vim pelo site e queria uma ajuda para escolher uma peça.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ice no-underline"
              >
                Falar no WhatsApp
              </a>
              <a
                href={GRUPO_OUTLET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ice-line no-underline"
              >
                Entrar no grupo Outlet
              </a>
            </div>

            <p className="rule-ice mt-6 pt-4 font-sans text-sm text-vn-ice/70">{WHATSAPP_LABEL}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
