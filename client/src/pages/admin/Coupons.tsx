import { useState, useEffect } from "react";
import { Check, Link2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = {
  code: "", type: "percentage", value: "", minOrderValue: "", maxUses: "", perCustomerLimit: "1",
  startsAt: "", expiresAt: "", active: true,
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await adminFetch("/api/admin/coupons");
    setCoupons(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(true); };
  const openEdit = (c: any) => {
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrderValue: c.minOrderValue != null ? String(c.minOrderValue) : "",
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      perCustomerLimit: String(c.perCustomerLimit ?? 1),
      startsAt: c.startsAt ? String(c.startsAt).slice(0, 16) : "",
      expiresAt: c.expiresAt ? String(c.expiresAt).slice(0, 16) : "",
      active: c.active,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.value) { toast({ title: "Código e valor são obrigatórios", variant: "destructive" }); return; }
    const payload = {
      ...form, value: String(form.value),
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      minOrderValue: form.minOrderValue || null,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
    };
    const r = await adminFetch(editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      toast({ title: editingId ? "Cupom atualizado!" : "Cupom criado!" });
      setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); load();
    } else {
      const d = await r.json().catch(() => ({}));
      toast({ title: d.message || "Falha ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmingId(null);
    const r = await adminFetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Cupom excluído" }); load(); }
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/loja?cupom=${encodeURIComponent(code)}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const TYPE_LABELS: Record<string, string> = { percentage: "% desconto", fixed: "R$ desconto", free_shipping: "Frete grátis" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupons de Desconto</h1>
          <p className="text-gray-500 text-sm mt-0.5">{coupons.length} cupom(ns)</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
          <Plus size={16} /> Novo cupom
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h3 className="font-semibold text-gray-800 mb-4">{editingId ? "Editar cupom" : "Criar cupom"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Código *</Label>
              <Input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value.toUpperCase()}))} placeholder="PROMO10" className="mt-1 font-mono uppercase" />
            </div>
            <div>
              <Label>Tipo</Label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none">
                <option value="percentage">Porcentagem (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
                <option value="free_shipping">Frete grátis</option>
              </select>
            </div>
            <div>
              <Label>Valor *</Label>
              <Input type="number" value={form.value} onChange={e => setForm(f => ({...f, value: e.target.value}))}
                placeholder={form.type === "percentage" ? "10" : "20.00"} className="mt-1" />
            </div>
            <div>
              <Label>Pedido mínimo (R$)</Label>
              <Input type="number" value={form.minOrderValue} onChange={e => setForm(f => ({...f, minOrderValue: e.target.value}))} placeholder="50.00" className="mt-1" />
            </div>
            <div>
              <Label>Usos máximos</Label>
              <Input type="number" value={form.maxUses} onChange={e => setForm(f => ({...f, maxUses: e.target.value}))} placeholder="Ilimitado" className="mt-1" />
            </div>
            <div>
              <Label>Usos por cliente</Label>
              <Input type="number" value={form.perCustomerLimit} onChange={e => setForm(f => ({...f, perCustomerLimit: e.target.value}))} className="mt-1" min="1" />
            </div>
            <div>
              <Label>Data início</Label>
              <Input type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({...f, startsAt: e.target.value}))} className="mt-1" />
            </div>
            <div>
              <Label>Data expiração</Label>
              <Input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({...f, expiresAt: e.target.value}))} className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-gray-900 text-white hover:bg-gray-800">{editingId ? "Salvar" : "Criar cupom"}</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" /></div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Tag size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum cupom criado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50">
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 text-right">Desconto</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Usos</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Expira</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c: any) => {
                const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                const exhausted = c.maxUses && c.usedCount >= c.maxUses;
                const active = c.active && !expired && !exhausted;
                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-bold text-gray-800">{c.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{TYPE_LABELS[c.type] || c.type}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {c.type === "percentage" ? `${c.value}%` : c.type === "fixed" ? `R$ ${Number(c.value).toFixed(2)}` : "Grátis"}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500 hidden sm:table-cell">
                      {c.usedCount}{c.maxUses ? `/${c.maxUses}` : ""}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {active ? "Ativo" : expired ? "Expirado" : exhausted ? "Esgotado" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400 hidden lg:table-cell">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("pt-BR") : "Sem prazo"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmingId === c.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-red-600">Excluir?</span>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" aria-label="Confirmar"><Check size={14} /></button>
                          <button onClick={() => setConfirmingId(null)} className="p-1.5 rounded-md border text-gray-500 hover:bg-gray-50" aria-label="Cancelar"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => copyLink(c.code)} title="Copiar link" className="p-1.5 rounded-md border text-gray-500 hover:bg-gray-50">
                            {copied === c.code ? <Check size={14} className="text-green-600" /> : <Link2 size={14} />}
                          </button>
                          <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-md border text-gray-500 hover:bg-gray-50"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmingId(c.id)} title="Excluir" className="p-1.5 rounded-md border text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                        </div>
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
