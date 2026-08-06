import { Link, useLocation } from "wouter";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Lock } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { precoBR, FRETE_GRATIS_ACIMA } from "@/lib/marca";

export default function CartPage() {
  const { cart, updateItem, clearCart, total, itemCount } = useCart();
  const [, navigate] = useLocation();

  const faltaParaFreteGratis = FRETE_GRATIS_ACIMA - total;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-vn py-24 text-center">
          <ShoppingBag size={56} className="mx-auto text-vn-olive-300" aria-hidden />
          <h1 className="mt-6 text-[2rem]">Sua sacola está vazia</h1>
          <p className="mt-3 font-sans text-vn-ink-soft">
            Escolha suas peças favoritas e volte aqui para finalizar.
          </p>
          <Link href="/loja" className="btn-olive mt-8 no-underline">
            Ver a coleção
          </Link>
        </main>
        <Footer />
        <WhatsAppFloat />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container-vn py-10 md:py-14">
        <Link
          href="/loja"
          className="inline-flex items-center gap-2 font-sans text-[0.95rem] text-vn-ink-soft no-underline hover:text-vn-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Continuar comprando
        </Link>

        <h1 className="mt-4 text-[2.25rem] md:text-[2.75rem]">
          Sua sacola
          <span className="ml-3 font-sans text-lg font-medium text-vn-ink-soft">
            {itemCount} {itemCount === 1 ? "peça" : "peças"}
          </span>
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <ul className="space-y-4">
            {cart.items.map(item => (
              <li key={item.id} className="flex gap-4 rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(52_55_46/0.05)]">
                <Link
                  href={`/loja/produto/${item.productSlug}`}
                  className="aspect-fashion w-24 shrink-0 overflow-hidden rounded-xl bg-vn-olive-50"
                >
                  {item.mainImage && (
                    <img
                      src={item.mainImage}
                      alt={item.productTitle}
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/loja/produto/${item.productSlug}`}
                    className="font-sans font-medium text-vn-ink no-underline hover:underline"
                  >
                    {item.productTitle}
                  </Link>
                  {item.variantTitle && (
                    <p className="mt-0.5 font-sans text-[0.9rem] text-vn-ink-soft">{item.variantTitle}</p>
                  )}
                  <p className="mt-1 font-sans text-[0.95rem] text-vn-ink-soft">
                    {precoBR(item.unitPrice)} cada
                  </p>
                  <p className="mt-1 font-sans text-base font-semibold text-vn-ink sm:hidden">
                    {precoBR(Number(item.unitPrice) * item.quantity)}
                  </p>

                  <div className="mt-auto flex items-center gap-3 pt-3">
                    <div className="flex items-center rounded-full border border-vn-olive-200">
                      <button
                        onClick={() => updateItem(item.id, item.quantity - 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-l-full text-vn-ink hover:bg-vn-olive-50"
                        aria-label={`Diminuir quantidade de ${item.productTitle}`}
                      >
                        <Minus size={14} aria-hidden />
                      </button>
                      <span className="w-8 text-center font-sans font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateItem(item.id, item.quantity + 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-r-full text-vn-ink hover:bg-vn-olive-50"
                        aria-label={`Aumentar quantidade de ${item.productTitle}`}
                      >
                        <Plus size={14} aria-hidden />
                      </button>
                    </div>
                    <button
                      onClick={() => updateItem(item.id, 0)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-vn-ink-soft hover:bg-vn-olive-50 hover:text-vn-wine"
                      aria-label={`Remover ${item.productTitle} da sacola`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </div>

                {/* No mobile o preço vai para baixo do nome: mantê-lo na mesma
                    linha do stepper somava ~422px de largura mínima e a página
                    passava a rolar lateralmente a 375px. */}
                <p className="hidden shrink-0 font-sans text-lg font-semibold text-vn-ink sm:block">
                  {precoBR(Number(item.unitPrice) * item.quantity)}
                </p>
              </li>
            ))}

            <li>
              <button
                onClick={() => clearCart()}
                className="inline-flex items-center gap-2 font-sans text-[0.95rem] text-vn-ink-soft hover:text-vn-wine"
              >
                <Trash2 size={15} aria-hidden />
                Esvaziar sacola
              </button>
            </li>
          </ul>

          <aside className="h-fit rounded-2xl bg-alt p-6 lg:sticky lg:top-28">
            <h2 className="font-sans text-lg font-semibold text-vn-ink">Resumo</h2>

            <dl className="mt-5 space-y-2.5 font-sans text-[0.95rem]">
              <div className="flex justify-between text-vn-ink-soft">
                <dt>
                  Subtotal ({itemCount} {itemCount === 1 ? "peça" : "peças"})
                </dt>
                <dd className="text-vn-ink">{precoBR(total)}</dd>
              </div>
              <div className="flex justify-between text-vn-ink-soft">
                <dt>Frete</dt>
                <dd>{total >= FRETE_GRATIS_ACIMA ? "Grátis" : "Calculado no checkout"}</dd>
              </div>
            </dl>

            {faltaParaFreteGratis > 0 && (
              <p className="mt-4 rounded-xl bg-white px-4 py-3 font-sans text-[0.9rem] text-vn-olive-700">
                Faltam <strong>{precoBR(faltaParaFreteGratis)}</strong> para o frete sair de graça.
              </p>
            )}

            <div className="mt-5 flex items-baseline justify-between border-t border-vn-olive-200 pt-5">
              <span className="font-sans font-semibold text-vn-ink">Total</span>
              <span className="font-sans text-2xl font-semibold text-vn-ink">{precoBR(total)}</span>
            </div>

            <Button onClick={() => navigate("/loja/checkout")} className="btn-olive mt-6 h-12 w-full text-base">
              Finalizar compra
            </Button>

            <p className="mt-4 flex items-center justify-center gap-1.5 font-sans text-sm text-vn-ink-soft">
              <Lock size={14} aria-hidden />
              Pagamento seguro
            </p>
          </aside>
        </div>
      </main>

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
