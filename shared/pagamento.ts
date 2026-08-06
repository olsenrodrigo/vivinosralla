/**
 * Regras de preço do pagamento, compartilhadas entre servidor e cliente.
 *
 * O desconto do PIX é anunciado na página do produto e no checkout, então
 * precisa ser calculado do mesmo jeito nos dois lados — senão a loja mostra um
 * valor e cobra outro.
 */

/** Desconto para pagamento via PIX (0.05 = 5%). Zero desliga a oferta. */
export const PIX_DESCONTO = 0.05;

/**
 * Desconto do PIX em reais. Incide sobre a mercadoria já com cupom aplicado —
 * nunca sobre o frete, que é custo repassado da transportadora.
 */
export function descontoPix(subtotal: number, descontoCupom = 0): number {
  const mercadoria = Math.max(0, subtotal - descontoCupom);
  return Math.round(mercadoria * PIX_DESCONTO * 100) / 100;
}
