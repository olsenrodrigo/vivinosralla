import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "pending_payment", label: "Aguardando pagamento" },
  { value: "confirmed", label: "Confirmado" },
  { value: "processing", label: "Em preparo" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
  { value: "refunded", label: "Reembolsado" },
];

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "#f59e0b", confirmed: "#10b981", processing: "#3b82f6",
  shipped: "#8b5cf6", delivered: "#10b981", cancelled: "#ef4444", refunded: "#6b7280",
};

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [tracking, setTracking] = useState({ carrier: "", service: "", trackingCode: "" });
  const [labelLoading, setLabelLoading] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const r = await adminFetch(`/api/admin/orders/${id}`);
    const d = await r.json();
    setOrder(d);
    setNewStatus(d.status);
    setTracking({ carrier: d.shippingCarrier || "", service: d.shippingService || "", trackingCode: d.trackingCode || "" });
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async () => {
    const r = await adminFetch(`/api/admin/orders/${id}/status`, {
      method: "PUT", body: JSON.stringify({ status: newStatus, note: statusNote }),
    });
    if (r.ok) { toast({ title: "Status atualizado!" }); load(); setStatusNote(""); }
  };

  const updateTracking = async () => {
    const r = await adminFetch(`/api/admin/orders/${id}/tracking`, {
      method: "PUT", body: JSON.stringify(tracking),
    });
    if (r.ok) { toast({ title: "Rastreio salvo! E-mail enviado ao cliente." }); load(); }
  };

  const generateLabel = async () => {
    setLabelLoading(true);
    try {
      const r = await adminFetch(`/api/admin/orders/${id}/label`, {
        method: "POST", body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok && d.label?.url) {
        setLabelUrl(d.label.url);
        toast({ title: "Etiqueta gerada!" });
        load();
      } else {
        toast({ title: "Falha ao gerar etiqueta", description: d.error, variant: "destructive" });
      }
    } finally {
      setLabelLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-900" /></div>;
  if (!order) return <div className="text-center py-20 text-gray-500">Pedido não encontrado</div>;

  const statusColor = STATUS_COLORS[order.status] || "#6b7280";
  const statusLabel = STATUS_OPTIONS.find(o => o.value === order.status)?.label || order.status;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/pedidos"><a className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg no-underline"><ArrowLeft size={18} /></a></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedido #{order.orderNumber}</h1>
          <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString("pt-BR")}</p>
        </div>
        <span className="ml-auto text-sm px-3 py-1 rounded-full font-medium" style={{ background: `${statusColor}20`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          {/* Items */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Itens</h3>
            <div className="space-y-3">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-50" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{item.productTitle}</p>
                    {item.variantTitle && <p className="text-xs text-gray-400">{item.variantTitle}</p>}
                    {item.sku && <p className="text-xs text-gray-400 font-mono">SKU: {item.sku}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">× {item.quantity}</p>
                    <p className="text-sm font-semibold text-gray-800">R$ {Number(item.totalPrice).toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>R$ {Number(order.subtotal).toFixed(2).replace(".", ",")}</span></div>
              {Number(order.discountAmount) > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>- R$ {Number(order.discountAmount).toFixed(2).replace(".", ",")}</span></div>}
              <div className="flex justify-between text-gray-500"><span>Frete</span><span>{Number(order.shippingAmount) > 0 ? `R$ ${Number(order.shippingAmount).toFixed(2).replace(".", ",")}` : "Grátis"}</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>R$ {Number(order.total).toFixed(2).replace(".", ",")}</span></div>
            </div>
          </div>

          {/* Status update */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Atualizar status</h3>
            <div className="flex gap-3 mb-3">
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button onClick={updateStatus} className="bg-gray-900 text-white hover:bg-gray-800">Atualizar</Button>
            </div>
            <Input value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Observação (opcional)" />
          </div>

          {/* Tracking */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Truck size={16} /> Rastreio de envio</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label>Transportadora</Label>
                <Input value={tracking.carrier} onChange={e => setTracking(t => ({...t, carrier: e.target.value}))} placeholder="Correios" className="mt-1" />
              </div>
              <div>
                <Label>Serviço</Label>
                <Input value={tracking.service} onChange={e => setTracking(t => ({...t, service: e.target.value}))} placeholder="PAC" className="mt-1" />
              </div>
            </div>
            <div className="mb-3">
              <Label>Código de rastreio</Label>
              <Input value={tracking.trackingCode} onChange={e => setTracking(t => ({...t, trackingCode: e.target.value}))} placeholder="AA123456789BR" className="mt-1 font-mono" />
            </div>
            <Button onClick={updateTracking} variant="outline" className="gap-2"><Truck size={14} /> Salvar rastreio e notificar cliente</Button>

            <div className="mt-4 border-t pt-4">
              <Button onClick={generateLabel} disabled={labelLoading} className="gap-2">
                <Truck size={14} /> {labelLoading ? "Gerando etiqueta..." : "Gerar etiqueta SmartEnvios"}
              </Button>
              {labelUrl && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a href={labelUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    <Truck size={14} /> Imprimir etiqueta
                  </a>
                  <a href={labelUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Baixar PDF
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Histórico</h3>
            {order.history?.length === 0 ? <p className="text-sm text-gray-400">Sem histórico</p> : (
              <div className="space-y-3">
                {order.history?.map((h: any) => (
                  <div key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100"><CheckCircle size={12} className="text-gray-400" /></div>
                      <div className="w-0.5 h-full bg-gray-100 mt-1" />
                    </div>
                    <div className="pb-3">
                      <p className="text-sm font-medium text-gray-800">
                        {h.fromStatus ? `${STATUS_OPTIONS.find(o => o.value === h.fromStatus)?.label} → ` : ""}
                        {STATUS_OPTIONS.find(o => o.value === h.toStatus)?.label || h.toStatus}
                      </p>
                      {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(h.createdAt).toLocaleString("pt-BR")} · {h.createdBy}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Cliente</h3>
            <p className="text-sm font-medium text-gray-800">{order.customerName}</p>
            <p className="text-sm text-gray-500">{order.customerEmail}</p>
            {order.customerPhone && <p className="text-sm text-gray-500">{order.customerPhone}</p>}
            {order.customerCpf && <p className="text-xs text-gray-400 font-mono">CPF: {order.customerCpf}</p>}
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Package size={16} /> Endereço</h3>
            <p className="text-sm text-gray-600">
              {order.shippingLogradouro}, {order.shippingNumero}
              {order.shippingComplemento && `, ${order.shippingComplemento}`}<br />
              {order.shippingBairro}<br />
              {order.shippingCidade}/{order.shippingEstado} — {order.shippingCep}
            </p>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Pagamento</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Método</span><span>{order.paymentMethod || "—"}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={order.paymentStatus === "approved" ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                  {order.paymentStatus === "approved" ? "Aprovado" : order.paymentStatus === "pending" ? "Pendente" : order.paymentStatus}
                </span>
              </div>
              {order.paymentTransactionId && <div className="flex justify-between"><span className="text-gray-500">ID transação</span><span className="font-mono text-xs">{order.paymentTransactionId}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
