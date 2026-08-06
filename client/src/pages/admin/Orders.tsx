import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminFetch } from "@/context/AdminAuthContext";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Ag. pagamento", color: "#f59e0b" },
  confirmed: { label: "Confirmado", color: "#10b981" },
  processing: { label: "Em preparo", color: "#3b82f6" },
  shipped: { label: "Enviado", color: "#8b5cf6" },
  delivered: { label: "Entregue", color: "#10b981" },
  cancelled: { label: "Cancelado", color: "#ef4444" },
  refunded: { label: "Reembolsado", color: "#6b7280" },
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX", boleto: "Boleto", credit_card: "Cartão", debit_card: "Débito"
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const r = await adminFetch(`/api/admin/orders?${params}`);
    const d = await r.json();
    setOrders(d.orders || []);
    setTotal(d.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, search, statusFilter]);

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} pedido(s)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nº do pedido, cliente..." className="pl-9" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-2 text-sm focus:outline-none">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingBag size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum pedido encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50">
                    <th className="px-4 py-3 text-left">Pedido</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">Pagamento</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Data</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const status = STATUS_CONFIG[order.status] || { label: order.status, color: "#6b7280" };
                    return (
                      <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-sm font-semibold text-gray-800">#{order.orderNumber}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-800">{order.customerName}</p>
                          <p className="text-xs text-gray-400">{order.customerEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                          R$ {Number(order.total).toFixed(2).replace(".", ",")}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500 hidden md:table-cell">
                          {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${status.color}20`, color: status.color }}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400 hidden sm:table-cell">
                          {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/pedidos/${order.id}`}>
                            <a className="text-sm text-blue-600 hover:underline no-underline">Ver</a>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
                <span>Página {page} de {pages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
