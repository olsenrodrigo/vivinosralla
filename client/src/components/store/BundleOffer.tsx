import { useState } from "react";
import { Check, PackagePlus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { priceBundle, type BundleDiscountType } from "@shared/bundle-pricing";

interface Component {
  productSlug: string;
  productTitle: string;
  image: string | null;
  active: boolean;
  unitPrice: number;
  quantity: number;
}
export interface ApiBundle {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  discountType: BundleDiscountType;
  discountValue: string;
  components: Component[];
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export default function BundleOffer({ bundle, primaryColor = "#5B8C9B" }: { bundle: ApiBundle; primaryColor?: string }) {
  const { addBundle, loading } = useCart();
  const { toast } = useToast();
  const [added, setAdded] = useState(false);

  const pricing = priceBundle(
    bundle.discountType,
    Number(bundle.discountValue),
    bundle.components.map((c) => ({ productSlug: c.productSlug, unitPrice: c.unitPrice, quantity: c.quantity }))
  );
  const savePct = pricing.originalTotal > 0 ? Math.round((pricing.discount / pricing.originalTotal) * 100) : 0;

  const handleAdd = async () => {
    const ok = await addBundle(bundle.slug, 1);
    if (ok) {
      setAdded(true);
      toast({ title: "Kit adicionado ao carrinho!", description: bundle.name });
      window.setTimeout(() => setAdded(false), 2000);
    } else {
      toast({ title: "Não foi possível adicionar o kit", variant: "destructive" });
    }
  };

  return (
    <div className="mt-8  border-2 p-5" style={{ borderColor: `${primaryColor}40`, background: `${primaryColor}0d` }}>
      <div className="flex items-center gap-2">
        <PackagePlus size={18} style={{ color: primaryColor }} />
        <h3 className="text-lg font-bold text-vn-ink">{bundle.name}</h3>
        {savePct > 0 && <span className="px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: primaryColor }}>−{savePct}%</span>}
      </div>
      {bundle.description && <p className="mt-1 text-sm text-vn-ink-soft">{bundle.description}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {bundle.components.map((c, i) => (
          <div key={c.productSlug + i} className="flex items-center gap-2">
            {c.image && <img src={c.image} alt="" className="h-12 w-12  object-cover" />}
            <span className="text-sm text-vn-ink-soft">{c.quantity}x {c.productTitle}</span>
            {i < bundle.components.length - 1 && <span className="text-vn-olive-300">+</span>}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          {pricing.discount > 0 && <span className="mr-2 text-sm text-vn-ink-soft line-through">{brl(pricing.originalTotal)}</span>}
          <span className="text-2xl font-bold" style={{ color: primaryColor }}>{brl(pricing.bundleTotal)}</span>
          {pricing.discount > 0 && <span className="ml-2 text-sm font-medium" style={{ color: primaryColor }}>economize {brl(pricing.discount)}</span>}
        </div>
        <button type="button" onClick={handleAdd} disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: primaryColor }}>
          {added ? <><Check size={16} /> Adicionado</> : <><PackagePlus size={16} /> Adicionar kit</>}
        </button>
      </div>
    </div>
  );
}
