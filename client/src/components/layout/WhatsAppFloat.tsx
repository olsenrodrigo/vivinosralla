import { MessageCircle } from "lucide-react";
import { whatsappCom } from "@/lib/marca";

/** Botão flutuante de WhatsApp — canal principal de atendimento da loja. */
export default function WhatsAppFloat() {
  return (
    <a
      href={whatsappCom("Oi! Vim pelo site da Vivi Nosralla e queria tirar uma dúvida.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a loja no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-vn-olive-600 text-white shadow-[0_8px_24px_rgb(52_55_46/0.28)] transition-transform hover:scale-105 hover:bg-vn-olive-700"
    >
      <MessageCircle size={26} aria-hidden />
    </a>
  );
}
