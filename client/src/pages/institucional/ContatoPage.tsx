import { useState, type FormEvent } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { CIDADE, EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL, WHATSAPP_LABEL, WHATSAPP_URL } from "@/lib/marca";

type Status = "idle" | "sending" | "success" | "error";

export default function ContatoPage() {
  const [status, setStatus] = useState<Status>("idle");

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      message: String(form.get("message") ?? ""),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Falha no envio");
      formElement.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-vn-olive-200 bg-white px-4 py-3 text-vn-ink";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="section-padding">
          <div className="container-vn">
            <p className="eyebrow">Fale com a gente</p>
            <h1 className="mt-4 text-[2.75rem] text-balance md:text-[4rem]">Estamos por perto</h1>
            <p className="mt-6 max-w-2xl text-[1.125rem] text-vn-ink-soft">
              Para escolher uma peça, conferir medidas ou acompanhar um pedido, conte com um atendimento próximo e acolhedor.
            </p>

            <div className="mt-12 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <section aria-labelledby="canais-titulo">
                <h2 id="canais-titulo" className="text-[2rem]">Nossos canais</h2>
                <ul className="mt-6 space-y-4 text-[1.0625rem] text-vn-ink-soft">
                  <li><strong className="block text-vn-ink">WhatsApp de vendas</strong><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-vn-olive-700 underline">{WHATSAPP_LABEL}</a></li>
                  <li><strong className="block text-vn-ink">Instagram</strong><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-vn-olive-700 underline">{INSTAGRAM_HANDLE}</a></li>
                  <li><strong className="block text-vn-ink">E-mail</strong><a href={`mailto:${EMAIL}`} className="inline-flex min-h-11 items-center break-all text-vn-olive-700 underline">{EMAIL}</a></li>
                  <li><strong className="block text-vn-ink">Onde estamos</strong><span className="inline-flex min-h-11 items-center">{CIDADE}</span></li>
                </ul>
              </section>

              <section className="rounded-2xl bg-alt p-6 md:p-10" aria-labelledby="mensagem-titulo">
                <h2 id="mensagem-titulo" className="text-[2rem]">Envie uma mensagem</h2>
                <form onSubmit={enviar} className="mt-7 space-y-5">
                  <div><label htmlFor="contact-name" className="font-semibold text-vn-ink">Nome</label><input id="contact-name" name="name" required autoComplete="name" className={inputClass} /></div>
                  <div><label htmlFor="contact-phone" className="font-semibold text-vn-ink">Telefone ou WhatsApp</label><input id="contact-phone" name="phone" required type="tel" autoComplete="tel" className={inputClass} /></div>
                  <div><label htmlFor="contact-email" className="font-semibold text-vn-ink">E-mail</label><input id="contact-email" name="email" required type="email" autoComplete="email" className={inputClass} /></div>
                  <div><label htmlFor="contact-message" className="font-semibold text-vn-ink">Como podemos ajudar?</label><textarea id="contact-message" name="message" required rows={5} className={inputClass} /></div>
                  <button type="submit" disabled={status === "sending"} className="btn-olive disabled:cursor-not-allowed disabled:opacity-60">
                    {status === "sending" ? "Enviando…" : "Enviar mensagem"}
                  </button>
                  <p aria-live="polite" className={`min-h-6 text-[1rem] ${status === "error" ? "text-destructive" : "text-vn-olive-700"}`}>
                    {status === "success" && "Mensagem enviada. Em breve, nossa equipe falará com você."}
                    {status === "error" && "Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp."}
                  </p>
                </form>
              </section>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
