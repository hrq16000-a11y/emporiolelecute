// ============= Edge Function: media-backup-cron =============
// Auditoria periódica de mídia (executada por pg_cron).
//
// O que faz a cada execução:
//  1. Reconstrói o inventário central (media_assets) via RPC service_role.
//  2. Gera um "manifesto" (snapshot de todos os assets por img_ref) e grava
//     em media_audit_runs (histórico auditável + manifest.json reconstruível).
//  3. Carimba backed_up_at nas imagens ativas (registro de backup lógico).
//  4. Se houver imagens AUSENTES (missing > 0), envia ALERTA por e-mail aos
//     administradores ANTES que o garbage collector rode — fechando a janela
//     que causou a perda de imagens em jun/2026.
//
// Segurança: endpoint público (chamado pelo cron), mas não expõe dados nem
// deleta nada. Apenas inventaria, registra e alerta.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "Empório LeleCute <onboarding@resend.dev>";
const BATCH_SIZE = 50;

interface MissingAsset {
  img_ref: string;
  storage_path: string;
  entity_type: string | null;
  field: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  // Origem da execução: "cron" (pg_cron) ou "manual" (botão admin).
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const source = typeof body?.source === "string" ? (body.source as string) : "cron";

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1) Inventário central
    const { data: summary, error: invErr } = await admin.rpc("rebuild_media_inventory_internal");
    if (invErr) throw new Error(`inventário: ${invErr.message}`);
    const s = (summary ?? {}) as Record<string, number>;


    // 2) Manifesto completo (por img_ref) + lista de ausentes
    const { data: assets } = await admin
      .from("media_assets")
      .select("img_ref, bucket, storage_path, public_url, content_type, size_bytes, checksum_sha256, entity_type, entity_id, field, status")
      .order("storage_path");

    const missing: MissingAsset[] = (assets ?? [])
      .filter((a) => a.status === "missing")
      .map((a) => ({ img_ref: a.img_ref, storage_path: a.storage_path, entity_type: a.entity_type, field: a.field }));

    const stampedAt = new Date().toISOString();
    const manifest = {
      generated_at: stampedAt,
      project_ref: SUPABASE_URL.replace("https://", "").split(".")[0],
      summary: s,
      note: "Backup keyed by img_ref. Baixe cada public_url e salve como files/<img_ref>.<ext>.",
      assets: assets ?? [],
    };

    // 3) Carimba backed_up_at nas ativas (backup lógico registrado)
    await admin.from("media_assets").update({ backed_up_at: stampedAt }).eq("status", "active");

    const missingCount = missing.length;
    let alerted = false;
    let emailResult: unknown = { skipped: true };

    // 4) Alerta por e-mail se houver imagens ausentes
    if (missingCount > 0) {
      emailResult = await sendMissingAlert(admin, missing, s, LOVABLE_API_KEY, RESEND_API_KEY);
      alerted = (emailResult as { sent?: number })?.sent ? true : false;
    }

    // Registra a auditoria
    await admin.from("media_audit_runs").insert({
      ran_at: stampedAt,
      total: s.total ?? 0,
      active: s.active ?? 0,
      archived: s.archived ?? 0,
      missing: missingCount,
      missing_refs: missing,
      manifest,
      alerted,
      source: "cron",
    });

    return json({ ok: true, summary: s, missing: missingCount, alerted, email: emailResult });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[media-backup-cron] erro:", msg);
    return json({ ok: false, error: msg }, 500);
  }
});

async function sendMissingAlert(
  admin: ReturnType<typeof createClient>,
  missing: MissingAsset[],
  summary: Record<string, number>,
  lovableKey?: string,
  resendKey?: string,
): Promise<unknown> {
  if (!lovableKey || !resendKey) {
    console.warn("[media-backup-cron] Resend env ausente; pulando alerta.");
    return { skipped: true, reason: "no_resend" };
  }

  // Resolve e-mails de admin (user_roles -> profiles.email)
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
  if (ids.length === 0) return { skipped: true, reason: "no_admins" };

  const emails: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: profs } = await admin.from("profiles").select("email").in("id", ids.slice(i, i + 200));
    for (const p of profs ?? []) if (p?.email) emails.push(p.email as string);
  }
  if (emails.length === 0) return { skipped: true, reason: "no_admin_emails" };

  const rows = missing
    .slice(0, 50)
    .map(
      (m) =>
        `<li><code>${escapeHtml(m.storage_path)}</code> — ${escapeHtml(m.entity_type ?? "?")} · ${escapeHtml(m.field ?? "?")}</li>`,
    )
    .join("");

  const subject = `[ALERTA] ${missing.length} imagem(ns) ausente(s) — Empório LeleCute`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px 0;font-size:18px">Imagens ausentes detectadas</h2>
      <p style="margin:0 0 8px 0">A auditoria automática de mídia encontrou
        <strong>${missing.length}</strong> imagem(ns) referenciada(s) no banco mas
        <strong>ausente(s)</strong> no armazenamento.</p>
      <p style="margin:0 0 8px 0;font-size:13px;color:#444">
        Total catalogado: ${summary.total ?? 0} · Ativas: ${summary.active ?? 0} ·
        Sem uso: ${summary.archived ?? 0} · Ausentes: ${summary.missing ?? 0}
      </p>
      <ul style="margin:12px 0 16px 16px;padding:0;font-size:13px">${rows}</ul>
      <p style="margin:0 0 20px 0">Revise e restaure no painel:</p>
      <p style="margin:0 0 24px 0">
        <a href="https://emporiolelecute.com.br/admin/media-backup"
           style="background:#e85d3a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">
          Abrir Backup de Mídia
        </a>
      </p>
      <p style="font-size:12px;color:#666;margin-top:28px">
        Alerta gerado antes da limpeza automática para evitar perda definitiva.
      </p>
    </div>`;

  let sent = 0;
  const errors: string[] = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const slice = emails.slice(i, i + BATCH_SIZE);
    const batch = slice.map((to) => ({ from: FROM_ADDRESS, to: [to], subject, html }));
    const res = await fetch(`${RESEND_GATEWAY}/emails/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      errors.push(`batch ${i / BATCH_SIZE} -> ${res.status}: ${text.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    sent += slice.length;
  }
  return { sent, admin_count: emails.length, errors };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
