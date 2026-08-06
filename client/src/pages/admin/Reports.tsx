import { useState, useEffect } from "react";
import { TrendingUp, ShoppingBag, DollarSign, BarChart2 } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import { adminFetch } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";

const PRIMARY_COLOR = "#5B8C9B";

const PERIOD_OPTIONS = [
  { key: "today", label: "Hoje" },
  { key: "week",  label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year",  label: "Ano" },
] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Ag. pagamento", color: "#f59e0b" },
  confirmed:       { label: "Confirmado",    color: "#10b981" },
  processing:      { label: "Em preparo",    color: "#3b82f6" },
  shipped:         { label: "Enviado",       color: "#8b5cf6" },
  delivered:       { label: "Entregue",      color: "#10b981" },
  cancelled:       { label: "Cancelado",     color: "#ef4444" },
  refunded:        { label: "Reembolsado",   color: "#6b7280" },
};

const PAYMENT_LABELS: Record<string, string> = {
  pix:         "PIX",
  boleto:      "Boleto",
  credit_card: "Cartão de Crédito",
  debit_card:  "Cartão de Débito",
};

const PAYMENT_COLORS: Record<string, string> = {
  pix:         "#10b981",
  boleto:      "#f59e0b",
  credit_card: "#3b82f6",
  debit_card:  "#8b5cf6",
};

function formatBRL(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatXAxis(dateStr: string) {
  // dateStr is "YYYY-MM-DD"
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

interface ReportData {
  period: string;
  totalRevenue: number;
  ordersCount: number;
  avgTicket: number;
  dailyRevenue: { date: string; revenue: number }[];
  paymentBreakdown: Record<string, number>;
  recentOrders: {
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24 mb-4" />
      <div className="h-7 bg-gray-200 rounded w-32" />
    </div>
  );
}

export default function AdminReports() {
  const [period, setPeriod] = useState<string>("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminFetch(`/api/admin/reports?period=${p}`);
      if (!r.ok) throw new Error("Erro ao carregar relatórios");
      setData(await r.json());
    } catch (e: any) {
      setError(e.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); }, [period]);

  const paymentEntries = data
    ? Object.entries(data.paymentBreakdown).sort((a, b) => b[1] - a[1])
    : [];
  const totalPayments = paymentEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios Financeiros</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral de receita e pedidos</p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === opt.key
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Receita Total</span>
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}18` }}>
                  <DollarSign size={16} style={{ color: PRIMARY_COLOR }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatBRL(data?.totalRevenue ?? 0)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pedidos</span>
                <div className="p-2 rounded-lg bg-blue-50">
                  <ShoppingBag size={16} className="text-blue-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data?.ordersCount ?? 0}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ticket Médio</span>
                <div className="p-2 rounded-lg bg-green-50">
                  <TrendingUp size={16} className="text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatBRL(data?.avgTicket ?? 0)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Taxa de Conversão</span>
                <div className="p-2 rounded-lg bg-purple-50">
                  <BarChart2 size={16} className="text-purple-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">—</p>
            </div>
          </>
        )}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Receita nos últimos 30 dias</h2>
        {loading ? (
          <div className="h-56 animate-pulse bg-gray-100 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.dailyRevenue ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PRIMARY_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={PRIMARY_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [formatBRL(value), "Receita"]}
                labelFormatter={(label: string) => {
                  const [year, month, day] = label.split("-");
                  return `${day}/${month}/${year}`;
                }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={PRIMARY_COLOR}
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 4, fill: PRIMARY_COLOR }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row: Payment methods + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Formas de Pagamento</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-24 mb-1.5" />
                  <div className="h-2.5 bg-gray-100 rounded-full w-full" />
                </div>
              ))}
            </div>
          ) : paymentEntries.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sem dados para o período</p>
          ) : (
            <div className="space-y-4">
              {paymentEntries.map(([method, count]) => {
                const pct = totalPayments > 0 ? Math.round((count / totalPayments) * 100) : 0;
                const color = PAYMENT_COLORS[method] ?? "#6b7280";
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{PAYMENT_LABELS[method] ?? method}</span>
                      <span className="text-xs font-medium text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent orders table */}
        <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pedidos Recentes</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded flex-1" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : !data?.recentOrders.length ? (
            <p className="text-gray-400 text-sm text-center py-8">Sem pedidos no período selecionado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b">
                    <th className="pb-2 text-left font-medium">Pedido</th>
                    <th className="pb-2 text-left font-medium">Cliente</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                    <th className="pb-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.recentOrders.map(order => {
                    const sc = STATUS_CONFIG[order.status] ?? { label: order.status, color: "#6b7280" };
                    return (
                      <tr key={order.orderNumber} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-xs text-gray-600">
                          #{order.orderNumber}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-800 truncate max-w-[140px]">
                          {order.customerName}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium text-gray-900">
                          {formatBRL(Number(order.total))}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: `${sc.color}18`, color: sc.color }}
                          >
                            {sc.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
