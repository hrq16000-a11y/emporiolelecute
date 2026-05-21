// Edge Function: cleanup-orphan-product-images
// Rotina mensal de GC para remover imagens órfãs do bucket `product-images`.
// - Usa service_role para ignorar RLS e poder deletar do Storage.
// - Considera órfão: arquivo com >7 dias e cuja URL pública NÃO aparece em products.images.
// - Paginação do Storage em lotes de 1000 (limite do SDK).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "product-images";
const SAFETY_WINDOW_DAYS = 7;
const PAGE_SIZE = 1000;

interface StorageFile {
  name: string;
  created_at?: string;
  updated_at?: string;
  id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // dry_run=true → apenas conta e lista (até 50) órfãos, NÃO deleta.
  const url = new URL(req.url);
  let dryRun = url.searchParams.get("dry_run") === "true";
  if (!dryRun && (req.method === "POST" || req.method === "PUT")) {
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.dry_run === true) dryRun = true;
    } catch { /* ignore */ }
  }


  const startedAt = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - SAFETY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  try {
    // 1) Carrega TODAS as URLs referenciadas em products.images em um Set para O(1) lookup.
    // products.images é text[]; iteramos e indexamos por URL completa e por path relativo.
    const { data: refData, error: refErr2 } = await supabase
      .from("products")
      .select("images");
    if (refErr2) throw new Error(`Falha lendo products.images: ${refErr2.message}`);

    const referenced = new Set<string>();
    for (const row of refData ?? []) {
      const imgs = (row as { images?: string[] | null }).images ?? [];
      for (const u of imgs) {
        if (typeof u === "string" && u.length > 0) {
          referenced.add(u);
          // Adiciona também o "path" relativo (caso comparação por nome seja necessária)
          const idx = u.indexOf(`/${BUCKET}/`);
          if (idx >= 0) referenced.add(u.substring(idx + BUCKET.length + 2));
        }
      }
    }

    // 2) Paginação do Storage. list() retorna no máx 1000; iteramos por offset.
    let analyzed = 0;
    let orphanCandidates = 0;
    let deleted = 0;
    let failed = 0;
    const toDelete: string[] = [];

    // Função recursiva para varrer subpastas (storage do Supabase é "flat" mas aceita prefixos).
    async function walk(prefix: string) {
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) throw new Error(`Storage.list(${prefix}) falhou: ${error.message}`);
        if (!data || data.length === 0) break;

        for (const entry of data as StorageFile[]) {
          // Subpasta: id é null
          if (!entry.id) {
            const sub = prefix ? `${prefix}/${entry.name}` : entry.name;
            await walk(sub);
            continue;
          }
          analyzed++;
          const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
          const createdAt = entry.created_at ? new Date(entry.created_at) : null;
          if (!createdAt || createdAt > cutoff) continue; // dentro da janela de segurança

          // Verifica se está referenciado: por path OU por publicUrl
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
          const publicUrl = pub?.publicUrl ?? "";
          const isReferenced = referenced.has(fullPath) || (publicUrl && referenced.has(publicUrl));
          if (!isReferenced) {
            orphanCandidates++;
            toDelete.push(fullPath);
          }
        }

        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    await walk("");

    // 3) Em dry_run, NÃO deleta. Apenas reporta candidatos (amostra de 50).
    if (!dryRun) {
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        const { data: delData, error: delErr } = await supabase.storage.from(BUCKET).remove(batch);
        if (delErr) {
          failed += batch.length;
          console.error(`[gc] falha ao deletar lote: ${delErr.message}`);
        } else {
          deleted += (delData?.length ?? batch.length);
        }
      }
    }

    const summary = {
      ok: true,
      mode: dryRun ? "dry_run" : "delete",
      bucket: BUCKET,
      cutoff: cutoff.toISOString(),
      analyzed,
      referenced_urls: referenced.size,
      orphans_found: orphanCandidates,
      deleted,
      failed,
      sample_orphans: toDelete.slice(0, 50),
      duration_ms: Date.now() - startedAt,
    };
    console.log("[gc] resumo:", JSON.stringify(summary));


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
