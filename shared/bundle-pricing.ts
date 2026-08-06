// Preço de kit ("compre junto"). Fonte ÚNICA da matemática — usada no front
// (exibição) e no back (validação/gravação do pedido). Todo cálculo em centavos
// (inteiros) para evitar erro de ponto flutuante; o pro-rata fecha exatamente no
// total do kit (o último item absorve o resto dos centavos).

export type BundleDiscountType = "percentage" | "fixed" | "fixed_price";

export interface BundleComponentInput {
  productSlug: string;
  unitPrice: number; // preço unitário atual (do catálogo)
  quantity: number;
}

export interface BundleComponentPriced {
  productSlug: string;
  quantity: number;
  originalUnitPrice: number;
  unitPrice: number; // com desconto do kit distribuído (pro-rata)
  lineTotal: number; // unitPrice * quantity (com o ajuste de centavos)
}

export interface BundlePricing {
  originalTotal: number;
  bundleTotal: number;
  discount: number;
  components: BundleComponentPriced[];
}

const toCents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => Math.round(c) / 100;

/**
 * Calcula o preço de um kit e distribui o desconto pro-rata entre os itens.
 * - percentage: desconto de X% sobre o total
 * - fixed:      abate X reais do total (nunca abaixo de 0)
 * - fixed_price: o kit inteiro custa X reais
 * O total do kit nunca excede o total original (clamp).
 */
export function priceBundle(
  discountType: BundleDiscountType,
  discountValue: number,
  components: BundleComponentInput[]
): BundlePricing {
  const origLineCents = components.map((c) => toCents(c.unitPrice) * c.quantity);
  const originalTotalCents = origLineCents.reduce((a, b) => a + b, 0);

  let bundleTotalCents: number;
  if (discountType === "percentage") {
    const pct = Math.max(0, Math.min(100, discountValue));
    bundleTotalCents = Math.round((originalTotalCents * (100 - pct)) / 100);
  } else if (discountType === "fixed") {
    bundleTotalCents = originalTotalCents - toCents(discountValue);
  } else {
    // fixed_price: o kit custa exatamente discountValue
    bundleTotalCents = toCents(discountValue);
  }
  bundleTotalCents = Math.max(0, Math.min(bundleTotalCents, originalTotalCents));

  let allocated = 0;
  const priced: BundleComponentPriced[] = components.map((c, i) => {
    let lineCents: number;
    if (i === components.length - 1) {
      lineCents = Math.max(0, bundleTotalCents - allocated); // último absorve o resto (nunca negativo)
    } else {
      const raw = originalTotalCents === 0
        ? 0
        : Math.round((origLineCents[i] * bundleTotalCents) / originalTotalCents);
      // Nunca aloca mais que o saldo restante (evita linha negativa no último item).
      lineCents = Math.min(raw, bundleTotalCents - allocated);
      allocated += lineCents;
    }
    const qty = c.quantity || 1;
    return {
      productSlug: c.productSlug,
      quantity: c.quantity,
      originalUnitPrice: c.unitPrice,
      unitPrice: fromCents(Math.round(lineCents / qty)),
      lineTotal: fromCents(lineCents),
    };
  });

  return {
    originalTotal: fromCents(originalTotalCents),
    bundleTotal: fromCents(bundleTotalCents),
    discount: fromCents(originalTotalCents - bundleTotalCents),
    components: priced,
  };
}
