// Edge Function: calculate-shipping
// Lê configurações, provedores e regras 100% do banco (shipping_settings,
// shipping_providers, shipping_rules). Loga falhas em shipping_audit_logs.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { packCart, buildMelhorEnvioPayload, quoteCorreiosEstimate, round2 } from './lib.ts';

const TIMEOUT_MS = 5000;

const ItemSchema = z.object({
  product_id: z.string().optional(),
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(500),
  weight_kg: z.number().nonnegative().max(30).optional(),
  width: z.number().positive().max(200).optional(),
  height: z.number().positive().max(200).optional(),
  length: z.number().positive().max(200).optional(),
  unit_price: z.number().nonnegative().optional(),
  requires_shipping: z.boolean().optional(),
});

const BodySchema = z.object({
  cep_destino: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP de destino inválido'),
  state: z.string().length(2).optional(),
  items: z.array(ItemSchema).min(1).max(100),
});

type ShippingOption = {
  provider: string;
  service_name: string;
  price: number;
  estimated_delivery_days: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { cep_destino, items, state } = parsed.data;
    const destino = cep_destino.replace(/\D/g, '');

    // Carrega configurações do banco
    const [{ data: settings }, { data: providers }, { data: rules }] = await Promise.all([
      sb.from('shipping_settings').select('*').limit(1).maybeSingle(),
      sb.from('shipping_providers').select('*').eq('is_active', true),
      sb.from('shipping_rules').select('*').eq('is_active', true).order('priority', { ascending: false }),
    ]);

    if (!settings || !settings.origin_zip_code) {
      return json({ error: 'CEP de origem não configurado' }, 422);
    }
    if (settings.is_enabled === false) {
      return json({ error: 'Cálculo de frete temporariamente desabilitado', disabled: true }, 503);
    }
    const ORIGIN_CEP = String(settings.origin_zip_code).replace(/\D/g, '');
    if (ORIGIN_CEP.length !== 8) return json({ error: 'CEP de origem inválido' }, 422);

    // Empacotamento (lib) + filtro de itens que exigem frete
    const defaultItemWeight = Number(settings.default_box_weight_kg) || 0.3;
    const { shippable, totalWeight, subtotal } = packCart(items as any, defaultItemWeight);
    if (shippable.length === 0) {
      return json({ options: [{ provider: 'Digital', service_name: 'Sem envio', price: 0, estimated_delivery_days: '0' }] });
    }

    // Diagnóstico: token Melhor Envio configurado?
    const meProvider = (providers ?? []).find((p: any) => p.provider_code === 'melhor_envio');
    const meHasKey = !!meProvider?.api_key && !!meProvider?.endpoint_url;
    console.log('[calculate-shipping]', {
      destino, totalWeight, subtotal, items_count: shippable.length,
      melhor_envio_active: !!meProvider,
      melhor_envio_has_key: meHasKey,
    });

    // Alerta de credenciais ausentes (provedor ativo, mas sem token)
    if (meProvider && !meHasKey) {
      await sb.from('shipping_audit_logs').insert({
        event_type: 'missing_credentials',
        destination_zip: destino,
        provider_name: meProvider.provider_name,
        error_message: 'Provedor ativo sem api_key/endpoint_url configurados',
        total_weight_kg: totalWeight,
        melhor_envio_has_key: false,
      });
    }

    // Entrega local: mesmo CEP
    if (destino === ORIGIN_CEP) {
      return json({
        local_delivery: true,
        options: applyRules([
          { provider: 'Empório LeleCute', service_name: 'Retirada / Entrega local', price: 0, estimated_delivery_days: '1-2' },
        ], { subtotal, state, destino }, rules ?? []),
      });
    }

    // Coleta cotações de todos os provedores ativos em paralelo
    const quotes = await Promise.all(
      (providers ?? []).map((p) => quoteProvider(p, { origin: ORIGIN_CEP, destino, items: shippable, totalWeight, subtotal, settings, sb })),
    );
    let options: ShippingOption[] = quotes.flat();
    let estimated = false;

    // Fallback: se nenhum provedor real retornou, usa estimativa por região
    if (options.length === 0) {
      estimated = true;
      options = quoteCorreiosEstimate({ totalWeight, destino, origin: ORIGIN_CEP });
      await sb.from('shipping_audit_logs').insert({
        event_type: 'estimate_fallback',
        destination_zip: destino,
        cart_snapshot: { items: shippable, subtotal },
        provider_name: meProvider?.provider_name ?? null,
        error_message: meHasKey
          ? 'Provedores ativos não retornaram cotação — usando estimativa'
          : 'Token Melhor Envio ausente — usando estimativa',
        total_weight_kg: totalWeight,
        melhor_envio_has_key: meHasKey,
        estimated: true,
      });
    }

    // Markup + handling (não aplicar em frete grátis)
    const markup = Number(settings.shipping_markup_percentage) || 0;
    const fee = Number(settings.handling_fee) || 0;
    options = options.map((o) => ({
      ...o,
      price: o.price === 0 ? 0 : round2(o.price * (1 + markup / 100) + fee),
    }));

    // Aplica regras
    options = applyRules(options, { subtotal, state, destino }, rules ?? []);

    options.sort((a, b) => a.price - b.price);

    if (options.length === 0) {
      return json({ error: 'Não foi possível calcular o frete para este CEP.' }, 422);
    }
    return json({ options, estimated, melhor_envio_has_key: meHasKey });
  } catch (err) {
    console.error('[calculate-shipping] unexpected', err);
    return json({ error: 'Erro interno', message: String(err) }, 500);
  }
});

// --- Provedores ---
async function quoteProvider(p: any, ctx: any): Promise<ShippingOption[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      if (p.provider_code === 'melhor_envio') {
        return await quoteMelhorEnvio(p, ctx, ctrl.signal);
      }
      // 'correios_estimate' é fallback, tratado fora do loop
      return [];
    } finally {
      clearTimeout(t);
    }
  } catch (err: any) {
    console.error('[calculate-shipping] provider error', p.provider_name, err?.message);
    await ctx.sb.from('shipping_audit_logs').insert({
      event_type: 'provider_error',
      destination_zip: ctx.destino,
      cart_snapshot: { items: ctx.items },
      provider_name: p.provider_name,
      error_message: String(err?.message ?? err),
      http_status: err?.status ?? null,
      total_weight_kg: ctx.totalWeight,
      melhor_envio_has_key: !!p.api_key,
    });
    return [];
  }
}

async function quoteMelhorEnvio(p: any, ctx: any, signal: AbortSignal): Promise<ShippingOption[]> {
  if (!p.api_key || !p.endpoint_url) throw new Error('Credenciais Melhor Envio ausentes');

  // EMPACOTAMENTO consolidado em 1 caixa (lib).
  const payload = buildMelhorEnvioPayload({
    origin: ctx.origin,
    destino: ctx.destino,
    totalWeight: ctx.totalWeight,
    subtotal: ctx.subtotal,
    boxW: Number(ctx.settings.default_box_width_cm) || 16,
    boxH: Number(ctx.settings.default_box_height_cm) || 11,
    boxL: Number(ctx.settings.default_box_length_cm) || 20,
  });

  const res = await fetch(p.endpoint_url, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.api_key}`,
      'User-Agent': 'EmporioLeleCute (contato@emporiolelecute.com.br)',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    const e: any = new Error(text.slice(0, 400)); e.status = res.status; throw e;
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .filter((o: any) => !o.error && o.price)
    .map((o: any) => ({
      provider: o.company?.name ?? 'Melhor Envio',
      service_name: o.name,
      price: Number(o.price),
      estimated_delivery_days: `${o.delivery_range?.min ?? '?'}-${o.delivery_range?.max ?? '?'}`,
    }));
}

// (quoteCorreiosEstimate movido para ./lib.ts)



// --- Regras ---
function applyRules(opts: ShippingOption[], ctx: { subtotal: number; state?: string; destino: string }, rules: any[]): ShippingOption[] {
  let result = [...opts];
  for (const r of rules) {
    if (!matchesCondition(r, ctx)) continue;
    if (r.discount_type === 'free_shipping') {
      result.sort((a, b) => a.price - b.price);
      if (result[0]) result[0] = { ...result[0], price: 0, service_name: result[0].service_name + ' (Frete Grátis)' };
    } else if (r.discount_type === 'fixed_discount') {
      const v = Number(r.discount_value) || 0;
      result = result.map((o) => ({ ...o, price: Math.max(0, round2(o.price - v)) }));
    } else if (r.discount_type === 'percentage_discount') {
      const v = Number(r.discount_value) || 0;
      result = result.map((o) => ({ ...o, price: round2(o.price * (1 - v / 100)) }));
    }
  }
  return result;
}

function matchesCondition(r: any, ctx: { subtotal: number; state?: string; destino: string }): boolean {
  const cv = r.condition_value ?? {};
  if (r.condition_type === 'min_cart_value') {
    return ctx.subtotal >= Number(cv.value ?? 0);
  }
  if (r.condition_type === 'specific_state') {
    const states: string[] = Array.isArray(cv.states) ? cv.states : (cv.state ? [cv.state] : []);
    return !!ctx.state && states.map((s) => s.toUpperCase()).includes(ctx.state.toUpperCase());
  }
  if (r.condition_type === 'zip_code_range') {
    const from = String(cv.from ?? '').replace(/\D/g, '');
    const to = String(cv.to ?? '').replace(/\D/g, '');
    if (!from || !to) return false;
    return ctx.destino >= from && ctx.destino <= to;
  }
  return false;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

