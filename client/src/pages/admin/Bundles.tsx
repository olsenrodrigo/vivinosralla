import { useEffect, useState } from "react";
import { Check, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import { priceBundle, type BundleDiscountType } from "@shared/bundle-pricing";

interface Item { productId: number; quantity: number; }
interface Form { id: number | null; slug: string; name: string; description: string; discountType: BundleDiscountType; discountValue: string; active: boolean; items: Item[]; }
const EMPTY: Form = { id: null, slug: "", name: "", description: "", discountType: "percentage", discountValue: "10", active: true, items: [] };
const TYPE_LABEL: Record<string, string> = { percentage: "% desconto", fixed: "R$ off", fixed_price: "Preço fixo" };
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export default function AdminBundles() {
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const { toast } = useToast();

  const prodById = (id: number) => products.find((p) => p.id === id);
  const load = () => {
    setLoading(true);
    adminFetch("/api/admin/bundles").then((r) => (r.ok ? r.json() : [])).then(setRows).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    adminFetch("/api/admin/products?limit=500").then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products ?? d ?? [])).catch(() => {});
  }, []);

  const openNew = () => { setForm({ ...EMPTY }); setErr(""); setShowForm(true); };
  const openEdit = (b: any) => {
    setForm({ id: b.id, slug: b.slug, name: b.name, description: b.description ?? "", discountType: b.discountType, discountValue: String(b.discountValue), active: b.active, items: (b.components ?? []).map((c: any) => ({ productId: c.productId, quantity: c.quantity })) });
    setErr(""); setShowForm(true);
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { productId: products[0]?.id ?? 0, quantity: 1 }] }));
  const setItem = (i: number, patch: Partial<Item>) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const preview = () => {
    const comps = form.items.map((it) => { const p = prodById(it.productId); return { productSlug: p?.slug ?? "", unitPrice: Number(p?.price ?? 0), quantity: it.quantity }; }).filter((c) => c.productSlug);
    if (!comps.length) return null;
    return priceBundle(form.discountType, Number(form.discountValue) || 0, comps);
  };

  const save = async () => {
    setErr("");
    if (!form.slug.trim() || !form.name.trim() || form.items.length === 0) { setErr("Slug, nome e ao menos 1 produto são obrigatórios"); return; }
    const payload = { slug: form.slug.trim(), name: form.name.trim(), description: form.description || null, discountType: form.discountType, discountValue: form.discountValue, active: form.active, items: form.items.filter((it) => it.productId > 0) };
    const res = await adminFetch(form.id ? `/api/admin/bundles/${form.id}` : "/api/admin/bundles", { method: form.id ? "PUT" : "POST", body: JSON.stringify(payload) });
    if (res.ok) { setShowForm(false); setForm({ ...EMPTY }); load(); toast({ title: form.id ? "Kit atualizado" : "Kit criado" }); }
    else { const d = await res.json().catch(() => ({})); setErr(d.message || "Falha ao salvar"); }
  };
  const remove = async (id: number) => { setConfirmDel(null); const res = await adminFetch(`/api/admin/bundles/${id}`, { method: "DELETE" }); if (res.ok || res.status === 204) load(); };

  const pv = preview();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kits (compre junto)</h1>
          <p className="text-gray-500 text-sm mt-0.5">Combos de produtos com desconto.</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-gray-900 text-white"><Plus size={16} /> Novo kit</Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h3 className="font-semibold text-gray-800 mb-4">{form.id ? "Editar kit" : "Criar kit"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="kit-verao" className="mt-1 font-mono" /></div>
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kit Verão" className="mt-1" /></div>
            <div><Label>Tipo de desconto</Label>
              <select value={form.discountType} onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as BundleDiscountType }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                <option value="percentage">Porcentagem (%)</option>
                <option value="fixed">Valor fixo (R$ off)</option>
                <option value="fixed_price">Preço fixo do kit (R$)</option>
              </select></div>
            <div><Label>Valor</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} className="mt-1" /></div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <Label>Produtos do kit</Label>
              <button onClick={addItem} className="text-sm font-semibold text-gray-700">+ Adicionar produto</button>
            </div>
            <div className="mt-2 space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={it.productId} onChange={(e) => setItem(i, { productId: Number(e.target.value) })} className="flex-1 border rounded-md px-3 py-2 text-sm">
                    {products.map((p) => <option key={p.id} value={p.id}>{p.title} — {brl(Number(p.price))}</option>)}
                  </select>
                  <Input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Math.max(1, Number(e.target.value)) })} className="w-20" />
                  <button onClick={() => removeItem(i)} className="text-red-500"><X size={16} /></button>
                </div>
              ))}
              {form.items.length === 0 && <p className="text-sm text-gray-400">Nenhum produto adicionado.</p>}
            </div>
          </div>

          {pv && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
              <span className="text-gray-400 line-through mr-2">{brl(pv.originalTotal)}</span>
              <span className="font-bold text-gray-900">{brl(pv.bundleTotal)}</span>
              <span className="ml-2 text-green-600">(economia {brl(pv.discount)})</span>
            </div>
          )}
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4" /> Ativo</label>
            <Button variant="outline" onClick={() => setShowForm(false)} className="ml-auto">Cancelar</Button>
            <Button onClick={save} className="bg-gray-900 text-white">{form.id ? "Salvar" : "Criar"}</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><Package size={40} className="mx-auto mb-2 opacity-30" /><p>Nenhum kit criado</p></div>
        ) : (
          <div className="divide-y">
            {rows.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-gray-800">{b.name} {!b.active && <span className="text-xs text-gray-400">(inativo)</span>}</p>
                  <p className="text-xs text-gray-400">{(b.components ?? []).map((c: any) => `${c.quantity}x ${c.productTitle}`).join(" + ")} · {TYPE_LABEL[b.discountType]} {b.discountValue}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(b)} className="p-2 text-gray-500 hover:text-gray-800"><Pencil size={16} /></button>
                  {confirmDel === b.id ? (
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => remove(b.id)} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs"><Check size={13} /></button>
                      <button onClick={() => setConfirmDel(null)} className="rounded-md border px-3 py-1.5 text-xs"><X size={13} /></button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDel(b.id)} className="p-2 text-red-500"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
