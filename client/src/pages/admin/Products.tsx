import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "#10b981" },
  draft: { label: "Rascunho", color: "#f59e0b" },
  archived: { label: "Arquivado", color: "#9ca3af" },
};

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const limit = 20;

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    const r = await adminFetch(`/api/admin/products?${params}`);
    const d = await r.json();
    setProducts(d.products || []);
    setTotal(d.total || 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, search]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Excluir "${title}"?`)) return;
    await adminFetch(`/api/admin/products/${id}`, { method: "DELETE" });
    toast({ title: "Produto excluído" });
    load();
  };

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} produto(s) cadastrado(s)</p>
        </div>
        <Link href="/admin/produtos/novo">
          <a className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 no-underline">
            <Plus size={16} /> Novo produto
          </a>
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, SKU, marca..." className="pl-9" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-900" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum produto encontrado</p>
            <Link href="/admin/produtos/novo"><a className="text-blue-600 text-sm mt-1 hover:underline no-underline inline-block">Criar primeiro produto</a></Link>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50">
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Estoque</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const status = STATUS_LABELS[p.status] || { label: p.status, color: "#9ca3af" };
                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                            {p.mainImage && <img src={p.mainImage} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 line-clamp-1">{p.title}</p>
                            {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono hidden sm:table-cell">{p.sku || "—"}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                        R$ {Number(p.price).toFixed(2).replace(".", ",")}
                      </td>
                      <td className="px-4 py-3 text-center text-sm hidden md:table-cell">
                        <span className={`${p.stockQuantity <= 5 && p.stockQuantity > 0 ? "text-yellow-600" : p.stockQuantity <= 0 ? "text-red-500" : "text-gray-700"}`}>
                          {p.stockQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${status.color}20`, color: status.color }}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/produtos/${p.id}`}>
                            <a className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg no-underline transition-colors" title="Editar">
                              <Edit size={15} />
                            </a>
                          </Link>
                          <button onClick={() => handleDelete(p.id, p.title)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

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
