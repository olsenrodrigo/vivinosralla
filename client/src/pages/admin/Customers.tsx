import { useState, useEffect } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { adminFetch } from "@/context/AdminAuthContext";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const r = await adminFetch(`/api/admin/customers${params}`);
    setCustomers(await r.json());
    setLoading(false);
  };

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-500 text-sm mt-0.5">{customers.length} cliente(s)</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" /></div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum cliente ainda</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50">
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">CPF/CNPJ</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Telefone</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c: any) => (
                <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono hidden md:table-cell">{c.cpfCnpj || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 text-right hidden md:table-cell">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
