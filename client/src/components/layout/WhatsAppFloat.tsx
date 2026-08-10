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
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center bg-vn-ink text-vn-ice transition-colors hover:bg-vn-olive-700"
    >
      <MessageCircle size={22} aria-hidden />
    </a>
  );
}
