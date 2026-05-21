import { describe, it, expect } from "vitest";
import {
  calcCartTotals,
  discountPercent,
  effectiveOriginalPrice,
  type CartTotalsItem,
} from "./cartTotals";

const item = (overrides: Partial<CartTotalsItem> = {}): CartTotalsItem => ({
  price: 10,
  quantity: 1,
  ...overrides,
});

describe("calcCartTotals", () => {
  it("carrinho vazio retorna zeros e sem desconto", () => {
    const r = calcCartTotals([]);
    expect(r).toEqual({ subtotal: 0, originalSubtotal: 0, savings: 0, hasDiscount: false });
  });

  it("apenas produtos sem desconto: savings = 0, hasDiscount = false", () => {
    const r = calcCartTotals([
      item({ price: 10, quantity: 2 }),
      item({ price: 25, quantity: 1 }),
    ]);
    expect(r.subtotal).toBe(45);
    expect(r.originalSubtotal).toBe(45);
    expect(r.savings).toBe(0);
    expect(r.hasDiscount).toBe(false);
  });

  it("apenas produtos com desconto: soma e economia corretas", () => {
    const r = calcCartTotals([
      item({ price: 8, originalPrice: 10, quantity: 3 }), // economiza 6
      item({ price: 18, originalPrice: 20, quantity: 2 }), // economiza 4
    ]);
    expect(r.subtotal).toBe(60);
    expect(r.originalSubtotal).toBe(70);
    expect(r.savings).toBe(10);
    expect(r.hasDiscount).toBe(true);
  });

  it("carrinho misto: só desconta nos itens com originalPrice > price", () => {
    const r = calcCartTotals([
      item({ price: 10, quantity: 1 }),
      item({ price: 8, originalPrice: 10, quantity: 2 }), // economiza 4
      item({ price: 30, originalPrice: 30, quantity: 1 }), // sem desconto (igual)
    ]);
    expect(r.subtotal).toBe(10 + 16 + 30);
    expect(r.originalSubtotal).toBe(10 + 20 + 30);
    expect(r.savings).toBe(4);
    expect(r.hasDiscount).toBe(true);
  });

  it("originalPrice <= price é ignorado (não cria desconto negativo)", () => {
    const r = calcCartTotals([
      item({ price: 10, originalPrice: 8, quantity: 1 }),
      item({ price: 10, originalPrice: 10, quantity: 1 }),
    ]);
    expect(r.subtotal).toBe(20);
    expect(r.originalSubtotal).toBe(20);
    expect(r.savings).toBe(0);
    expect(r.hasDiscount).toBe(false);
  });

  it("itens de kit (bundleId) entram no subtotal sem gerar economia", () => {
    const r = calcCartTotals([
      item({ price: 15, quantity: 2, bundleId: "kit-1" }),
      item({ price: 5, quantity: 1, bundleId: "kit-1" }),
      item({ price: 10, originalPrice: 12, quantity: 1 }), // produto avulso com desconto
    ]);
    expect(r.subtotal).toBe(30 + 5 + 10);
    expect(r.originalSubtotal).toBe(30 + 5 + 12);
    expect(r.savings).toBe(2);
    expect(r.hasDiscount).toBe(true);
  });
});

describe("effectiveOriginalPrice", () => {
  it("retorna originalPrice quando maior que price", () => {
    expect(effectiveOriginalPrice({ price: 8, originalPrice: 10, quantity: 1 })).toBe(10);
  });
  it("cai para price quando originalPrice é inválido", () => {
    expect(effectiveOriginalPrice({ price: 10, quantity: 1 })).toBe(10);
    expect(effectiveOriginalPrice({ price: 10, originalPrice: 10, quantity: 1 })).toBe(10);
    expect(effectiveOriginalPrice({ price: 10, originalPrice: 5, quantity: 1 })).toBe(10);
  });
});

describe("discountPercent", () => {
  it("calcula percentual arredondado", () => {
    expect(discountPercent({ price: 75, originalPrice: 100, quantity: 1 })).toBe(25);
    expect(discountPercent({ price: 67, originalPrice: 100, quantity: 1 })).toBe(33);
  });
  it("arredonda corretamente nos limites (banker's rounding não afeta -X%)", () => {
    // 12.5% → 13 (Math.round arredonda para cima em .5 positivo)
    expect(discountPercent({ price: 87.5, originalPrice: 100, quantity: 1 })).toBe(13);
    // 33.333...% → 33
    expect(discountPercent({ price: 20, originalPrice: 30, quantity: 1 })).toBe(33);
    // 66.666...% → 67
    expect(discountPercent({ price: 10, originalPrice: 30, quantity: 1 })).toBe(67);
    // 1% — desconto mínimo perceptível
    expect(discountPercent({ price: 99, originalPrice: 100, quantity: 1 })).toBe(1);
  });
  it("retorna null sem desconto", () => {
    expect(discountPercent({ price: 10, quantity: 1 })).toBeNull();
    expect(discountPercent({ price: 10, originalPrice: 10, quantity: 1 })).toBeNull();
  });
});

describe("calcCartTotals — quantidades e precisão", () => {
  it("quantidade alta mantém soma exata até centavos", () => {
    const r = calcCartTotals([
      { price: 9.9, originalPrice: 12.5, quantity: 100 },
    ]);
    expect(r.subtotal).toBeCloseTo(990, 2);
    expect(r.originalSubtotal).toBeCloseTo(1250, 2);
    expect(r.savings).toBeCloseTo(260, 2);
  });
  it("quantidade zero não contribui ao subtotal (savings = 0)", () => {
    // Em produção minQuantity impede qty=0; este teste documenta que
    // mesmo num caso degenerado a soma fica correta.
    const r = calcCartTotals([
      { price: 10, originalPrice: 15, quantity: 0 },
      { price: 5, quantity: 2 },
    ]);
    expect(r.subtotal).toBe(10);
    expect(r.originalSubtotal).toBe(10);
    expect(r.savings).toBe(0);
  });
  it("preços com 3 casas (truncamento do banco) somam previsivelmente", () => {
    const r = calcCartTotals([
      { price: 9.99, originalPrice: 12.99, quantity: 3 },
    ]);
    expect(r.subtotal).toBeCloseTo(29.97, 2);
    expect(r.originalSubtotal).toBeCloseTo(38.97, 2);
    expect(r.savings).toBeCloseTo(9, 2);
  });
});

