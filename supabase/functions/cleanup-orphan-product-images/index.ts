// ============= Edge Function: cleanup-orphan-product-images =============
// Garbage collector ENDURECIDO para o bucket de mídia.
//
// HISTÓRICO / MOTIVO DA REESCRITA:
// A versão anterior considerava "órfão" qualquer arquivo que NÃO estivesse em
// `products.images`, varrendo TODAS as pastas exceto `defaults/`. Isso apagou
// indevidamente imagens de `occasions/` e `hero/` (referenciadas em outras
// tabelas), pois a função nunca as consultava. Resultado: perda de dados.
//
// NOVA POLÍTICA (segura por padrão):
//  1. Atualiza o inventário central (`media_assets`) via RPC com service_role.
//  2. Só é candidato a remoção o asset com status='archived' (ninguém referencia)
//     E `backed_up_at` preenchido (já existe backup) — via RPC `media_gc_candidates`.
//  3. `dry_run` é o PADRÃO. Para deletar de fato é preciso enviar
//     { "confirm": "DELETE" } no corpo. Qualquer outro valor => apenas simulação.
//  4. Toda execução é registrada em `shipping_audit_logs` (reuso de tabela de auditoria).
//
// Nunca apaga: arquivos 'active' (em uso) nem 'missing'. Nunca apaga sem backup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "product-images";
const MIN_AGE_DAYS = 7;

interface Candidate {
  img_ref: string;
  bucket: string;
  storage_path: string;
  backed_up_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Por padrão é simulação. Deleção real só com { confirm: "DELETE" }.
  let confirmDelete = false;
  try {
    const body = await req.clone().json().catch(() => ({}));
    if (body?.confirm === "DELETE") confirmDelete = true;
  } catch { /* ignore */ }
  const dryRun = !confirmDelete;

  try {
    // 1) Atualiza o inventário central antes de decidir qualquer coisa.
    const { error: invErr } = await supabase.rpc("rebuild_media_inventory_internal");
    if (invErr) throw new Error(`Falha ao atualizar inventário: ${invErr.message}`);

    // 2) Busca SOMENTE candidatos seguros: archived + com backup + idade mínima.
    const { data: candData, error: candErr } = await supabase.rpc("media_gc_candidates", {
      _min_age_days: MIN_AGE_DAYS,
    });
    if (candErr) throw new Error(`Falha ao listar candidatos: ${candErr.message}`);

    const candidates = (candData ?? []) as Candidate[];
    const byBucket = new Map<string, string[]>();
    for (const c of candidates) {
      if (!byBucket.has(c.bucket)) byBucket.set(c.bucket, []);
      byBucket.get(c.bucket)!.push(c.storage_path);
    }

    let deleted = 0;
    let failed = 0;

    // 3) Em dry_run NÃO deleta. Apenas reporta.
    if (!dryRun) {
      for (const [bucket, paths] of byBucket.entries()) {
        for (let i = 0; i < paths.length; i += 100) {
          const batch = paths.slice(i, i + 100);
          const { data: delData, error: delErr } = await supabase.storage.from(bucket).remove(batch);
          if (delErr) {
            failed += batch.length;
            console.error(`[gc] falha ao deletar lote em ${bucket}: ${delErr.message}`);
          } else {
            deleted += delData?.length ?? batch.length;
          }
        }
      }
      // Marca como archived/removido no inventário (refletido no próximo rebuild).
      if (deleted > 0) {
        const refs = candidates.map((c) => c.img_ref);
        await supabase.from("media_assets").delete().in("img_ref", refs);
      }
    }

    const summary = {
      ok: true,
      mode: dryRun ? "dry_run" : "delete",
      bucket: BUCKET,
      policy: "archived_and_backed_up_only",
      candidates: candidates.length,
      deleted,
      failed,
      sample: candidates.slice(0, 50).map((c) => `${c.bucket}/${c.storage_path}`),
      duration_ms: Date.now() - startedAt,
    };
    console.log("[gc] resumo:", JSON.stringify(summary));

    // 4) Auditoria best-effort (reusa shipping_audit_logs.cart_snapshot p/ payload).
    try {
      await supabase.from("shipping_audit_logs").insert({
        event_type: dryRun ? "media_gc_dry_run" : "media_gc_delete",
        cart_snapshot: summary,
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gc] erro:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
