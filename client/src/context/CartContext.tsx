import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";

interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: string;
  productTitle: string;
  productSlug: string;
  mainImage: string | null;
  /** Rótulo da variante, ex.: "M · Caramelo". Nulo em produto sem grade. */
  variantTitle?: string | null;
}

interface Cart {
  id: number;
  sessionId: string;
  items: CartItem[];
}

interface CartContextType {
  cart: Cart | null;
  sessionId: string;
  loading: boolean;
  /** true depois que a primeira leitura do carrinho no servidor terminou. */
  initialized: boolean;
  addToCart: (productId: number, variantId: number | null, quantity: number) => Promise<void>;
  addBundle: (slug: string, quantity: number) => Promise<boolean>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  itemCount: number;
  total: number;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

function getSessionId(): string {
  let sid = localStorage.getItem("cart_session_id");
  if (!sid) {
    sid = uuidv4();
    localStorage.setItem("cart_session_id", sid);
  }
  return sid;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState(getSessionId);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Recuperação de carrinho abandonado: ?recover=<sessionId> adota a sessão
  // (o carrinho já existe no servidor sob esse id) e limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recover = params.get("recover");
    if (recover && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recover)) {
      try { localStorage.setItem("cart_session_id", recover); } catch { /* ignore */ }
      setSessionId(recover);
      params.delete("recover");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/cart/${sessionId}`);
      if (res.ok) setCart(await res.json());
    } catch {}
  }, [sessionId]);

  // Marca que a primeira leitura do carrinho terminou. Sem isso, telas que
  // dependem do carrinho (checkout) reagem ao `cart` ainda nulo do 1º render.
  useEffect(() => {
    let vivo = true;
    setInitialized(false);
    refresh().finally(() => {
      if (vivo) setInitialized(true);
    });
    return () => { vivo = false; };
  }, [refresh]);

  const addToCart = async (productId: number, variantId: number | null, quantity: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/${sessionId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, quantity }),
      });
      if (res.ok) setCart(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const addBundle = async (slug: string, quantity: number): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart/${sessionId}/add-bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, quantity }),
      });
      if (res.ok) { setCart(await res.json()); return true; }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (itemId: number, quantity: number) => {
    // A sessão vai na URL: o servidor só altera item que pertence a este carrinho.
    await fetch(`/api/cart/${sessionId}/item/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    await refresh();
  };

  const clearCart = async () => {
    await fetch(`/api/cart/${sessionId}`, { method: "DELETE" });
    await refresh();
  };

  const itemCount = cart?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const total = cart?.items?.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0) ?? 0;

  return (
    <CartContext.Provider value={{ cart, sessionId, loading, initialized, addToCart, addBundle, updateItem, clearCart, itemCount, total, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
