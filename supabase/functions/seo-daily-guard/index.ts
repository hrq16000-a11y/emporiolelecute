/**
 * Validação diária com gate de diff.
 *
 * Roda 1x/dia (cron) ou sob demanda no /admin/seo-check. Só dispara reenvio
 * quando o sitemap OU o feed do Merchant realmente mudaram — evita consumo
 * desnecessário de recursos e ruído nos buscadores.
 *
 * Histórico gravado em `seo_check_runs` (source = 'daily-guard').
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CANONICAL_ORIGIN } from '../_shared/urls.ts';
import { sendSeoFailureAlert } from '../_shared/seoAlert.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let force = false;
  try { const b = await req.json(); force = b?.force === true; } catch { /* sem body */ }

  const checks: { name: string; ok: boolean; detail: string }[] = [];
  let resubmitted = false;
  let sitemapChanged = false;
  let feedChanged = false;

  try {
    // 1) Sitemap — hash do XML público
    let sitemapHash = '';
    let sitemapUrls = 0;
    try {
      const res = await fetch(`${CANONICAL_ORIGIN}/sitemap.xml`, { headers: { 'User-Agent': 'LeleCute-SEO-Guard' } });
      const xml = await res.text();
      sitemapUrls = (xml.match(/<loc>/g) ?? []).length;
      sitemapHash = await sha256(xml.replace(/<lastmod>[^<]*<\/lastmod>/g, ''));
      checks.push({
        name: 'sitemap_reachable',
        ok: res.ok && sitemapUrls > 0,
        detail: `HTTP ${res.status} · ${sitemapUrls} URLs`,
      });
      if (!res.ok || sitemapUrls === 0) {
        await sendSeoFailureAlert(supabase, {
          channel: 'sitemap',
          target: `${CANONICAL_ORIGIN}/sitemap.xml`,
          reason: `HTTP ${res.status} com ${sitemapUrls} URLs`,
        });
      }
    } catch (e) {
      checks.push({ name: 'sitemap_reachable', ok: false, detail: e instanceof Error ? e.message : String(e) });
    }

    // 2) Merchant feed — reaproveita a auditoria existente (checksum + diff)
    let feedOk = true;
    let feedChecksum = '';
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/merchant-feed-audit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const feed = await r.json();
      feedOk = feed?.upload_allowed !== false;
      feedChanged = feed?.diff?.unchanged === false;
      feedChecksum = String(feed?.summary?.items ?? '') + ':' + String(feed?.summary?.errors ?? '');
      checks.push({
        name: 'merchant_feed',
        ok: feedOk,
        detail: `${feed?.summary?.ready_to_upload ?? 0}/${feed?.summary?.items ?? 0} itens prontos · ${feed?.summary?.errors ?? 0} erro(s)`,
      });
      if (!feedOk) {
        await sendSeoFailureAlert(supabase, {
          channel: 'merchant',
          target: `${supabaseUrl}/functions/v1/merchant-feed`,
          reason: `${feed?.summary?.blocked ?? 0} item(ns) bloqueados; ${feed?.summary?.missing_images ?? 0} com menos de 2 imagens HTTPS`,
          extra: feed?.summary,
        });
      }
    } catch (e) {
      feedOk = false;
      checks.push({ name: 'merchant_feed', ok: false, detail: e instanceof Error ? e.message : String(e) });
    }

    // 3) JSON-LD renderizado
    let jsonLdOk = true;
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/seo-jsonld-audit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 12 }),
      });
      const ld = await r.json();
      jsonLdOk = ld?.upload_allowed !== false;
      checks.push({
        name: 'jsonld_valid',
        ok: jsonLdOk,
        detail: `${ld?.summary?.valid ?? 0}/${ld?.summary?.pages ?? 0} páginas com JSON-LD íntegro`,
      });
    } catch (e) {
      jsonLdOk = false;
      checks.push({ name: 'jsonld_valid', ok: false, detail: e instanceof Error ? e.message : String(e) });
    }

    // 4) Gate de diff — só reenvia quando algo mudou
    const { data: prev } = await supabase
      .from('store_settings').select('value').eq('key', 'seo_guard_state').maybeSingle();
    const prevState = (prev?.value as { sitemap_hash?: string; feed_checksum?: string } | null) ?? {};
    sitemapChanged = Boolean(sitemapHash) && prevState.sitemap_hash !== sitemapHash;
    const changed = sitemapChanged || feedChanged;

    if ((changed || force) && jsonLdOk) {
      const r = await fetch(`${supabaseUrl}/functions/v1/seo-sitemap-auto-resubmit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, reason: 'daily-guard' }),
      });
      resubmitted = r.ok;
      checks.push({ name: 'resubmission', ok: r.ok, detail: r.ok ? 'Sitemap + IndexNow reenviados' : `HTTP ${r.status}` });
    } else {
      checks.push({
        name: 'resubmission',
        ok: true,
        detail: !jsonLdOk ? 'Bloqueado: JSON-LD inconsistente' : 'Sem mudanças — reenvio dispensado',
      });
    }

    await supabase.from('store_settings').upsert({
      key: 'seo_guard_state',
      value: { sitemap_hash: sitemapHash, feed_checksum: feedChecksum, ran_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    const errors = checks.filter((c) => !c.ok).length;
    await supabase.from('seo_check_runs').insert({
      source: 'daily-guard',
      total: checks.length,
      passed: checks.length - errors,
      errors,
      warnings: 0,
      checks: { checks, sitemap_changed: sitemapChanged, feed_changed: feedChanged, resubmitted, sitemap_urls: sitemapUrls },
    });

    return new Response(JSON.stringify({
      ran_at: new Date().toISOString(),
      sitemap_changed: sitemapChanged,
      feed_changed: feedChanged,
      resubmitted,
      summary: { total: checks.length, passed: checks.length - errors, errors },
      checks,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('seo-daily-guard error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
