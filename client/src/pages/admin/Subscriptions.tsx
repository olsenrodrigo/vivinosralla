import { useState, useEffect } from "react";
import { Check, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

const CYCLE_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Ativa", cls: "bg-green-50 text-green-700" },
  INACTIVE: { label: "Pausada", cls: "bg-amber-50 text-amber-700" },
  CANCELLED: { label: "Cancelada", cls: "bg-gray-100 text-gray-500" },
};

export default function AdminSubscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await adminFetch("/api/admin/subscriptions");
    setSubs(r.ok ? await r.json() : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const cancel = async (id: number) => {
    setConfirmingId(null);
    const r = await adminFetch(`/api/admin/subscriptions/${id}/cancel`, { method: "POST" });
    if (r.ok) { toast({ title: "Assinatura cancelada" }); load(); }
    else {
      const d = await r.json().catch(() => ({}));
      toast({ title: d.message || "Falha ao cancelar", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assinaturas</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {subs.length} assinatura(s) — reposição recorrente ("assine e receba").
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" /></div>
        ) : subs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Repeat size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhuma assinatura ainda</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Ciclo</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Próxima</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s: any) => {
                const st = STATUS_LABELS[s.status] ?? STATUS_LABELS.ACTIVE;
                return (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.customerName}</p>
                      <p className="text-xs text-gray-400">{s.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{CYCLE_LABELS[s.cycle] ?? s.cycle}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">R$ {Number(s.value).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400 hidden sm:table-cell">
                      {s.nextDueDate ? new Date(s.nextDueDate + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === "CANCELLED" ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : confirmingId === s.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-red-600">Cancelar?</span>
                          <button onClick={() => cancel(s.id)} className="p-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" aria-label="Confirmar"><Check size={14} /></button>
                          <button onClick={() => setConfirmingId(null)} className="p-1.5 rounded-md border text-gray-500 hover:bg-gray-50" aria-label="Cancelar"><X size={14} /></button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setConfirmingId(s.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                          Cancelar
                        </Button>
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
