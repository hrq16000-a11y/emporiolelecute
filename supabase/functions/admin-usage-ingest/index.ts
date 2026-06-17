// Admin Usage Ingest — optional aggregated telemetry collector (P2.4).
// Privacy: only accepts pre-aggregated counters; rejects raw events.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface IngestBody {
  sessionId?: string;
  version?: string;
  clientTs?: number;
  totalEvents?: number;
  aggregates?: Record<string, unknown>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Require an authenticated admin — this endpoint only collects admin-panel
  // telemetry, so anonymous callers must never be able to write here.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  let callerId: string | null = null;
  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await userClient.auth.getClaims(token);
    callerId = (claims?.claims?.sub as string) ?? null;
    if (!callerId) throw new Error('no_sub');
    const { data: isAdmin, error: roleErr } = await userClient.rpc('has_role', {
      _user_id: callerId,
      _role: 'admin',
    });
    if (roleErr || isAdmin !== true) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Defensive validation — refuse anything that looks like raw events.
  if (!isPlainObject(body) || !isPlainObject(body.aggregates)) {
    return new Response(JSON.stringify({ error: 'invalid_payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // Hard cap payload size (anti-abuse).
  const serialized = JSON.stringify(body.aggregates);
  if (serialized.length > 64_000) {
    return new Response(JSON.stringify({ error: 'payload_too_large' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = String(body.sessionId ?? '').slice(0, 64) || 'anon';
  const version = String(body.version ?? 'p2.4').slice(0, 16);
  const totalEvents = Math.max(0, Math.min(Number(body.totalEvents ?? 0) | 0, 1_000_000));
  const clientTs = Number(body.clientTs ?? Date.now());
  const clientTsISO = new Date(isFinite(clientTs) ? clientTs : Date.now()).toISOString();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { error } = await supabase.from('admin_usage_aggregates').insert({
      session_id: sessionId,
      version,
      client_ts: clientTsISO,
      total_events: totalEvents,
      payload: body.aggregates,
    });
    if (error) {
      return new Response(JSON.stringify({ error: 'persist_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'persist_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
