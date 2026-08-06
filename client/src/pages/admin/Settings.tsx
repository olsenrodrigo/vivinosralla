import { useState, useEffect } from "react";
import { Save, Store, Mail, CreditCard, Truck, Palette, Upload, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

const COLOR_PRESETS = [
  { name: "Oceano",        primary: "#5B8C9B", secondary: "#2C3E50" },
  { name: "Floresta",      primary: "#2D6A4F", secondary: "#1B4332" },
  { name: "Pôr do Sol",   primary: "#E07A5F", secondary: "#3D405B" },
  { name: "Lavanda",       primary: "#7C6FB0", secondary: "#3A3560" },
  { name: "Bege Elegante", primary: "#C8A96A", secondary: "#4A3728" },
  { name: "Rosé",          primary: "#C17B7B", secondary: "#6B2D2D" },
];

const TABS = [
  { id: "store",      label: "Loja",       icon: Store },
  { id: "appearance", label: "Aparência",  icon: Palette },
  { id: "email",      label: "E-mail",     icon: Mail },
  { id: "payment",    label: "Pagamento",  icon: CreditCard },
  { id: "analytics",  label: "Analytics",  icon: BarChart3 },
  { id: "shipping",   label: "Envio",      icon: Truck },
];

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("store");
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    adminFetch("/api/admin/settings").then(r => r.json()).then(setSettings).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const r = await adminFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
    setSaving(false);
    if (r.ok) toast({ title: "Configurações salvas!" });
    else toast({ title: "Erro ao salvar", variant: "destructive" });
  };

  const set = (key: string, value: any) => setSettings((s: any) => ({ ...s, [key]: value }));

  // Config de formas de pagamento (roteamento por método)
  const pc = settings.paymentConfig || {
    pix: { enabled: true, gateway: "mercadopago" },
    boleto: { enabled: true, gateway: "mercadopago" },
    credit_card: { enabled: true, gateway: "mercadopago", mode: "embedded" },
  };
  const setPay = (method: string, patch: any) =>
    set("paymentConfig", { ...pc, [method]: { ...(pc[method] || {}), ...patch } });

  // Config de analytics/pixels (só IDs públicos)
  const ac = settings.analyticsConfig || {};
  const setAc = (patch: any) => set("analyticsConfig", { ...ac, ...patch });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-900" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 text-sm mt-0.5">Configure sua loja virtual</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
          <Save size={16} /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
        {activeTab === "store" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-2">Informações da loja</h3>
            <div>
              <Label>Nome da loja</Label>
              <Input value={settings.storeName || ""} onChange={e => set("storeName", e.target.value)} placeholder="Minha Loja" className="mt-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={settings.storeDescription || ""} onChange={e => set("storeDescription", e.target.value)} placeholder="Descrição breve da loja" className="mt-1" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cor primária</Label>
                <div className="flex gap-2 mt-1">
                  <input type="color" value={settings.primaryColor || "#5B8C9B"} onChange={e => set("primaryColor", e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
                  <Input value={settings.primaryColor || "#5B8C9B"} onChange={e => set("primaryColor", e.target.value)} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Cor secundária</Label>
                <div className="flex gap-2 mt-1">
                  <input type="color" value={settings.secondaryColor || "#2C3E50"} onChange={e => set("secondaryColor", e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
                  <Input value={settings.secondaryColor || "#2C3E50"} onChange={e => set("secondaryColor", e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
            <div>
              <Label>E-mail de contato</Label>
              <Input type="email" value={settings.contactEmail || ""} onChange={e => set("contactEmail", e.target.value)} placeholder="loja@email.com" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input value={settings.contactPhone || ""} onChange={e => set("contactPhone", e.target.value)} placeholder="(11) 3333-4444" className="mt-1" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={settings.contactWhatsapp || ""} onChange={e => set("contactWhatsapp", e.target.value)} placeholder="(11) 99999-0000" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={settings.address || ""} onChange={e => set("address", e.target.value)} placeholder="Rua Exemplo, 123 — São Paulo/SP" className="mt-1" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={settings.cnpj || ""} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" className="mt-1" />
            </div>
            <div>
              <Label>Mensagem de recuperação de carrinho</Label>
              <Textarea
                value={settings.abandonedMessageTemplate || ""}
                onChange={e => set("abandonedMessageTemplate", e.target.value)}
                rows={4}
                className="mt-1 font-mono text-sm"
                placeholder={"Oi {nome}! 👋 Vi que você deixou itens no carrinho:\n\n{itens}\n\nPosso te ajudar a finalizar? {link}{cupom}"}
              />
              <p className="text-xs text-gray-400 mt-1">
                Placeholders: {"{nome}"} {"{itens}"} {"{link}"} {"{cupom}"}. Em branco usa o texto padrão.
              </p>
            </div>
            <div className="border-t pt-4 space-y-2">
              <span className="block text-sm font-semibold text-gray-800">Avaliações de produtos</span>
              <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={settings.reviewsEnabled !== false} onChange={e => set("reviewsEnabled", e.target.checked)} className="h-4 w-4" />
                Permitir que clientes avaliem produtos
              </label>
              <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={settings.reviewsRequireModeration !== false} onChange={e => set("reviewsRequireModeration", e.target.checked)} className="h-4 w-4" />
                Exigir moderação antes de publicar (recomendado)
              </label>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Paleta de cores</h3>
              <p className="text-sm text-gray-500 mb-4">Escolha um tema pronto ou personalize as cores abaixo.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COLOR_PRESETS.map(preset => {
                  const active =
                    settings.primaryColor === preset.primary &&
                    settings.secondaryColor === preset.secondary;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        set("primaryColor", preset.primary);
                        set("secondaryColor", preset.secondary);
                      }}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                        active ? "border-gray-900 shadow-md" : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <div
                        className="h-10 w-full"
                        style={{
                          background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.secondary} 50%)`,
                        }}
                      />
                      <div className="px-3 py-2 bg-white">
                        <p className="text-xs font-medium text-gray-800">{preset.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{preset.primary}</p>
                      </div>
                      {active && (
                        <span className="absolute top-1.5 right-1.5 bg-gray-900 rounded-full w-4 h-4 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-800 mb-4">Cores personalizadas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Cor primária</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={settings.primaryColor || "#5B8C9B"}
                      onChange={e => set("primaryColor", e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.primaryColor || "#5B8C9B"}
                      onChange={e => set("primaryColor", e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label>Cor secundária</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={settings.secondaryColor || "#2C3E50"}
                      onChange={e => set("secondaryColor", e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.secondaryColor || "#2C3E50"}
                      onChange={e => set("secondaryColor", e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label>Cor de destaque</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={settings.accentColor || "#F59E0B"}
                      onChange={e => set("accentColor", e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.accentColor || "#F59E0B"}
                      onChange={e => set("accentColor", e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="border-t pt-4">
              <Label className="mb-2 block">Pré-visualização</Label>
              <div
                className="h-14 rounded-xl shadow-inner"
                style={{
                  background: `linear-gradient(90deg, ${settings.primaryColor || "#5B8C9B"} 0%, ${settings.secondaryColor || "#2C3E50"} 70%, ${settings.accentColor || "#F59E0B"} 100%)`,
                }}
              />
              <div className="flex gap-3 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border border-gray-300" style={{ background: settings.primaryColor || "#5B8C9B" }} />
                  <span className="text-xs text-gray-500">Primária</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border border-gray-300" style={{ background: settings.secondaryColor || "#2C3E50" }} />
                  <span className="text-xs text-gray-500">Secundária</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border border-gray-300" style={{ background: settings.accentColor || "#F59E0B" }} />
                  <span className="text-xs text-gray-500">Destaque</span>
                </div>
              </div>
            </div>

            {/* Logo */}
            <div className="pt-4 border-t">
              <h4 className="font-medium text-gray-800 mb-3">Logo da Loja</h4>
              {settings.logoUrl && (
                <div className="mb-3">
                  <img src={settings.logoUrl} alt="Logo atual" className="h-16 object-contain border rounded-lg p-2 bg-gray-50" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer border rounded-lg px-4 py-2 hover:bg-gray-50 text-sm">
                  <Upload size={16} />
                  Enviar logo
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.append("logo", file);
                    const r = await adminFetch("/api/admin/settings/logo", { method: "POST", body: form });
                    if (r.ok) {
                      const d = await r.json();
                      set("logoUrl", d.logoUrl);
                      toast({ title: "Logo enviado com sucesso!" });
                    }
                  }} />
                </label>
                <span className="text-xs text-gray-400">PNG, JPG ou SVG — recomendado 200×60px</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-2">Configuração SMTP</h3>
            <p className="text-sm text-gray-500">Configure para envio de e-mails transacionais (confirmação de pedido, envio, etc.)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Servidor SMTP</Label>
                <Input value={settings.smtpHost || ""} onChange={e => set("smtpHost", e.target.value)} placeholder="smtp.gmail.com" className="mt-1" />
              </div>
              <div>
                <Label>Porta</Label>
                <Input type="number" value={settings.smtpPort || ""} onChange={e => set("smtpPort", Number(e.target.value))} placeholder="587" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Usuário SMTP</Label>
              <Input value={settings.smtpUser || ""} onChange={e => set("smtpUser", e.target.value)} placeholder="loja@gmail.com" className="mt-1" />
            </div>
            <div>
              <Label>Senha SMTP</Label>
              <Input type="password" value={settings.smtpPass || ""} onChange={e => set("smtpPass", e.target.value)} placeholder="••••••••" className="mt-1" />
            </div>
          </div>
        )}

        {activeTab === "payment" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Formas de pagamento</h3>
              <p className="text-sm text-gray-500 mb-4">Defina os métodos aceitos, qual gateway processa cada um e — no cartão — onde o cliente paga.</p>
              <div className="space-y-3">
                {[
                  { key: "pix", label: "PIX", card: false },
                  { key: "boleto", label: "Boleto", card: false },
                  { key: "credit_card", label: "Cartão de crédito", card: true },
                ].map((row) => {
                  const c = (pc as any)[row.key] || {};
                  return (
                    <div key={row.key} className="flex flex-wrap items-center gap-3 border rounded-lg p-3">
                      <label className="flex items-center gap-2 min-w-[160px] cursor-pointer">
                        <input type="checkbox" checked={!!c.enabled} onChange={(e) => setPay(row.key, { enabled: e.target.checked })} />
                        <span className="font-medium text-gray-800">{row.label}</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Gateway</span>
                        <select value={c.gateway || "mercadopago"} disabled={!c.enabled}
                          onChange={(e) => setPay(row.key, { gateway: e.target.value })}
                          className="border rounded-md px-2 py-1 text-sm disabled:opacity-50">
                          <option value="mercadopago">MercadoPago</option>
                          <option value="asaas">Asaas</option>
                        </select>
                      </div>
                      {row.card && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Onde paga</span>
                          <select value={c.mode || "embedded"} disabled={!c.enabled}
                            onChange={(e) => setPay(row.key, { mode: e.target.value })}
                            className="border rounded-md px-2 py-1 text-sm disabled:opacity-50">
                            <option value="embedded">Embutido no site</option>
                            <option value="redirect">Redirect (página do gateway)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Combinações suportadas hoje: <b>cartão via MercadoPago</b> = embutido; <b>cartão via Asaas</b> = redirect (checkout hospedado). PIX e boleto aparecem no site.
                Credenciais do <b>Asaas</b> vêm do <code>.env</code> (ASAAS_API_KEY); as do MercadoPago abaixo (ou no <code>.env</code>).
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">MercadoPago</h3>
              <p className="text-sm text-gray-500">Configure suas credenciais do MercadoPago para aceitar PIX, boleto e cartão.</p>
              <div>
                <Label>Access Token (SECRET)</Label>
              <Input type="password" value={settings.mercadoPagoToken || ""} onChange={e => set("mercadoPagoToken", e.target.value)} placeholder="APP_USR-..." className="mt-1" />
            </div>
            <div>
              <Label>Public Key</Label>
              <Input value={settings.mercadoPagoPublicKey || ""} onChange={e => set("mercadoPagoPublicKey", e.target.value)} placeholder="APP_USR-..." className="mt-1" />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input value={settings.pixKey || ""} onChange={e => set("pixKey", e.target.value)} placeholder="CPF, CNPJ, e-mail ou chave aleatória" className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
              <div>
                <Label>Máx. parcelas</Label>
                <Input type="number" value={settings.maxInstallments || 12} onChange={e => set("maxInstallments", Number(e.target.value))} min={1} max={24} className="mt-1" />
              </div>
              <div>
                <Label>Parcelas sem juros</Label>
                <Input type="number" value={settings.freeInstallments || 3} onChange={e => set("freeInstallments", Number(e.target.value))} min={1} className="mt-1" />
              </div>
              <div>
                <Label>Taxa mensal (%)</Label>
                <Input type="number" value={settings.monthlyInterestRate ? Number(settings.monthlyInterestRate) * 100 : 1.99}
                  onChange={e => set("monthlyInterestRate", (Number(e.target.value) / 100).toFixed(4))} step="0.01" className="mt-1" />
              </div>
            </div>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Analytics &amp; Pixels</h3>
              <p className="text-sm text-gray-500 mb-4">
                Medição do funil (view_item, add_to_cart, begin_checkout, purchase). Cole só os IDs públicos de pixel.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Google Analytics 4</Label>
                <Input value={ac.ga4MeasurementId || ""} onChange={e => setAc({ ga4MeasurementId: e.target.value })}
                  placeholder="G-XXXXXXXXXX" className="mt-1 font-mono" />
              </div>
              <div>
                <Label>Meta Pixel</Label>
                <Input value={ac.metaPixelId || ""} onChange={e => setAc({ metaPixelId: e.target.value })}
                  placeholder="123456789012345" className="mt-1 font-mono" />
              </div>
              <div>
                <Label>TikTok Pixel <span className="text-gray-400 font-normal">(opcional)</span></Label>
                <Input value={ac.tiktokPixelId || ""} onChange={e => setAc({ tiktokPixelId: e.target.value })}
                  placeholder="CXXXXXXXXXXXXXXXXX" className="mt-1 font-mono" />
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer pt-1">
              <input type="checkbox" checked={ac.requireConsent !== false}
                onChange={e => setAc({ requireConsent: e.target.checked })} className="mt-0.5 h-4 w-4" />
              <span className="text-sm text-gray-600">
                Exigir consentimento (LGPD) antes de carregar os pixels — recomendado. Sem isso, os pixels carregam para todos os visitantes.
              </span>
            </label>
          </div>
        )}

        {activeTab === "shipping" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-2">Configurações de envio</h3>
            <div>
              <Label>Frete grátis acima de (R$)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <Input type="number" value={settings.freeShippingAbove || ""} onChange={e => set("freeShippingAbove", e.target.value)} className="pl-9" placeholder="200,00" />
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-medium mb-1">Integrações de frete</p>
              <p>Para integração com Correios (PAC/SEDEX) e transportadoras via API, consulte a documentação ou entre em contato.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
