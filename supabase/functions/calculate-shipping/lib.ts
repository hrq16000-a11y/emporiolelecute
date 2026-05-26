// Pure helpers for calculate-shipping. Sem dependências de Deno/HTTP — testáveis.

export type ShippingOption = {
  provider: string;
  service_name: string;
  price: number;
  estimated_delivery_days: string;
};

export type Item = {
  product_id?: string;
  name: string;
  quantity: number;
  weight_kg?: number;
  unit_price?: number;
  requires_shipping?: boolean;
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Empacotamento: soma peso real (com fallback por item) e subtotal. */
export function packCart(items: Item[], defaultItemWeight: number) {
  const shippable = items.filter((it) => it.requires_shipping !== false);
  const totalWeight = round2(
    shippable.reduce((acc, it) => acc + (it.weight_kg ?? defaultItemWeight) * it.quantity, 0),
  );
  const subtotal = round2(
    shippable.reduce((acc, it) => acc + (it.unit_price ?? 0) * it.quantity, 0),
  );
  return { shippable, totalWeight, subtotal };
}

/** Monta o payload Melhor Envio consolidado em UMA caixa. */
export function buildMelhorEnvioPayload(opts: {
  origin: string;
  destino: string;
  totalWeight: number;
  subtotal: number;
  boxW: number;
  boxH: number;
  boxL: number;
}) {
  return {
    from: { postal_code: opts.origin },
    to: { postal_code: opts.destino },
    products: [{
      id: 'cart-package',
      width: opts.boxW,
      height: opts.boxH,
      length: opts.boxL,
      weight: Math.max(0.1, opts.totalWeight),
      insurance_value: opts.subtotal,
      quantity: 1,
    }],
    options: { receipt: false, own_hand: false, insurance_value: opts.subtotal },
  };
}

/** Fallback estimado por faixa de CEP (proxy de região). */
export function quoteCorreiosEstimate(ctx: {
  totalWeight: number;
  destino: string;
  origin: string;
}): ShippingOption[] {
  const w = Math.max(0.1, ctx.totalWeight);
  const destPrefix = Number(ctx.destino.slice(0, 2));
  const originPrefix = Number(ctx.origin.slice(0, 2));
  const diff = Math.abs(destPrefix - originPrefix);
  let zoneFactor = 1.0;
  if (diff <= 3) zoneFactor = 0.85;
  else if (diff <= 15) zoneFactor = 1.0;
  else if (diff <= 35) zoneFactor = 1.25;
  else zoneFactor = 1.5;

  const pac = Math.min(60, Math.max(15, round2((18 + w * 6) * zoneFactor)));
  const sedex = Math.min(95, round2(pac * 1.6));
  return [
    { provider: 'Correios', service_name: 'PAC (estimado)', price: pac, estimated_delivery_days: '5-9' },
    { provider: 'Correios', service_name: 'SEDEX (estimado)', price: sedex, estimated_delivery_days: '2-4' },
  ];
}
