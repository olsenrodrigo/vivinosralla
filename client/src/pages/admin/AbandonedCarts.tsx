import { useState, useEffect } from "react";
import { MessageCircle, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "bg-amber-50 text-amber-700" },
  contacted: { label: "Contatado", cls: "bg-green-50 text-green-700" },
  converted: { label: "Convertido", cls: "bg-gray-900 text-white" },
};

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export default function AdminAbandonedCarts() {
  const [rows, setRows] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<{ code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [minAgeHours, setMinAgeHours] = useState("1");
  const [selCoupon, setSelCoupon] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (minAgeHours) qs.set("minAgeHours", minAgeHours);
    qs.set("maxAgeDays", "30");
    adminFetch(`/api/admin/carts/abandoned?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    adminFetch("/api/admin/coupons")
      .then((r) => (r.ok ? r.json() : []))
      .then((cs: any[]) => setCoupons(cs.filter((c) => c.active).map((c) => ({ code: c.code }))))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [status, minAgeHours]);

  const sendWhatsApp = async (row: any) => {
    const coupon = selCoupon[row.id] || null;
    const res = await adminFetch(`/api/admin/carts/${row.id}/send-whatsapp`, {
      method: "POST",
      body: JSON.stringify({ couponCode: coupon }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.waLink) window.open(d.waLink, "_blank");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: d.message || "Falha ao gerar mensagem", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carrinhos abandonados</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Clientes que iniciaram o checkout e consentiram receber contato.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw size={14} /> Atualizar</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          <option value="open">Abertos</option>
          <option value="contacted">Contatados</option>
          <option value="converted">Convertidos</option>
        </select>
        <select value={minAgeHours} onChange={(e) => setMinAgeHours(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="0">Qualquer idade</option>
          <option value="1">Abandonados há 1h+</option>
          <option value="6">6h+</option>
          <option value="24">1 dia+</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum carrinho abandonado no filtro</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Itens</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Abandonado</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Recuperar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const st = STATUS[r.recoveryStatus] ?? STATUS.open;
                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{r.customerName || "—"}</p>
                      <p className="text-xs text-gray-400">{r.customerPhone || "sem telefone"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                      {r.itemCount} item(s)
                      <span className="block text-xs opacity-70">{(r.items || []).map((i: any) => i.productTitle).join(", ").slice(0, 40)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">R$ {Number(r.subtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400 hidden sm:table-cell">
                      {ageLabel(r.updatedAt)}
                      {r.contactCount > 0 && <span className="block">{r.contactCount} contato(s)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.recoveryStatus !== "converted" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <select
                            value={selCoupon[r.id] || ""}
                            onChange={(e) => setSelCoupon((s) => ({ ...s, [r.id]: e.target.value }))}
                            className="border rounded-md px-2 py-1.5 text-xs"
                          >
                            <option value="">Sem cupom</option>
                            {coupons.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                          </select>
                          <button onClick={() => sendWhatsApp(r)} className="flex items-center gap-1.5 rounded-md bg-green-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-green-700">
                            <MessageCircle size={13} /> WhatsApp
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Pedido feito ✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
