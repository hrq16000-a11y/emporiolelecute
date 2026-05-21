/**
 * Cálculos puros de totais e descontos do carrinho.
 * Sem side-effects, sem dependência de React/contexto — fácil de testar.
 *
 * Regras:
 * - `originalPrice` só conta como "de" quando é estritamente maior que `price`.
 * - Itens de kit (bundleId definido) entram normalmente na soma; o preço já
 *   vem precificado pelo kit, então não recebem `originalPrice` e simplesmente
 *   não geram economia (savings = 0 para eles), preservando o subtotal.
 */

export interface CartTotalsItem {
  price: number;
  originalPrice?: number;
  quantity: number;
  bundleId?: string;
}

export interface CartTotals {
  /** Soma de price * quantity para todos os itens. */
  subtotal: number;
  /** Soma de (originalPrice ?? price) * quantity — preço cheio "de". */
  originalSubtotal: number;
  /** originalSubtotal - subtotal. Sempre >= 0. */
  savings: number;
  /** true quando ao menos um item tem originalPrice > price. */
  hasDiscount: boolean;
}

/** Retorna o preço efetivo "de" do item (originalPrice se válido, senão price). */
export function effectiveOriginalPrice(item: CartTotalsItem): number {
  return item.originalPrice && item.originalPrice > item.price
    ? item.originalPrice
    : item.price;
}

/** Percentual de desconto arredondado, ou null quando não há desconto. */
export function discountPercent(item: CartTotalsItem): number | null {
  if (!item.originalPrice || item.originalPrice <= item.price) return null;
  return Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100);
}

/** Calcula totais agregados do carrinho. */
export function calcCartTotals(items: CartTotalsItem[]): CartTotals {
  let subtotal = 0;
  let originalSubtotal = 0;
  let hasDiscount = false;

  for (const item of items) {
    const qty = item.quantity;
    subtotal += item.price * qty;
    const original = effectiveOriginalPrice(item);
    originalSubtotal += original * qty;
    if (original > item.price) hasDiscount = true;
  }

  const savings = Math.max(0, originalSubtotal - subtotal);
  return { subtotal, originalSubtotal, savings, hasDiscount };
}
