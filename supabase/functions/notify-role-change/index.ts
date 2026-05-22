// Edge Function: notify-role-change
// Triggered by trg_user_roles_notify whenever a user receives a new role.
// Security: validates that the supplied (user_id, role) actually exists in user_roles
// (or that the user has access_requested=true for 'access_requested' events) before
// sending any email. This prevents arbitrary phishing via this endpoint.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Payload {
  user_id?: string;
  email?: string;
  role?: string;
  event?: string;
}

const log = (
  level: 'info' | 'warn' | 'error',
  request_id: string,
  msg: string,
  extra: Record<string, unknown> = {},
) => {
  const entry = { ts: new Date().toISOString(), level, request_id, fn: 'notify-role-change', msg, ...extra };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const request_id = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const started = performance.now();

  try {
    const body = (await req.json().catch(() => ({}))) as Payload;
    const { email, role, event, user_id } = body;
    log('info', request_id, 'invoked', { event, role, user_id });

    if (!user_id || !event) {
      log('warn', request_id, 'missing_fields');
      return new Response(JSON.stringify({ error: 'Missing user_id or event', request_id }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
      });
    }

    // --- Server-side validation against DB (anti-phishing) ---
    // Always look up the canonical email from auth/profiles using service role,
    // and verify the claimed role/event matches DB state. The caller-supplied
    // `email` is IGNORED to prevent arbitrary recipients.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve the true email for this user_id
    const { data: userRow, error: userErr } = await supabase.auth.admin.getUserById(user_id);
    if (userErr || !userRow?.user?.email) {
      log('warn', request_id, 'user_not_found', { user_id });
      return new Response(JSON.stringify({ ok: false, error: 'unknown_user', request_id }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
      });
    }
    const canonicalEmail = userRow.user.email;

    // Event-specific verification
    if (event === 'access_requested') {
      const { data: prof } = await supabase
        .from('profiles')
        .select('access_requested')
        .eq('id', user_id)
        .maybeSingle();
      if (!prof?.access_requested) {
        log('warn', request_id, 'access_request_not_pending', { user_id });
        return new Response(JSON.stringify({ ok: false, error: 'not_pending', request_id }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
        });
      }
    } else {
      // For role-grant events, verify the role actually exists in user_roles
      if (!role) {
        return new Response(JSON.stringify({ error: 'Missing role', request_id }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
        });
      }
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user_id)
        .eq('role', role)
        .maybeSingle();
      if (!roleRow) {
        log('warn', request_id, 'role_not_granted', { user_id, role });
        return new Response(JSON.stringify({ ok: false, error: 'role_not_granted', request_id }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
        });
      }
    }

    // Warn (don't fail) if caller-supplied email mismatches the canonical one.
    if (email && email.toLowerCase() !== canonicalEmail.toLowerCase()) {
      log('warn', request_id, 'email_mismatch_overridden', { supplied: email });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM = Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'Empório LeleCute <noreply@emporiolelecute.com.br>';

    const subject = role ? `Sua conta agora tem permissão: ${role}` : 'Atualização de acesso';
    const safeRole = (role ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeEvent = (event ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color:#c2956b;">Acesso liberado</h2>
        <p>Olá,</p>
        <p>Sua conta <strong>${canonicalEmail}</strong> recebeu a permissão <strong>${safeRole}</strong> no painel administrativo do Empório LeleCute.</p>
        <p><a href="https://emporiolelecute.com.br/admin" style="background:#c2956b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Abrir painel</a></p>
        <p style="font-size:12px;color:#888;">Evento: ${safeEvent} · ref: ${request_id}</p>
      </div>
    `;

    if (!RESEND_API_KEY) {
      log('warn', request_id, 'resend_key_missing_skipping_send');
      return new Response(JSON.stringify({ ok: true, skipped: true, request_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Request-Id': request_id,
      },
      body: JSON.stringify({ from: FROM, to: canonicalEmail, subject, html }),
    });

    const data = await res.json().catch(() => ({}));
    const elapsed_ms = Math.round(performance.now() - started);

    if (!res.ok) {
      log('error', request_id, 'resend_error', { status: res.status, elapsed_ms });
      return new Response(JSON.stringify({ ok: false, error: 'send_failed', request_id }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
      });
    }

    log('info', request_id, 'email_sent', { resend_id: (data as any)?.id, elapsed_ms });

    return new Response(JSON.stringify({ ok: true, id: (data as any)?.id, request_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
    });
  } catch (e) {
    log('error', request_id, 'unhandled', { error: String(e) });
    return new Response(JSON.stringify({ error: 'Internal error', request_id }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': request_id },
    });
  }
});
