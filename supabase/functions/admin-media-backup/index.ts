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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      // IMPORTANTE: o manifesto é apenas metadados (não contém binários).
      // NÃO carimba backed_up_at — backup só é real após o export físico
      // validado (action "confirm_backup"). Isso elimina o falso positivo.
      const stampedAt = new Date().toISOString();

      const { data: assets, error: aErr } = await admin
        .from("media_assets")
        .select("img_ref, bucket, storage_path, public_url, content_type, size_bytes, checksum_sha256, entity_type, entity_id, field, status, backed_up_at")
        .order("storage_path");
      if (aErr) throw new Error(aErr.message);

      const manifest = {
        generated_at: stampedAt,
        project_ref: SUPABASE_URL.replace("https://", "").split(".")[0],
        summary,
        note: "METADADOS apenas (sem binários). Use o export físico (ZIP) para um backup restaurável.",
        assets: assets ?? [],
      };
      return json({ ok: true, manifest });
    }

    if (action === "export_manifest") {
      // Lista os assets que possuem binário físico no storage (active + archived),
      // para o export completo (ZIP) montado no painel admin.
      const { data: assets, error: aErr } = await admin
        .from("media_assets")
        .select("img_ref, bucket, storage_path, public_url, content_type, size_bytes, checksum_sha256, entity_type, entity_id, field, status")
        .in("status", ["active", "archived"])
        .order("storage_path");
      if (aErr) throw new Error(aErr.message);
      return json({ ok: true, summary, assets: assets ?? [] });
    }

    if (action === "confirm_backup") {
      // Persiste evidência de backup VALIDADO após o export físico do painel.
      // - Grava checksum_sha256 + size_bytes de cada binário efetivamente exportado.
      // - backed_up_at SOMENTE quando o backup inteiro foi concluído (runComplete).
      // - Registra a execução em media_backup_runs (evidência de DR).
      const items: Array<{ img_ref: string; sha256?: string; size_bytes?: number }> =
        Array.isArray(body.assets) ? body.assets : [];
      const runComplete = body.runComplete === true;
      const totalAssets = Number(body.total_assets ?? 0);
      const bytesTotal = Number(body.bytes_total ?? 0);
      const notes = typeof body.notes === "string" ? body.notes : null;

      let verified = 0;
      const stampedAt = new Date().toISOString();
      for (const it of items) {
        if (!it.img_ref || !it.sha256) continue;
        const patch: Record<string, unknown> = {
          checksum_sha256: it.sha256,
          updated_at: stampedAt,
        };
        if (typeof it.size_bytes === "number" && it.size_bytes > 0) patch.size_bytes = it.size_bytes;
        if (runComplete) patch.backed_up_at = stampedAt;
        const { error: upErr } = await admin
          .from("media_assets")
          .update(patch)
          .eq("img_ref", it.img_ref);
        if (!upErr) verified++;
      }

      const exportedCount = items.length;
      const coverage = totalAssets > 0 ? Math.round((verified / totalAssets) * 10000) / 100 : 0;
      const status = runComplete && totalAssets > 0 && verified >= totalAssets ? "complete" : "partial";

      const { data: run } = await admin
        .from("media_backup_runs")
        .insert({
          ran_at: stampedAt,
          total_assets: totalAssets,
          exported_count: exportedCount,
          verified_count: verified,
          coverage_pct: coverage,
          bytes_total: bytesTotal,
          status,
          notes,
          created_by: userId,
        })
        .select()
        .maybeSingle();

      return json({ ok: true, run, verified, status, coverage });
    }

    if (action === "coverage") {
      // Painel de cobertura: catalogados x exportados x integridade validada.
      const { data: assets } = await admin
        .from("media_assets")
        .select("img_ref, storage_path, status, checksum_sha256, backed_up_at, size_bytes")
        .in("status", ["active", "archived"]);
      const list = assets ?? [];
      const cataloged = list.length;
      const exported = list.filter((a) => a.backed_up_at).length;
      const withChecksum = list.filter((a) => a.checksum_sha256).length;
      const coverage = cataloged > 0 ? Math.round((exported / cataloged) * 10000) / 100 : 0;
      const missingItems = list
        .filter((a) => !a.backed_up_at)
        .map((a) => ({
          img_ref: a.img_ref,
          storage_path: a.storage_path,
          status: a.status,
          has_checksum: !!a.checksum_sha256,
        }));

      const { data: lastRun } = await admin
        .from("media_backup_runs")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({
        ok: true,
        coverage: {
          cataloged,
          exported,
          with_checksum: withChecksum,
          coverage_pct: coverage,
          missing_count: missingItems.length,
          last_run: lastRun ?? null,
        },
        missing_items: missingItems.slice(0, 500),
      });
    }

    if (action === "relink") {
      // Reescreve as URLs das entidades a partir do catálogo (img_ref),
      // somente para assets 'active'. Aceita lista opcional de img_refs.
      const imgRefs: string[] | null = Array.isArray(body.img_refs) && body.img_refs.length
        ? (body.img_refs as string[])
        : null;
      const { data: relink, error: relinkErr } = await admin.rpc("media_relink_references", {
        _img_refs: imgRefs,
      });
      if (relinkErr) throw new Error(`relink: ${relinkErr.message}`);
      // Atualiza inventário após reescrever as URLs.
      await admin.rpc("rebuild_media_inventory_internal");
      return json({ ok: true, relink });
    }

    if (action === "relink_preview") {
      // Pré-visualização (read-only): mostra quais linhas seriam atualizadas
      // por media_relink_references para os img_refs informados (ou todos ativos).
      const imgRefs: string[] | null = Array.isArray(body.img_refs) && body.img_refs.length
        ? (body.img_refs as string[])
        : null;

      let assetsQ = admin
        .from("media_assets")
        .select("img_ref, public_url, entity_type, entity_id, field, status")
        .eq("status", "active");
      if (imgRefs) assetsQ = assetsQ.in("img_ref", imgRefs);
      const { data: assets, error: aErr } = await assetsQ;
      if (aErr) throw new Error(aErr.message);

      // entity_type+field -> { table, column }
      const MAP: Record<string, { table: string; column: string }> = {
        "occasion::image_url": { table: "occasions", column: "image_url" },
        "hero_slide::image_url": { table: "hero_slides", column: "image_url" },
        "hero_slide::image_desktop_url": { table: "hero_slides", column: "image_desktop_url" },
        "hero_slide::image_mobile_url": { table: "hero_slides", column: "image_mobile_url" },
        "category::image_url": { table: "categories", column: "image_url" },
        "kit::image_url": { table: "kits", column: "image_url" },
        "segment::image_url": { table: "segments", column: "image_url" },
      };

      const preview: Array<Record<string, unknown>> = [];
      for (const a of assets ?? []) {
        const key = `${a.entity_type}::${a.field}`;
        const m = MAP[key];
        if (!m || !a.entity_id) continue;
        const { data: row } = await admin
          .from(m.table)
          .select(`${m.column}, name`)
          .eq("id", a.entity_id)
          .maybeSingle();
        const current = (row as Record<string, unknown> | null)?.[m.column] as string | null ?? null;
        const label = (row as Record<string, unknown> | null)?.name as string | undefined;
        preview.push({
          img_ref: a.img_ref,
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          name: label ?? null,
          table: m.table,
          column: m.column,
          field: a.field,
          current_url: current,
          new_url: a.public_url,
          will_change: current !== a.public_url,
          exists: !!row,
        });
      }
      const willChange = preview.filter((p) => p.will_change).length;
      return json({ ok: true, preview, summary: { total: preview.length, will_change: willChange } });
    }

    if (action === "audit_runs") {
      // Histórico das auditorias periódicas (para o painel admin).
      const { data: runs, error: runsErr } = await admin
        .from("media_audit_runs")
        .select("id, ran_at, total, active, archived, missing, alerted, source")
        .order("ran_at", { ascending: false })
        .limit(30);
      if (runsErr) throw new Error(runsErr.message);
      return json({ ok: true, runs: runs ?? [] });
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
