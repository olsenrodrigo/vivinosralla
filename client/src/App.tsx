import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import CookieConsent from "@/components/CookieConsent";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import StorePage from "@/pages/store/StorePage";
import ProductDetailPage from "@/pages/store/ProductDetailPage";
import CartPage from "@/pages/store/CartPage";
import CheckoutPage from "@/pages/store/CheckoutPage";
import OrderConfirmationPage from "@/pages/store/OrderConfirmationPage";
import AdminLoginPage from "@/pages/admin/LoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminProducts from "@/pages/admin/Products";
import AdminProductForm from "@/pages/admin/ProductForm";
import AdminOrders from "@/pages/admin/Orders";
import AdminOrderDetail from "@/pages/admin/OrderDetail";
import AdminCustomers from "@/pages/admin/Customers";
import AdminImport from "@/pages/admin/Import";
import AdminSettings from "@/pages/admin/Settings";
import AdminCoupons from "@/pages/admin/Coupons";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminAbandonedCarts from "@/pages/admin/AbandonedCarts";
import AdminReviews from "@/pages/admin/Reviews";
import AdminBundles from "@/pages/admin/Bundles";
import AdminCategories from "@/pages/admin/Categories";
import AdminFeaturedProducts from "@/pages/admin/FeaturedProducts";
import AdminUsers from "@/pages/admin/Users";
import AdminReports from "@/pages/admin/Reports";
import AdminChangePassword from "@/pages/admin/ChangePasswordPage";
import SobrePage from "@/pages/institucional/SobrePage";
import ContatoPage from "@/pages/institucional/ContatoPage";
import TrocasPage from "@/pages/institucional/TrocasPage";
import PrivacidadePage from "@/pages/institucional/PrivacidadePage";
import GuiaMedidasPage from "@/pages/institucional/GuiaMedidasPage";
import { CartProvider } from "@/context/CartContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";

function Router() {
  return (
    <Switch>
      {/* Site */}
      <Route path="/" component={Home} />

      {/* Loja */}
      <Route path="/loja" component={StorePage} />
      <Route path="/loja/produto/:slug" component={ProductDetailPage} />
      <Route path="/loja/carrinho" component={CartPage} />
      <Route path="/loja/checkout" component={CheckoutPage} />
      <Route path="/loja/pedido/:orderNumber" component={OrderConfirmationPage} />

      {/* Institucional */}
      <Route path="/sobre" component={SobrePage} />
      <Route path="/contato" component={ContatoPage} />
      <Route path="/trocas-e-devolucoes" component={TrocasPage} />
      <Route path="/privacidade" component={PrivacidadePage} />
      <Route path="/guia-de-medidas" component={GuiaMedidasPage} />

      {/* Admin */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/trocar-senha" component={AdminChangePassword} />
      <Route path="/admin" component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />
      <Route path="/admin/produtos" component={() => <AdminLayout><AdminProducts /></AdminLayout>} />
      <Route path="/admin/produtos/novo" component={() => <AdminLayout><AdminProductForm /></AdminLayout>} />
      <Route path="/admin/produtos/:id" component={() => <AdminLayout><AdminProductForm /></AdminLayout>} />
      <Route path="/admin/pedidos" component={() => <AdminLayout><AdminOrders /></AdminLayout>} />
      <Route path="/admin/pedidos/:id" component={() => <AdminLayout><AdminOrderDetail /></AdminLayout>} />
      <Route path="/admin/clientes" component={() => <AdminLayout><AdminCustomers /></AdminLayout>} />
      <Route path="/admin/importar" component={() => <AdminLayout><AdminImport /></AdminLayout>} />
      <Route path="/admin/cupons" component={() => <AdminLayout><AdminCoupons /></AdminLayout>} />
      <Route path="/admin/assinaturas" component={() => <AdminLayout><AdminSubscriptions /></AdminLayout>} />
      <Route path="/admin/carrinhos" component={() => <AdminLayout><AdminAbandonedCarts /></AdminLayout>} />
      <Route path="/admin/avaliacoes" component={() => <AdminLayout><AdminReviews /></AdminLayout>} />
      <Route path="/admin/kits" component={() => <AdminLayout><AdminBundles /></AdminLayout>} />
      <Route path="/admin/categorias" component={() => <AdminLayout><AdminCategories /></AdminLayout>} />
      <Route path="/admin/destaques" component={() => <AdminLayout><AdminFeaturedProducts /></AdminLayout>} />
      <Route path="/admin/configuracoes" component={() => <AdminLayout><AdminSettings /></AdminLayout>} />
      <Route path="/admin/usuarios" component={() => <AdminLayout><AdminUsers /></AdminLayout>} />
      <Route path="/admin/relatorios" component={() => <AdminLayout><AdminReports /></AdminLayout>} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Link com cupom: ?cupom=XYZ (ou ?coupon=) em qualquer rota → guarda pra aplicar
  // no checkout e limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("cupom") ?? params.get("coupon");
    if (code) {
      try {
        localStorage.setItem("wl_coupon", code.toUpperCase());
      } catch {
        /* ignore */
      }
      params.delete("cupom");
      params.delete("coupon");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  useEffect(() => {
    fetch("/api/store/settings")
      .then(r => r.json())
      .then((s: any) => {
        if (s.faviconUrl) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = s.faviconUrl;
        }
        // O <title> do index.html já traz marca + posicionamento (SEO);
        // só assume o nome do banco se a página não tiver título próprio.
        if (s.storeName && !document.title) {
          document.title = s.storeName;
        }
      })
      .catch(() => {});
  }, []);

  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminAuthProvider>
          <CartProvider>
            <Router />
            <Toaster />
            {!isAdmin && <CookieConsent />}
          </CartProvider>
        </AdminAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
