// Testes unitários puros dos helpers de empacotamento e fallback.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { packCart, buildMelhorEnvioPayload, quoteCorreiosEstimate, round2 } from "./lib.ts";

Deno.test("packCart: soma pesos reais e ignora itens não-shippable", () => {
  const { shippable, totalWeight, subtotal } = packCart([
    { name: "A", quantity: 2, weight_kg: 0.4, unit_price: 10 },
    { name: "B", quantity: 3, weight_kg: 0.1, unit_price: 5 },
    { name: "C-digital", quantity: 1, weight_kg: 0.5, unit_price: 30, requires_shipping: false },
  ], 0.3);
  assertEquals(shippable.length, 2);
  assertEquals(totalWeight, round2(2 * 0.4 + 3 * 0.1));
  assertEquals(subtotal, round2(2 * 10 + 3 * 5));
});

Deno.test("packCart: usa default quando peso não informado", () => {
  const { totalWeight } = packCart([{ name: "X", quantity: 4 }], 0.25);
  assertEquals(totalWeight, 1.0);
});

Deno.test("buildMelhorEnvioPayload: consolida em 1 caixa única", () => {
  const p = buildMelhorEnvioPayload({
    origin: "80000000", destino: "01310100",
    totalWeight: 2.4, subtotal: 150,
    boxW: 16, boxH: 11, boxL: 20,
  });
  assertEquals(p.products.length, 1, "deve ser sempre 1 caixa consolidada");
  assertEquals(p.products[0].quantity, 1);
  assertEquals(p.products[0].weight, 2.4);
  assertEquals(p.products[0].width, 16);
  assertEquals(p.products[0].insurance_value, 150);
});

Deno.test("buildMelhorEnvioPayload: peso mínimo de 0.1kg", () => {
  const p = buildMelhorEnvioPayload({
    origin: "80000000", destino: "01310100",
    totalWeight: 0, subtotal: 10, boxW: 16, boxH: 11, boxL: 20,
  });
  assertEquals(p.products[0].weight, 0.1);
});

Deno.test("quoteCorreiosEstimate: mesma região é mais barato que distante", () => {
  const near = quoteCorreiosEstimate({ totalWeight: 1, destino: "80010000", origin: "80000000" });
  const far = quoteCorreiosEstimate({ totalWeight: 1, destino: "69000000", origin: "80000000" });
  assert(near[0].price < far[0].price, "região próxima < região distante");
});

Deno.test("quoteCorreiosEstimate: SEDEX > PAC e dentro do cap", () => {
  const opts = quoteCorreiosEstimate({ totalWeight: 5, destino: "01310100", origin: "80000000" });
  const [pac, sedex] = opts;
  assert(sedex.price > pac.price);
  assert(pac.price <= 60);
  assert(sedex.price <= 95);
});

Deno.test("quoteCorreiosEstimate: piso de R$15 para PAC", () => {
  const opts = quoteCorreiosEstimate({ totalWeight: 0.05, destino: "80010000", origin: "80000000" });
  assert(opts[0].price >= 15);
});
