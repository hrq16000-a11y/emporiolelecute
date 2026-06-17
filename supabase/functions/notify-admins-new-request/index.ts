// notify-admins-new-request
// Triggered (best-effort) by a Postgres trigger when profiles.access_requested
// flips false -> true. Sends a single batched e-mail to all current admins
// via Resend (through the Lovable connector gateway).
//
// Failure modes are swallowed at the DB-trigger level (PERFORM net.http_post
// inside EXCEPTION WHEN OTHERS THEN NULL), so a 5xx here NEVER blocks the
// user's access request from being persisted.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
// Resend allows up to 100 recipients per batch entry and up to 100 entries
// per /emails/batch call. We keep it well under that to be safe.
const BATCH_SIZE = 50;
const FROM_ADDRESS = "Empório LeleCute <onboarding@resend.dev>";

interface Payload {
  user_id?: string;
  email?: string;
  requested_at?: string;
  source?: string;
  reason?: string | null;
  request_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Supabase env not configured");
    }

    // --- Authorization ---
    // Accept EITHER the internal shared secret sent by the DB trigger, OR a
    // valid admin JWT (manual resend from the admin panel). Reject all others
    // so this endpoint cannot be abused to spam admin inboxes.
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let authorized = false;

    const internalSecret = req.headers.get("x-internal-secret");
    if (internalSecret) {
      const { data: secretRow } = await svc
        .from("internal_function_secrets")
        .select("value")
        .eq("name", "notify_admins")
        .maybeSingle();
      if (secretRow?.value && timingSafeEqual(secretRow.value, internalSecret)) {
        authorized = true;
      }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authorized && authHeader?.startsWith("Bearer ")) {
      try {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const userClient = createClient(SUPABASE_URL, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const token = authHeader.replace("Bearer ", "");
        const { data: claims } = await userClient.auth.getClaims(token);
        const sub = claims?.claims?.sub as string | undefined;
        if (sub) {
          const { data: isAdmin } = await userClient.rpc("has_role", {
            _user_id: sub,
            _role: "admin",
          });
          if (isAdmin === true) authorized = true;
        }
      } catch (_) { /* fall through to 401 */ }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      // No mailer wired up — log and exit cleanly so the trigger doesn't loop.
      console.warn("[notify-admins-new-request] Resend env missing; skipping send.");
      return new Response(JSON.stringify({ skipped: true, reason: "no_resend" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const requesterEmail = body.email ?? "(desconhecido)";
    const requestedAt = body.requested_at
      ? new Date(body.requested_at).toLocaleString("pt-BR")
      : new Date().toLocaleString("pt-BR");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch admin user_ids
    const { data: adminRoles, error: rolesErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesErr) throw new Error(`user_roles: ${rolesErr.message}`);
    const adminIds = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_admins" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve admin e-mails (chunked to stay well below the IN-list limit)
    const adminEmails: string[] = [];
    for (let i = 0; i < adminIds.length; i += 200) {
      const slice = adminIds.slice(i, i + 200);
      const { data: profs, error: profErr } = await admin
        .from("profiles")
        .select("email")
        .in("id", slice);
      if (profErr) throw new Error(`profiles: ${profErr.message}`);
      for (const p of profs ?? []) {
        if (p?.email) adminEmails.push(p.email as string);
      }
    }

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_admin_emails" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reviewUrl = "https://emporiolelecute.com.br/admin/usuarios/solicitacoes";
    const subject = "[ALERTA] Nova solicitação de acesso administrativo";
    const html = `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111">
        <h2 style="margin:0 0 12px 0;font-size:18px">Nova solicitação de acesso administrativo</h2>
        <p style="margin:0 0 8px 0">Um usuário solicitou acesso ao painel:</p>
        <ul style="margin:0 0 16px 16px;padding:0">
          <li><strong>E-mail:</strong> ${escapeHtml(requesterEmail)}</li>
          <li><strong>Solicitado em:</strong> ${escapeHtml(requestedAt)}</li>
        </ul>
        <p style="margin:0 0 20px 0">Revise e aprove (ou reprove) a solicitação no painel:</p>
        <p style="margin:0 0 24px 0">
          <a href="${reviewUrl}" style="background:#e85d3a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">
            Abrir solicitações
          </a>
        </p>
        <p style="font-size:12px;color:#666;margin-top:28px">
          Você está recebendo esta mensagem porque é administrador do Empório LeleCute.
        </p>
      </div>
    `;

    // Send via Resend BATCH endpoint to avoid one HTTP roundtrip per admin.
    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < adminEmails.length; i += BATCH_SIZE) {
      const slice = adminEmails.slice(i, i + BATCH_SIZE);
      const batch = slice.map((to) => ({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
      }));

      const res = await fetch(`${RESEND_GATEWAY}/emails/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        errors.push(`batch ${i / BATCH_SIZE} -> ${res.status}: ${text.slice(0, 300)}`);
        // Soft backoff before next chunk to play nicely with Resend rate limits.
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      sent += slice.length;
    }

    // Log attempt (best-effort) for the admin audit screen
    try {
      await admin.from("access_request_notifications").insert({
        requester_id: body.user_id ?? null,
        requester_email: requesterEmail,
        requested_at: body.requested_at ?? null,
        admin_count: adminEmails.length,
        sent_count: sent,
        status: errors.length === 0 ? "sent" : (sent > 0 ? "partial" : "failed"),
        error_message: errors.length ? errors.join(" | ").slice(0, 2000) : null,
        details: {
          batch_size: BATCH_SIZE,
          errors,
          source: body.source ?? "trigger",
          reason: body.reason ? String(body.reason).slice(0, 500) : null,
          request_id: body.request_id ?? null,
        },
      });
    } catch (logErr) {
      console.warn("[notify-admins-new-request] failed to write audit log", logErr);
    }

    return new Response(
      JSON.stringify({
        ok: errors.length === 0,
        sent,
        admin_count: adminEmails.length,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify-admins-new-request] error", e);
    // Best-effort error log — uses a fresh service-role client to avoid scope issues.
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SERVICE_ROLE) {
        const adminLog = createClient(SUPABASE_URL, SERVICE_ROLE, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await adminLog.from("access_request_notifications").insert({
          status: "failed",
          error_message: (e instanceof Error ? e.message : String(e)).slice(0, 2000),
          details: {},
        });
      }
    } catch (_) { /* swallow */ }
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Constant-time string comparison to avoid leaking the secret via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
