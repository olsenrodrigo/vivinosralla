import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ChevronRight, Check, CreditCard, Smartphone, FileText } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trackBeginCheckout, useAnalyticsReady } from "@/lib/analytics";
import { precoBR } from "@/lib/marca";
import { descontoPix } from "@shared/pagamento";

type Step = 1 | 2 | 3 | 4;

interface Address {
  recipient: string; cep: string; logradouro: string; numero: string;
  complemento: string; bairro: string; cidade: string; estado: string;
}

const ESTADOS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>(1);
  const [, navigate] = useLocation();
  const { cart, sessionId, total, itemCount, initialized: cartInitialized } = useCart();
  const { toast } = useToast();
  const [storeInfo, setStoreInfo] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // Form state
  const [identity, setIdentity] = useState({ name: "", email: "", phone: "", cpf: "" });
  const [recoverConsent, setRecoverConsent] = useState(false);
  const [address, setAddress] = useState<Address>({ recipient: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "SP" });
  const [loadingCep, setLoadingCep] = useState(false);
  const [shipping, setShipping] = useState({ carrier: "Correios", service: "PAC", amount: 0 });
  const [shipOptions, setShipOptions] = useState<any[] | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "boleto" | "credit_card">("pix");
  const [payConfig, setPayConfig] = useState<Record<string, { enabled: boolean; gateway: string; mode?: string }> | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    fetch("/api/store/settings").then(r => r.json()).then(setStoreInfo).catch(() => {});
    fetch("/api/payment/config").then(r => r.json()).then(setPayConfig).catch(() => {});
  }, []);

  // Seleciona o primeiro método habilitado quando a config de pagamento carrega.
  useEffect(() => {
    if (!payConfig) return;
    if (!payConfig[paymentMethod]?.enabled) {
      const first = (["pix", "boleto", "credit_card"] as const).find((m) => payConfig[m]?.enabled);
      if (first) setPaymentMethod(first);
    }
  }, [payConfig]);

  // Só manda de volta ao carrinho depois que ele terminou de carregar — senão
  // acessar /loja/checkout direto pela URL sempre rebatia para /loja/carrinho,
  // porque no primeiro render o cart ainda é null.
  useEffect(() => {
    if (!cartInitialized) return;
    if (!cart || cart.items.length === 0) navigate("/loja/carrinho");
  }, [cart, cartInitialized]);

  // Captura de carrinho abandonado (só com consentimento). Debounce ~2,5s. Os
  // itens já estão no servidor (cart_sessions), então só enviamos o contato.
  useEffect(() => {
    if (!recoverConsent) return;
    const phone = identity.phone.replace(/\D/g, "");
    if (phone.length < 8 || !cart?.items?.length) return;
    const h = window.setTimeout(() => {
      fetch(`/api/cart/${sessionId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: identity.name || null,
          customerPhone: identity.phone,
          customerEmail: identity.email || null,
          couponCode: couponCode || null,
          consent: true,
        }),
      }).catch(() => {});
    }, 2500);
    return () => window.clearTimeout(h);
  }, [recoverConsent, identity.name, identity.phone, identity.email, couponCode, cart, sessionId]);

  // Analytics: begin_checkout (1x, quando há itens e o analytics está pronto)
  const analyticsOn = useAnalyticsReady();
  const [beganCheckout, setBeganCheckout] = useState(false);
  useEffect(() => {
    if (!beganCheckout && analyticsOn && cart?.items?.length) {
      setBeganCheckout(true);
      trackBeginCheckout(
        cart.items.map((i: any) => ({
          slug: String(i.productId),
          name: i.productTitle,
          price: Number(i.unitPrice),
          quantity: i.quantity,
        }))
      );
    }
  }, [analyticsOn, cart, beganCheckout]);

  const lookupCep = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setAddress(a => ({
          ...a, cep: cleaned,
          logradouro: d.logradouro, bairro: d.bairro,
          cidade: d.localidade, estado: d.uf,
        }));
      }
    } finally { setLoadingCep(false); }
  };

  const loadShipping = async () => {
    const cleaned = address.cep.replace(/\D/g, "");
    if (cleaned.length !== 8 || !cart?.items?.length) return;
    setShipLoading(true);
    setShipOptions(null);
    try {
      const r = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipTo: cleaned,
          subtotal: total,
          items: cart.items.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.options)) {
        setShipOptions(d.options);
        const o = d.options[0];
        if (o) setShipping({ carrier: o.base || "SmartEnvios", service: o.service, amount: o.free ? 0 : o.finalValue });
      } else {
        setShipOptions([]);
        toast({ title: "Não foi possível calcular o frete", description: d.error, variant: "destructive" });
      }
    } catch {
      setShipOptions([]);
    } finally {
      setShipLoading(false);
    }
  };

  const applyCoupon = async (codeArg?: string, silent = false) => {
    const code = (codeArg ?? couponCode).trim().toUpperCase();
    if (!code) return;
    if (code !== couponCode) setCouponCode(code);
    setCouponLoading(true);
    try {
      const r = await fetch("/api/store/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, orderValue: total }),
      });
      const d = await r.json();
      if (r.ok) {
        setCouponDiscount(d.discount);
        try { localStorage.removeItem("wl_coupon"); } catch { /* ignore */ }
        toast({ title: "Cupom aplicado!", description: `Desconto: ${precoBR(d.discount)}` });
      } else if (!silent) {
        toast({ title: "Cupom inválido", description: d.message, variant: "destructive" });
      }
    } finally { setCouponLoading(false); }
  };

  // Auto-aplica o cupom carregado por link (?cupom=), guardado no localStorage.
  const [autoCouponTried, setAutoCouponTried] = useState(false);
  useEffect(() => {
    if (autoCouponTried || total <= 0) return;
    setAutoCouponTried(true);
    let stored = "";
    try { stored = localStorage.getItem("wl_coupon") || ""; } catch { /* ignore */ }
    if (stored) applyCoupon(stored, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, autoCouponTried]);

  const buildPayload = (channel: "online" | "whatsapp") => ({
    customerName: identity.name, customerEmail: identity.email,
    customerPhone: identity.phone.replace(/\D/g, ""),
    customerCpf: identity.cpf.replace(/\D/g, ""),
    shippingRecipient: address.recipient || identity.name,
    shippingCep: address.cep, shippingLogradouro: address.logradouro,
    shippingNumero: address.numero, shippingComplemento: address.complemento,
    shippingBairro: address.bairro, shippingCidade: address.cidade, shippingEstado: address.estado,
    shippingCarrier: shipping.carrier, shippingService: shipping.service,
    shippingAmount: shipping.amount,
    paymentMethod, couponCode: couponCode || undefined,
    channel, sessionId,
  });

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("online")),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Erro ao finalizar pedido");
      // Checkout hospedado (ex.: cartão via Asaas): redireciona pro gateway.
      if (d.redirectUrl) { window.location.href = d.redirectUrl; return; }
      navigate(`/loja/pedido/${d.orderNumber}`);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleWhatsApp = async () => {
    const phone = String(storeInfo.contactWhatsapp || "").replace(/\D/g, "");
    if (!phone) { toast({ title: "WhatsApp não configurado pela loja", variant: "destructive" }); return; }
    const waWindow = window.open("", "_blank"); // abre no gesto (evita bloqueio de popup)
    setLoading(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("whatsapp")),
      });
      const d = await r.json();
      if (!r.ok) { waWindow?.close(); throw new Error(d.message || "Erro ao finalizar pedido"); }
      const waTotal = total - couponDiscount + shipping.amount;
      // Inclui tamanho/cor: sem isso a lojista recebe o pedido no WhatsApp sem
      // saber qual grade separar.
      const itemLines = (cart?.items || []).map((i: any) =>
        `• ${i.quantity}x ${i.productTitle}${i.variantTitle ? ` (${i.variantTitle})` : ""} — ${precoBR(Number(i.unitPrice) * i.quantity)}`
      ).join("\n");
      const msg = [
        `Olá! Quero finalizar meu pedido *${d.orderNumber}*:`, "", itemLines, "",
        `Subtotal: ${precoBR(total)}`,
        couponDiscount > 0 ? `Desconto (${couponCode}): -${precoBR(couponDiscount)}` : "",
        `Frete: ${precoBR(shipping.amount)}${shipping.service ? ` (${shipping.service})` : ""}`,
        `Total: ${precoBR(waTotal)}`, "",
        `Nome: ${identity.name}`,
        `Endereço: ${address.logradouro}, ${address.numero}${address.complemento ? ` — ${address.complemento}` : ""} — ${address.bairro}, ${address.cidade}/${address.estado} — CEP ${address.cep}`,
      ].filter(Boolean).join("\n");
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      if (waWindow) waWindow.location.href = url; else window.open(url, "_blank");
      navigate(`/loja/pedido/${d.orderNumber}`);
    } catch (e: any) {
      waWindow?.close();
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const orderTotal = total - couponDiscount + shipping.amount;
  // Mesma função do servidor (@shared/pagamento): o desconto incide sobre a
  // mercadoria, nunca sobre o frete — assim o exibido bate com o cobrado.
  const pixDesconto = descontoPix(total, couponDiscount);
  const pixTotal = orderTotal - pixDesconto;

  const steps = [
    { n: 1, label: "Identificação" },
    { n: 2, label: "Endereço" },
    { n: 3, label: "Envio" },
    { n: 4, label: "Pagamento" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="campos-retos container-vn max-w-5xl py-10 md:py-14">
        <h1 className="display-lg mb-8 text-center">Finalizar compra</h1>

        {/* Progress */}
        <div className="mb-10 flex items-center justify-center gap-1" aria-label={`Etapa ${step} de 4`}>
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= s.n ? "bg-vn-ink text-vn-ice" : "bg-vn-olive-50 text-vn-ink-soft"}`}>
                  {step > s.n ? <Check size={14} /> : s.n}
                </div>
                <span className={`mt-1 hidden text-xs sm:block ${step >= s.n ? "font-medium text-vn-ink" : "text-vn-ink-soft"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`mx-1 mb-4 h-0.5 w-8 transition-colors sm:mb-0 ${step > s.n ? "bg-vn-olive-600" : "bg-vn-olive-100"}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className=" border border-vn-olive-100 bg-card p-6 shadow-[0_1px_2px_rgb(52_55_46/0.05)] md:p-8">

              {/* Step 1: Identity */}
              {step === 1 && (
                <div>
                  <h2 className="mb-5 text-2xl text-vn-ink">Suas informações</h2>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="checkout-name">Nome completo *</Label>
                      <Input id="checkout-name" value={identity.name} onChange={e => setIdentity(i => ({...i, name: e.target.value}))} autoComplete="name" className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                    </div>
                    <div>
                      <Label htmlFor="checkout-email">E-mail *</Label>
                      <Input id="checkout-email" type="email" value={identity.email} onChange={e => setIdentity(i => ({...i, email: e.target.value}))} autoComplete="email" className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="checkout-phone">Telefone / WhatsApp *</Label>
                        <Input id="checkout-phone" value={identity.phone} onChange={e => setIdentity(i => ({...i, phone: e.target.value}))} autoComplete="tel" className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                      </div>
                      <div>
                        <Label htmlFor="checkout-cpf">CPF *</Label>
                        <Input id="checkout-cpf" value={identity.cpf} onChange={e => setIdentity(i => ({...i, cpf: e.target.value}))} className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                      </div>
                    </div>
                    <label htmlFor="recover-consent" className="flex cursor-pointer items-start gap-2.5 text-sm text-vn-ink-soft">
                      <input
                        id="recover-consent"
                        type="checkbox"
                        checked={recoverConsent}
                        onChange={e => {
                          const checked = e.target.checked;
                          setRecoverConsent(checked);
                          // Revogação LGPD: ao desmarcar, apaga o contato já capturado.
                          if (!checked) fetch(`/api/cart/${sessionId}/contact`, { method: "DELETE" }).catch(() => {});
                        }}
                        className="mt-0.5 h-5 w-5 accent-vn-olive-600"
                      />
                      <span>Aceito receber contato por WhatsApp sobre este pedido, caso eu não finalize agora.</span>
                    </label>
                    <Button
                      className="btn-ink w-full"
                      onClick={() => {
                        if (!identity.name || !identity.email || !identity.phone || !identity.cpf) {
                          toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
                        }
                        setStep(2);
                      }}
                    >
                      Continuar <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Address */}
              {step === 2 && (
                <div>
                  <h2 className="mb-5 text-2xl text-vn-ink">Endereço de entrega</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="checkout-cep">CEP *</Label>
                        <Input
                          id="checkout-cep"
                          value={address.cep}
                          onChange={e => { setAddress(a => ({...a, cep: e.target.value})); }}
                          onBlur={e => lookupCep(e.target.value)}
                          autoComplete="postal-code"
                          className="mt-1 min-h-11 border-vn-olive-200 bg-card"
                          maxLength={9}
                        />
                        {loadingCep && <p className="mt-1 text-sm text-vn-ink-soft" aria-live="polite">Buscando CEP...</p>}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="checkout-street">Logradouro *</Label>
                      <Input id="checkout-street" value={address.logradouro} onChange={e => setAddress(a => ({...a, logradouro: e.target.value}))} autoComplete="street-address" className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="checkout-number">Número *</Label>
                        <Input id="checkout-number" value={address.numero} onChange={e => setAddress(a => ({...a, numero: e.target.value}))} className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                      </div>
                      <div>
                        <Label htmlFor="checkout-complement">Complemento</Label>
                        <Input id="checkout-complement" value={address.complemento} onChange={e => setAddress(a => ({...a, complemento: e.target.value}))} className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="checkout-neighborhood">Bairro *</Label>
                      <Input id="checkout-neighborhood" value={address.bairro} onChange={e => setAddress(a => ({...a, bairro: e.target.value}))} className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="checkout-city">Cidade *</Label>
                        <Input id="checkout-city" value={address.cidade} onChange={e => setAddress(a => ({...a, cidade: e.target.value}))} autoComplete="address-level2" className="mt-1 min-h-11 border-vn-olive-200 bg-card" />
                      </div>
                      <div>
                        <Label htmlFor="checkout-state">Estado *</Label>
                        <select id="checkout-state" value={address.estado} onChange={e => setAddress(a => ({...a, estado: e.target.value}))}
                          className="mt-1 min-h-11 w-full  border border-vn-olive-200 bg-card px-3 text-vn-ink">
                          {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setStep(1)} className="btn-line flex-1">Voltar</Button>
                      <Button
                        className="btn-ink flex-1"
                        onClick={() => {
                          if (!address.cep || !address.logradouro || !address.numero) {
                            toast({ title: "Preencha o endereço completo", variant: "destructive" }); return;
                          }
                          setStep(3);
                          loadShipping();
                        }}
                      >
                        Continuar <ChevronRight size={16} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Shipping */}
              {step === 3 && (
                <div>
                  <h2 className="mb-5 text-2xl text-vn-ink">Forma de envio</h2>
                  <div className="space-y-3">
                    {shipLoading && (
                      <p className="text-sm text-vn-ink-soft" aria-live="polite">Calculando frete...</p>
                    )}
                    {shipOptions && shipOptions.length === 0 && !shipLoading && (
                      <p className="text-sm text-vn-wine" aria-live="polite">Nenhuma opção de frete para este CEP.</p>
                    )}
                    {(shipOptions || []).map(opt => {
                      const selected = shipping.service === opt.service;
                      const price = opt.free ? 0 : opt.finalValue;
                      return (
                        <label key={opt.id + opt.service} className={`flex min-h-14 cursor-pointer items-center gap-3  border p-3 transition-colors ${selected ? "border-2 border-vn-olive-600 bg-vn-olive-50" : "border-vn-olive-200 hover:border-vn-olive-300"}`}>
                          <input type="radio" name="shipping"
                            checked={selected}
                            onChange={() => setShipping({ carrier: opt.base || "SmartEnvios", service: opt.service, amount: price })}
                            className="h-5 w-5 accent-vn-olive-600"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-vn-ink">{opt.service}</p>
                            <p className="text-sm text-vn-ink-soft">{opt.days} dias úteis</p>
                          </div>
                          <span className="font-semibold text-vn-ink">
                            {opt.free ? "Grátis" : precoBR(price)}
                          </span>
                        </label>
                      );
                    })}
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setStep(2)} className="btn-line flex-1">Voltar</Button>
                      <Button className="btn-ink flex-1" onClick={() => setStep(4)}>
                        Continuar <ChevronRight size={16} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Payment */}
              {step === 4 && (
                <div>
                  <h2 className="mb-5 text-2xl text-vn-ink">Forma de pagamento</h2>
                  <div className="space-y-3 mb-4">
                    {[
                      { method: "pix" as const, icon: <Smartphone size={18} />, label: "PIX", desc: `${precoBR(pixTotal)} — 5% de desconto`, badge: "Aprovação instantânea" },
                      { method: "boleto" as const, icon: <FileText size={18} />, label: "Boleto Bancário", desc: `${precoBR(orderTotal)} — vence em 3 dias`, badge: null },
                      { method: "credit_card" as const, icon: <CreditCard size={18} />, label: "Cartão de Crédito", desc: `Até 12x`, badge: null },
                    ].filter(opt => !payConfig || payConfig[opt.method]?.enabled).map(opt => (
                      <label key={opt.method} className={`flex min-h-14 cursor-pointer items-center gap-3  border p-3 transition-colors ${paymentMethod === opt.method ? "border-2 border-vn-olive-600 bg-vn-olive-50" : "border-vn-olive-200 hover:border-vn-olive-300"}`}>
                        <input type="radio" name="payment" value={opt.method} checked={paymentMethod === opt.method}
                          onChange={() => setPaymentMethod(opt.method)} className="h-5 w-5 accent-vn-olive-600" />
                        <span className="text-vn-olive-600">{opt.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-vn-ink">{opt.label}</p>
                            {opt.badge && <span className="bg-vn-olive-100 px-2 py-0.5 text-xs text-vn-olive-700">{opt.badge}</span>}
                          </div>
                          <p className="text-sm text-vn-ink-soft">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Coupon */}
                  <div className="mb-4  bg-alt p-4">
                    <Label htmlFor="coupon-code" className="mb-2 block text-sm font-medium text-vn-ink">Cupom de desconto</Label>
                    <div className="flex gap-2">
                      <Input id="coupon-code" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="min-h-11 flex-1 border-vn-olive-200 bg-card" />
                      <Button type="button" variant="outline" className="btn-line" onClick={() => applyCoupon()} disabled={couponLoading}>Aplicar</Button>
                    </div>
                    {couponDiscount > 0 && <p className="mt-2 text-sm text-vn-olive-700" aria-live="polite">✓ Desconto de {precoBR(couponDiscount)} aplicado!</p>}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(3)} className="btn-line flex-1">Voltar</Button>
                    <Button
                      className="btn-ink flex-1"
                      onClick={handlePlaceOrder}
                      disabled={loading}
                    >
                      {loading ? "Processando..." : `Finalizar — ${precoBR(paymentMethod === "pix" ? pixTotal : orderTotal)}`}
                    </Button>
                  </div>

                  {storeInfo.contactWhatsapp && (
                    <>
                      <div className="my-3 flex items-center gap-3 text-xs text-vn-ink-soft">
                        <span className="h-px flex-1 bg-vn-olive-200" /> ou <span className="h-px flex-1 bg-vn-olive-200" />
                      </div>
                      <Button
                        type="button"
                        onClick={handleWhatsApp}
                        disabled={loading}
                        className="btn-line w-full"
                      >
                        Finalizar pelo WhatsApp
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Order summary */}
          <aside className="sticky top-[calc(var(--vn-header)+1.5rem)] h-fit  bg-alt p-5">
            <h3 className="mb-4 font-sans text-lg font-semibold text-vn-ink">Resumo</h3>
            <div className="space-y-2 text-sm">
              {cart?.items.map(item => (
                <div key={item.id} className="flex gap-2">
                  <div className="aspect-fashion w-12 flex-shrink-0 overflow-hidden  bg-vn-olive-50">
                    {item.mainImage && <img src={item.mainImage} alt={item.productTitle} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="line-clamp-1 text-vn-ink">{item.productTitle}</p>
                    {item.variantTitle && <p className="text-vn-ink-soft">{item.variantTitle}</p>}
                    <p className="text-vn-ink-soft">× {item.quantity}</p>
                  </div>
                  <p className="text-xs font-medium text-vn-ink">{precoBR(Number(item.unitPrice) * item.quantity)}</p>
                </div>
              ))}
              <div className="space-y-1 border-t border-vn-olive-200 pt-2">
                <div className="flex justify-between text-vn-ink-soft"><span>Subtotal</span><span>{precoBR(total)}</span></div>
                {couponDiscount > 0 && <div className="flex justify-between text-vn-olive-700"><span>Desconto</span><span>- {precoBR(couponDiscount)}</span></div>}
                <div className="flex justify-between text-vn-ink-soft"><span>Frete</span><span>{shipping.amount > 0 ? precoBR(shipping.amount) : "-"}</span></div>
                {paymentMethod === "pix" && <div className="flex justify-between text-xs text-vn-olive-700"><span>Desconto PIX (5%)</span><span>- {precoBR(pixDesconto)}</span></div>}
              </div>
              <div className="flex justify-between border-t border-vn-olive-200 pt-2 text-base font-bold text-vn-ink">
                <span>Total</span>
                <span>{precoBR(paymentMethod === "pix" ? pixTotal : orderTotal)}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
