import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  parentId: number | null;
  sortOrder: number;
}

interface CategoryForm {
  name: string;
  description: string;
  parentId: string;
}

const emptyForm: CategoryForm = { name: "", description: "", parentId: "" };

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/categories");
      const data = await r.json();
      setCategories(data);
    } catch {
      toast({ title: "Erro ao carregar categorias", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        parentId: form.parentId ? Number(form.parentId) : null,
      };
      let r: Response;
      if (editId !== null) {
        r = await adminFetch(`/api/admin/categories/${editId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        r = await adminFetch("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "Erro ao salvar");
      }
      toast({ title: editId ? "Categoria atualizada!" : "Categoria criada!" });
      setForm(emptyForm);
      setShowForm(false);
      setEditId(null);
      await load();
    } catch (err: any) {
      toast({ title: err.message || "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditId(cat.id);
    setForm({
      name: cat.name,
      description: cat.description || "",
      parentId: cat.parentId ? String(cat.parentId) : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Excluir esta categoria?")) return;
    setDeletingId(id);
    try {
      const r = await adminFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Erro ao excluir");
      toast({ title: "Categoria excluída" });
      await load();
    } catch {
      toast({ title: "Erro ao excluir categoria", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      const r = await adminFetch(`/api/admin/categories/${cat.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !cat.active }),
      });
      if (!r.ok) throw new Error("Erro ao atualizar");
      toast({ title: cat.active ? "Categoria desativada" : "Categoria ativada" });
      await load();
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const parentOptions = categories.filter(c => editId === null || c.id !== editId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gerencie as categorias da loja</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
            <Plus size={16} /> Nova categoria
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 max-w-lg">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Tag size={16} />
            {editId ? "Editar categoria" : "Nova categoria"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="cat-name">Nome *</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Roupas femininas"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Descrição</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cat-parent">Categoria pai</Label>
              <select
                id="cat-parent"
                value={form.parentId}
                onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Nenhuma (categoria raiz)</option>
                {parentOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
                <Check size={15} /> {saving ? "Salvando..." : editId ? "Salvar" : "Criar"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel} className="gap-2">
                <X size={15} /> Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-48 flex-1" />
              <div className="h-6 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Tag size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhuma categoria cadastrada</p>
          <Button onClick={() => setShowForm(true)} className="mt-4 gap-2 bg-gray-900 text-white hover:bg-gray-800">
            <Plus size={16} /> Criar primeira categoria
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {cat.parentId && (
                      <span className="text-gray-400 mr-1 text-xs">↳</span>
                    )}
                    {cat.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{cat.description || "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(cat)}>
                      <Badge variant={cat.active ? "default" : "secondary"}>
                        {cat.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(cat)}
                        className="h-8 w-8 p-0"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(cat.id)}
                        disabled={deletingId === cat.id}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
