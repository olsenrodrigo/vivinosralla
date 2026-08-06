import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Shield, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/context/AdminAuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  { value: "admin", label: "Administrador", icon: Shield, color: "bg-red-100 text-red-700", desc: "Acesso total ao sistema" },
  { value: "financeiro", label: "Financeiro", icon: TrendingUp, color: "bg-blue-100 text-blue-700", desc: "Relatórios e indicadores de venda" },
  { value: "operacao", label: "Operação", icon: Package, color: "bg-green-100 text-green-700", desc: "Cadastro de produtos e importação" },
];

interface AdminUser {
  id: number; name: string; email: string;
  role: string; active: boolean; createdAt: string;
}
interface FormState { name: string; email: string; password: string; role: string; }

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", email: "", password: "", role: "operacao" });
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const { admin: currentAdmin } = useAdminAuth();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await adminFetch("/api/admin/users");
    setUsers(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", password: "", role: "operacao" });
    setShowForm(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingUser) {
      const body: any = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      const r = await adminFetch(`/api/admin/users/${editingUser.id}`, { method: "PUT", body: JSON.stringify(body) });
      if (r.ok) { toast({ title: "Usuário atualizado!" }); setShowForm(false); load(); }
      else { const d = await r.json(); toast({ title: d.message || "Erro", variant: "destructive" }); }
    } else {
      const r = await adminFetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      if (r.ok) {
        const d = await r.json();
        setShowForm(false);
        if (d.tempPassword) {
          setTempPassword(d.tempPassword);
        } else {
          toast({ title: "Usuário criado!" });
          load();
        }
      } else { const d = await r.json(); toast({ title: d.message || "Erro", variant: "destructive" }); }
    }
    setSaving(false);
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Remover ${u.name}?`)) return;
    const r = await adminFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Usuário removido" }); load(); }
    else { const d = await r.json(); toast({ title: d.message || "Erro", variant: "destructive" }); }
  };

  const toggleActive = async (u: AdminUser) => {
    await adminFetch(`/api/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ active: !u.active }) });
    load();
  };

  const getRoleBadge = (role: string) => {
    const r = ROLES.find(x => x.value === role);
    return r ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${r.color}`}><r.icon size={11} />{r.label}</span> : <span>{role}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gerencie o acesso ao painel administrativo</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
          <Plus size={16} /> Novo usuário
        </Button>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {ROLES.map(r => (
          <div key={r.value} className={`rounded-xl p-3 ${r.color.split(' ')[0]} bg-opacity-30`}>
            <div className="flex items-center gap-2 mb-1">
              <r.icon size={16} className={r.color.split(' ')[1]} />
              <span className={`font-semibold text-sm ${r.color.split(' ')[1]}`}>{r.label}</span>
            </div>
            <p className="text-xs text-gray-600">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* User list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Usuário</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Perfil</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium hidden sm:table-cell">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>{users.map(u => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.name} {u.id === currentAdmin?.id && <span className="text-xs text-gray-400">(você)</span>}</div>
                  <div className="text-gray-500 text-xs">{u.email}</div>
                </td>
                <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <button onClick={() => toggleActive(u)} className={`text-xs px-2 py-1 rounded-full cursor-pointer ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.active ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil size={14} /></button>
                    {u.id !== currentAdmin?.id && (
                      <button onClick={() => handleDelete(u)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Temp password modal */}
      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-bold mb-2">Senha temporária criada</h3>
            <p className="text-gray-500 text-sm mb-4">Salve esta senha — ela não será exibida novamente.</p>
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-xl font-bold tracking-wider text-gray-900 mb-4 select-all">
              {tempPassword}
            </div>
            <p className="text-xs text-amber-600 mb-4">O usuário deverá trocar no primeiro acesso.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigator.clipboard.writeText(tempPassword)}>Copiar</Button>
              <Button className="flex-1 bg-gray-900 text-white" onClick={() => { setTempPassword(null); load(); }}>Entendi</Button>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editingUser ? "Editar usuário" : "Novo usuário"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div><Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="mt-1" placeholder="Nome completo" />
              </div>
              <div><Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="mt-1" placeholder="email@empresa.com" />
              </div>
              <div><Label>{editingUser ? "Nova senha (deixe em branco para manter)" : "Senha (deixe em branco para gerar automaticamente)"}</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="mt-1" placeholder="••••••••" minLength={editingUser ? undefined : 0} />
              </div>
              <div><Label>Perfil de acesso</Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {ROLES.map(r => (
                    <label key={r.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${form.role === r.value ? "border-gray-900 bg-gray-50" : "border-transparent hover:border-gray-200"}`}>
                      <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => setForm(f => ({...f, role: r.value}))} className="mt-0.5" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <r.icon size={14} />
                          <span className="font-medium text-sm">{r.label}</span>
                        </div>
                        <span className="text-xs text-gray-500">{r.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gray-900 text-white hover:bg-gray-800">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
