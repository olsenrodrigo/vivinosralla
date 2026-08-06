import { useEffect, useState } from "react";
import { Check, MessageSquare, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: number; productId: number; rating: number; authorName: string;
  title: string | null; comment: string | null; status: string;
  verifiedPurchase: boolean; adminReply: string | null; createdAt: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "Aprovada", cls: "bg-green-50 text-green-700" },
  rejected: { label: "Rejeitada", cls: "bg-red-50 text-red-600" },
};

export default function AdminReviews() {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    const qs = status ? `?status=${status}` : "";
    adminFetch(`/api/admin/reviews${qs}`).then((r) => (r.ok ? r.json() : [])).then(setRows).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]);

  const moderate = async (id: number, newStatus: string, adminReply?: string) => {
    const res = await adminFetch(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus, adminReply }) });
    if (res.ok) { setReplyFor(null); setReplyText(""); load(); }
    else toast({ title: "Falha ao moderar", variant: "destructive" });
  };
  const remove = async (id: number) => {
    setConfirmDel(null);
    const res = await adminFetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avaliações</h1>
          <p className="text-gray-500 text-sm mt-0.5">Modere as avaliações dos clientes.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovadas</option>
          <option value="rejected">Rejeitadas</option>
          <option value="">Todas</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center py-16 text-gray-400">Nenhuma avaliação neste filtro.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const st = STATUS[r.status] ?? STATUS.pending;
            return (
              <div key={r.id} className="rounded-xl bg-white shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={15} className={i + 1 <= r.rating ? "text-amber-400" : "text-gray-300"} fill={i + 1 <= r.rating ? "currentColor" : "none"} />
                      ))}
                    </span>
                    <span className="font-semibold text-gray-800">{r.authorName}</span>
                    {r.verifiedPurchase && <span className="text-xs font-medium text-green-600">✓ compra verificada</span>}
                    <span className="text-xs text-gray-400">· produto #{r.productId}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                </div>
                {r.title && <p className="mt-2 font-semibold text-gray-800">{r.title}</p>}
                {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
                {r.adminReply && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-600"><b>Resposta:</b> {r.adminReply}</p>}

                {replyFor === r.id ? (
                  <div className="mt-3 flex gap-2">
                    <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Resposta da loja (opcional)" className="flex-1" />
                    <Button onClick={() => moderate(r.id, "approved", replyText || undefined)} className="bg-gray-900 text-white">Aprovar</Button>
                    <Button variant="outline" onClick={() => { setReplyFor(null); setReplyText(""); }}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.status !== "approved" && <button onClick={() => moderate(r.id, "approved")} className="flex items-center gap-1.5 rounded-md bg-green-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-green-700"><Check size={13} /> Aprovar</button>}
                    {r.status !== "rejected" && <button onClick={() => moderate(r.id, "rejected")} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"><X size={13} /> Rejeitar</button>}
                    <button onClick={() => { setReplyFor(r.id); setReplyText(r.adminReply || ""); }} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"><MessageSquare size={13} /> Responder</button>
                    {confirmDel === r.id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-red-600">Excluir?</span>
                        <button onClick={() => remove(r.id)} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-semibold">Sim</button>
                        <button onClick={() => setConfirmDel(null)} className="rounded-md border px-3 py-1.5 text-xs">Não</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDel(r.id)} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={13} /> Excluir</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
