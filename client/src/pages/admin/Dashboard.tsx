import { useState, useEffect } from "react";
import { Link } from "wouter";
import { DollarSign, ShoppingBag, Users, Clock, TrendingUp, ArrowRight } from "lucide-react";
import { adminFetch } from "@/context/AdminAuthContext";

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "#f59e0b",
  confirmed: "#10b981",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Aguardando pag.",
  confirmed: "Confirmado",
  processing: "Em preparo",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/dashboard").then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" /></div>;

  const cards = [
    { label: "Receita hoje", value: `R$ ${(stats?.todayRevenue || 0).toFixed(2).replace(".", ",")}`, sub: `${stats?.todayOrders || 0} pedido(s)`, icon: DollarSign, color: "#10b981" },
    { label: "Receita total", value: `R$ ${(stats?.totalRevenue || 0).toFixed(2).replace(".", ",")}`, sub: `${stats?.totalOrders || 0} pedido(s)`, icon: TrendingUp, color: "#3b82f6" },
    { label: "Pedidos pendentes", value: stats?.pendingOrders || 0, sub: "aguardando pagamento", icon: Clock, color: "#f59e0b" },
    { label: "Clientes", value: stats?.totalCustomers || 0, sub: "total cadastrado", icon: Users, color: "#8b5cf6" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Link href="/admin/produtos/novo">
          <a className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 no-underline flex items-center gap-2">
            + Novo produto
          </a>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{card.label}</p>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${card.color}20` }}>
                <card.icon size={18} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800">Pedidos recentes</h2>
          <Link href="/admin/pedidos">
            <a className="text-sm text-blue-600 hover:underline no-underline flex items-center gap-1">Ver todos <ArrowRight size={14} /></a>
          </Link>
        </div>
        {stats?.recentOrders?.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum pedido ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="px-5 py-3 text-left">Pedido</th>
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-left">Total</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentOrders?.map((order: any) => (
                  <tr key={order.id} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/pedidos/${order.id}`}>
                        <a className="font-mono text-sm font-semibold text-blue-600 no-underline hover:underline">#{order.orderNumber}</a>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{order.customerName}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-800">R$ {Number(order.total).toFixed(2).replace(".", ",")}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${STATUS_COLORS[order.status] || "#6b7280"}20`, color: STATUS_COLORS[order.status] || "#6b7280" }}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
