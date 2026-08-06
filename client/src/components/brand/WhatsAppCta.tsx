import { MessageCircle, Tag } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { GRUPO_OUTLET_URL, WHATSAPP_LABEL, whatsappCom } from "@/lib/marca";

/**
 * Fechamento da home. A marca vende de fato pelo WhatsApp (atendimento +
 * grupo de outlet), então o CTA aponta para os canais reais, não para uma
 * newsletter que ninguém opera.
 */
export default function WhatsAppCta() {
  return (
    <section className="bg-vn-olive-700 py-16 text-vn-ice md:py-20">
      <div className="container-vn">
        <div className="mx-auto max-w-3xl text-center">
          <Logo variante="icone" tom="gelo" className="mx-auto h-14" decorativo />

          <h2 className="mt-7 text-[2.25rem] text-vn-ice text-balance md:text-[2.75rem]">
            Atendimento de loja, na palma da mão
          </h2>

          <p className="mx-auto mt-5 max-w-xl font-sans text-[1.0625rem] leading-relaxed text-vn-ice">
            Dúvida de tamanho, caimento ou composição de look? Chama no WhatsApp que a gente
            responde — como se você estivesse no provador.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={whatsappCom("Oi! Vim pelo site e queria uma ajuda para escolher uma peça.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill bg-vn-ice text-vn-olive-800 no-underline hover:bg-white"
            >
              <MessageCircle size={18} aria-hidden />
              Falar no WhatsApp
            </a>
            <a
              href={GRUPO_OUTLET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill border border-vn-ice/40 text-vn-ice no-underline hover:bg-vn-ice/10"
            >
              <Tag size={18} aria-hidden />
              Entrar no grupo Outlet
            </a>
          </div>

          <p className="mt-6 font-sans text-sm text-vn-ice/90">{WHATSAPP_LABEL}</p>
        </div>
      </div>
    </section>
  );
}
