// Mercado Pago Webhook — atualiza orders.payment_status / payment_id / paid_at
// Configure no MP: webhook URL apontando para esta função.
// Secrets necessários: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET (recomendado)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function mapStatus(mp: string): 'pending' | 'approved' | 'refunded' | 'cancelled' {
  switch (mp) {
    case 'approved':
    case 'authorized':
      return 'approved';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    case 'cancelled':
    case 'rejected':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

async function verifyMpSignature(req: Request, url: URL, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  if (!secret) {
    // Sem secret configurado: rejeita por segurança (evita forjar webhooks).
    console.warn('[mp-webhook] MERCADOPAGO_WEBHOOK_SECRET not set — rejecting unverified request');
    return false;
  }
  const xSig = req.headers.get('x-signature') ?? '';
  const xReqId = req.headers.get('x-request-id') ?? '';
  if (!xSig || !dataId) return false;

  const parts = Object.fromEntries(
    xSig.split(',').map((p) => {
      const [k, ...rest] = p.trim().split('=');
      return [k, rest.join('=')];
    }),
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xReqId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  try {
    return await crypto.subtle.verify('HMAC', key, hexToBytes(v1), new TextEncoder().encode(manifest));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get('type') || url.searchParams.get('topic') || '';
    const queryId = url.searchParams.get('id') || url.searchParams.get('data.id') || '';

    let body: any = {};
    try { body = await req.json(); } catch { /* MP às vezes envia GET-style */ }

    console.log('[mp-webhook] received', { topic, queryId });

    const paymentId: string | undefined = body?.data?.id ?? queryId;
    const eventType: string = body?.type ?? topic;

    if (!paymentId || (eventType && !eventType.includes('payment'))) {
      return json({ ignored: true, reason: 'not_a_payment_event', topic: eventType });
    }

    // --- Signature verification (HMAC) ---
    const sigOk = await verifyMpSignature(req, url, String(paymentId));
    if (!sigOk) {
      console.error('[mp-webhook] invalid_signature');
      return json({ error: 'Invalid signature' }, 401);
    }

    const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!MP_TOKEN) {
      console.error('[mp-webhook] missing MERCADOPAGO_ACCESS_TOKEN');
      return json({ error: 'MP token not configured' }, 500);
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!mpRes.ok) {
      const text = await mpRes.text();
      console.error('[mp-webhook] failed to fetch payment', mpRes.status, text);
      return json({ error: 'Failed to fetch payment from MP', status: mpRes.status }, 502);
    }
    const payment = await mpRes.json();
    console.log('[mp-webhook] payment data', {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
    });

    const orderCode = String(payment.external_reference || '').trim().toUpperCase();
    if (!orderCode) {
      return json({ error: 'Payment has no external_reference (order_code)' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const newStatus = mapStatus(payment.status);
    const update: Record<string, unknown> = {
      payment_status: newStatus,
      payment_id: String(payment.id),
      payment_method: payment.payment_method_id || payment.payment_type_id || null,
    };
    if (newStatus === 'approved') {
      update.paid_at = payment.date_approved || new Date().toISOString();
      update.status = 'confirmed';
    } else if (newStatus === 'cancelled') {
      update.status = 'cancelled';
    }

    const { data, error } = await supabase
      .from('orders')
      .update(update)
      .eq('order_code', orderCode)
      .select('id, order_code, payment_status')
      .maybeSingle();

    if (error) {
      console.error('[mp-webhook] db update error', error);
      return json({ error: error.message }, 500);
    }
    if (!data) {
      console.warn('[mp-webhook] order not found for code', orderCode);
      return json({ error: 'Order not found', order_code: orderCode }, 404);
    }

    return json({ success: true, order: data, mp_status: payment.status, applied: newStatus });
  } catch (err) {
    console.error('[mp-webhook] unexpected', err);
    return json({ error: 'Internal error' }, 500);
  }
});
