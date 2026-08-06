import { type ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Package, ShoppingBag, Users as UsersIcon, Settings,
  Upload, Tag, LogOut, Menu, X, ExternalLink, Store, FolderOpen, Star,
  BarChart2, UserCog, Repeat, ShoppingCart, MessageSquare, Package2
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";

const ALL_NAV_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "financeiro", "operacao"] },
  { href: "/admin/relatorios", icon: BarChart2, label: "Relatórios", roles: ["admin", "financeiro"] },
  { href: "/admin/produtos", icon: Package, label: "Produtos", roles: ["admin", "operacao"] },
  { href: "/admin/categorias", icon: FolderOpen, label: "Categorias", roles: ["admin", "operacao"] },
  { href: "/admin/destaques", icon: Star, label: "Destaques", roles: ["admin", "operacao"] },
  { href: "/admin/avaliacoes", icon: MessageSquare, label: "Avaliações", roles: ["admin", "operacao"] },
  { href: "/admin/kits", icon: Package2, label: "Kits", roles: ["admin", "operacao"] },
  { href: "/admin/pedidos", icon: ShoppingBag, label: "Pedidos", roles: ["admin", "financeiro"] },
  { href: "/admin/assinaturas", icon: Repeat, label: "Assinaturas", roles: ["admin", "financeiro"] },
  { href: "/admin/carrinhos", icon: ShoppingCart, label: "Carrinhos", roles: ["admin", "operacao"] },
  { href: "/admin/clientes", icon: UsersIcon, label: "Clientes", roles: ["admin", "financeiro"] },
  { href: "/admin/cupons", icon: Tag, label: "Cupons", roles: ["admin", "operacao"] },
  { href: "/admin/importar", icon: Upload, label: "Importar", roles: ["admin", "operacao"] },
  { href: "/admin/usuarios", icon: UserCog, label: "Usuários", roles: ["admin"] },
  { href: "/admin/configuracoes", icon: Settings, label: "Configurações", roles: ["admin"] },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, logout, isAuthenticated } = useAdminAuth();
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const userRole = admin?.role || "operacao";
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => item.roles.includes(userRole));

  useEffect(() => {
    fetch("/api/store/settings")
      .then(r => r.json())
      .then((s: any) => { if (s.logoUrl) setLogoUrl(s.logoUrl); })
      .catch(() => {});
  }, []);

  if (!isAuthenticated) {
    navigate("/admin/login");
    return null;
  }

  if (admin?.mustChangePassword) {
    navigate("/admin/trocar-senha");
    return null;
  }

  const handleLogout = () => { logout(); navigate("/admin/login"); };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={`flex flex-col bg-gray-900 text-white ${mobile ? "w-full" : "w-56 flex-shrink-0"} min-h-screen`}>
      <div className="p-5 border-b border-gray-800">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-8 object-contain max-w-[120px]" />
        ) : (
          <div className="flex items-center gap-2">
            <Store size={20} />
            <span className="font-bold text-sm">Loja Admin</span>
          </div>
        )}
        {admin && <p className="text-xs text-gray-400 mt-1 truncate">{admin.email}</p>}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors no-underline ${active ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-800 space-y-1">
        <Link href="/loja" target="_blank" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors no-underline">
          <ExternalLink size={16} /> Ver loja
        </Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-900 hover:text-red-200 transition-colors">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-56 h-full"><Sidebar mobile /></div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-600">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-800 text-sm">Admin</span>
          <button onClick={handleLogout} className="text-gray-400">
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
