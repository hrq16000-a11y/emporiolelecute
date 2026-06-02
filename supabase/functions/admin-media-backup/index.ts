// ============= Edge Function: admin-media-backup =============
// Painel de backup/inventário de mídia (admin-only).
// Ações:
//  - "inventory": atualiza o catálogo central (media_assets) e devolve o resumo
//    (ativas/sem uso/ausentes) + lista de ausentes.
//  - "manifest": atualiza o inventário, carimba backed_up_at nas imagens ativas
//    (marca que o manifesto foi gerado) e devolve o manifesto completo com
//    img_ref + URL pública para download externo seguro.
//
// O img_ref é a referência estável e portável de cada imagem, independente do
// id interno do storage do Lovable.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // --- Auth: somente admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "inventory";

    // 1) Sempre atualiza o inventário central primeiro.
    const { data: summary, error: invErr } = await admin.rpc("rebuild_media_inventory_internal");
    if (invErr) throw new Error(`Falha ao atualizar inventário: ${invErr.message}`);

    // Lista de ausentes (sempre útil no painel).
    const { data: missing } = await admin
      .from("media_assets")
      .select("img_ref, bucket, storage_path, entity_type, field, public_url")
      .eq("status", "missing")
      .order("storage_path");

    if (action === "inventory") {
      return json({ ok: true, summary, missing: missing ?? [] });
    }

    if (action === "manifest") {
      // Carimba backed_up_at nas ativas (registro de que o manifesto foi gerado).
      const stampedAt = new Date().toISOString();
      await admin.from("media_assets").update({ backed_up_at: stampedAt }).eq("status", "active");

      const { data: assets, error: aErr } = await admin
        .from("media_assets")
        .select("img_ref, bucket, storage_path, public_url, content_type, size_bytes, checksum_sha256, entity_type, entity_id, field, status, backed_up_at")
        .order("storage_path");
      if (aErr) throw new Error(aErr.message);

      const manifest = {
        generated_at: stampedAt,
        project_ref: SUPABASE_URL.replace("https://", "").split(".")[0],
        summary,
        note: "Backup keyed by img_ref. Baixe cada public_url e salve como files/<img_ref>.<ext>.",
        assets: assets ?? [],
      };
      return json({ ok: true, manifest });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin-media-backup] erro:", msg);
    return json({ ok: false, error: msg }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
