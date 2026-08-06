import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

interface FeaturedProduct {
  id: number;
  title: string;
  price: string;
  featured: boolean;
  mainImage: string | null;
}

const MAX_FEATURED = 8;

export default function AdminFeaturedProducts() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/featured-products");
      const data = await r.json();
      setProducts(data);
    } catch {
      toast({ title: "Erro ao carregar produtos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const featuredCount = products.filter(p => p.featured).length;

  const handleToggle = async (product: FeaturedProduct) => {
    if (!product.featured && featuredCount >= MAX_FEATURED) {
      toast({
        title: `Máximo de ${MAX_FEATURED} produtos destacados atingido`,
        description: "Remova um produto destacado antes de adicionar outro.",
        variant: "destructive",
      });
      return;
    }
    setTogglingId(product.id);
    try {
      const r = await adminFetch(`/api/admin/products/${product.id}/featured`, {
        method: "PUT",
        body: JSON.stringify({ featured: !product.featured }),
      });
      if (!r.ok) throw new Error("Erro ao atualizar");
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, featured: !p.featured } : p)
      );
      toast({
        title: product.featured ? "Produto removido dos destaques" : "Produto adicionado aos destaques",
      });
    } catch {
      toast({ title: "Erro ao atualizar produto", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos em Destaque</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Selecione até {MAX_FEATURED} produtos para exibir em carrosséis e seções especiais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={featuredCount >= MAX_FEATURED ? "destructive" : featuredCount > 0 ? "default" : "secondary"}
            className="text-sm px-3 py-1"
          >
            <Star size={13} className="mr-1" />
            {featuredCount} / {MAX_FEATURED} destacados
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-3 animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
              <div className="h-3 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Star size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhum produto cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map(product => (
            <div
              key={product.id}
              className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${
                product.featured
                  ? "ring-2 ring-yellow-400 shadow-yellow-100"
                  : "hover:shadow-md"
              }`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-gray-100">
                {product.mainImage ? (
                  <img
                    src={product.mainImage}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Star size={32} />
                  </div>
                )}
                {product.featured && (
                  <div className="absolute top-2 right-2 bg-yellow-400 rounded-full p-1 shadow">
                    <Star size={12} className="text-white fill-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2 mb-1">
                  {product.title}
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  R$ {Number(product.price).toFixed(2).replace(".", ",")}
                </p>
                <Button
                  size="sm"
                  variant={product.featured ? "default" : "outline"}
                  onClick={() => handleToggle(product)}
                  disabled={togglingId === product.id}
                  className={`w-full text-xs h-7 gap-1 ${
                    product.featured
                      ? "bg-yellow-400 text-white hover:bg-yellow-500 border-yellow-400"
                      : ""
                  }`}
                >
                  <Star size={11} className={product.featured ? "fill-white" : ""} />
                  {togglingId === product.id
                    ? "..."
                    : product.featured
                    ? "Destacado"
                    : "Destacar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
