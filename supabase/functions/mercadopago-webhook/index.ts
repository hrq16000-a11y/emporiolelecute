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

// Ranking de status: impede regressão (ex.: approved -> pending por evento atrasado)
const RANK: Record<string, number> = { pending: 0, cancelled: 1, approved: 2, refunded: 3 };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Log estruturado e idempotente de cada evento recebido.
  const logEvent = async (row: Record<string, unknown>) => {
    try {
      await supabase.from('payment_events').insert({
        provider: 'mercadopago',
        duration_ms: Date.now() - startedAt,
        ...row,
      });
    } catch (e) {
      console.error('[mp-webhook] failed to log payment_event', e);
    }
  };

  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get('type') || url.searchParams.get('topic') || '';
    const queryId = url.searchParams.get('id') || url.searchParams.get('data.id') || '';

    let body: any = {};
    try { body = await req.json(); } catch { /* MP às vezes envia GET-style */ }

    console.log('[mp-webhook] received', { topic, queryId });

    const paymentId: string | undefined = body?.data?.id ?? queryId;
    const eventType: string = body?.type ?? topic;
    const eventId: string = String(body?.id ?? req.headers.get('x-request-id') ?? '');

    if (!paymentId || (eventType && !eventType.includes('payment'))) {
      return json({ ignored: true, reason: 'not_a_payment_event', topic: eventType });
    }

    // --- Signature verification (HMAC) ---
    const sigOk = await verifyMpSignature(req, url, String(paymentId));
    if (!sigOk) {
      console.error('[mp-webhook] invalid_signature');
      await logEvent({
        payment_id: String(paymentId),
        event_id: eventId,
        result: 'invalid_signature',
        error_message: 'HMAC verification failed',
      });
      return json({ error: 'Invalid signature' }, 401);
    }

    const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!MP_TOKEN) {
      console.error('[mp-webhook] missing MERCADOPAGO_ACCESS_TOKEN');
      await logEvent({ payment_id: String(paymentId), event_id: eventId, result: 'error', error_message: 'MP token not configured' });
      return json({ error: 'MP token not configured' }, 500);
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!mpRes.ok) {
      const text = await mpRes.text();
      console.error('[mp-webhook] failed to fetch payment', mpRes.status, text);
      await logEvent({
        payment_id: String(paymentId),
        event_id: eventId,
        result: 'provider_error',
        error_message: `MP ${mpRes.status}`,
      });
      // 5xx faz o MP reenviar o evento — processamento é reprocessável.
      return json({ error: 'Failed to fetch payment from MP', status: mpRes.status }, 502);
    }
    const payment = await mpRes.json();
    console.log('[mp-webhook] payment data', {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
    });

    const orderCode = String(payment.external_reference || '').trim().toUpperCase();
    const newStatus = mapStatus(payment.status);

    if (!orderCode) {
      await logEvent({
        payment_id: String(payment.id),
        event_id: eventId,
        provider_status: payment.status,
        result: 'error',
        error_message: 'missing external_reference',
        raw: payment,
      });
      return json({ error: 'Payment has no external_reference (order_code)' }, 400);
    }

    // --- Idempotência: mesmo pagamento + mesmo status já aplicado = no-op ---
    const { data: already } = await supabase
      .from('payment_events')
      .select('id')
      .eq('provider', 'mercadopago')
      .eq('payment_id', String(payment.id))
      .eq('provider_status', String(payment.status))
      .eq('result', 'applied')
      .maybeSingle();

    if (already) {
      console.log('[mp-webhook] duplicate event ignored', payment.id, payment.status);
      await logEvent({
        payment_id: String(payment.id),
        event_id: eventId,
        order_code: orderCode,
        provider_status: payment.status,
        applied_status: newStatus,
        result: 'duplicate',
      });
      return json({ success: true, duplicate: true, order_code: orderCode });
    }

    const { data: current, error: fetchErr } = await supabase
      .from('orders')
      .select('id, order_code, payment_status, status')
      .eq('order_code', orderCode)
      .maybeSingle();

    if (fetchErr) {
      await logEvent({ payment_id: String(payment.id), event_id: eventId, order_code: orderCode, provider_status: payment.status, result: 'error', error_message: fetchErr.message });
      return json({ error: fetchErr.message }, 500);
    }
    if (!current) {
      console.warn('[mp-webhook] order not found for code', orderCode);
      await logEvent({ payment_id: String(payment.id), event_id: eventId, order_code: orderCode, provider_status: payment.status, result: 'order_not_found' });
      return json({ error: 'Order not found', order_code: orderCode }, 404);
    }

    // Nunca regride um pedido já aprovado por causa de evento fora de ordem.
    const currentRank = RANK[String(current.payment_status ?? 'pending')] ?? 0;
    if ((RANK[newStatus] ?? 0) < currentRank) {
      await logEvent({
        payment_id: String(payment.id),
        event_id: eventId,
        order_code: orderCode,
        provider_status: payment.status,
        applied_status: String(current.payment_status),
        result: 'stale_ignored',
      });
      return json({ success: true, stale: true, kept: current.payment_status });
    }

    const update: Record<string, unknown> = {
      payment_status: newStatus,
      payment_id: String(payment.id),
      payment_method: payment.payment_method_id || payment.payment_type_id || null,
    };
    // O pedido só é confirmado quando o provedor aprova o pagamento.
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
      await logEvent({ payment_id: String(payment.id), event_id: eventId, order_code: orderCode, provider_status: payment.status, applied_status: newStatus, result: 'error', error_message: error.message });
      return json({ error: error.message }, 500);
    }

    await logEvent({
      payment_id: String(payment.id),
      event_id: eventId,
      order_code: orderCode,
      provider_status: payment.status,
      applied_status: newStatus,
      result: 'applied',
      raw: { id: payment.id, status: payment.status, status_detail: payment.status_detail, transaction_amount: payment.transaction_amount },
    });

    return json({ success: true, order: data, mp_status: payment.status, applied: newStatus });
  } catch (err) {
    console.error('[mp-webhook] unexpected', err);
    await logEvent({ result: 'error', error_message: String((err as Error)?.message ?? err) });
    return json({ error: 'Internal error' }, 500);
  }
});

