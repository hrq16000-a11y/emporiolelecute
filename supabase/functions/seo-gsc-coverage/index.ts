/**
 * seo-gsc-coverage
 * ----------------
 * Painel de cobertura do Google Search Console:
 *  - resolve a propriedade verificada em runtime (GET /sites)
 *  - principais consultas e páginas (searchAnalytics)
 *  - estado de indexação de uma amostra de URLs do sitemap (URL Inspection)
 *  - correlação com falhas recentes de sitemap / IndexNow / merchant-feed
 *    registradas em `seo_submission_log`
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console';
const ORIGIN = 'https://emporiolelecute.com.br';

interface SiteEntry { siteUrl: string; permissionLevel?: string }

function covers(siteUrl: string, target: URL) {
  if (siteUrl.startsWith('sc-domain:')) {
    const domain = siteUrl.slice('sc-domain:'.length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try { return target.href.startsWith(new URL(siteUrl).href); } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY');
  if (!LOVABLE_API_KEY || !GSC_KEY) {
    return new Response(JSON.stringify({ error: 'Conector do Google Search Console não configurado' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const headers = { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': GSC_KEY };

  try {
    let selectedSiteUrl: string | undefined;
    let inspectLimit = 8;
    let days = 28;
    try {
      const b = await req.json();
      if (typeof b?.site_url === 'string') selectedSiteUrl = b.site_url;
      if (Number.isFinite(b?.inspect)) inspectLimit = Math.min(Math.max(0, b.inspect), 15);
      if (Number.isFinite(b?.days)) days = Math.min(Math.max(7, b.days), 90);
    } catch { /* sem body */ }

    // ---- resolver propriedade verificada ----
    const sitesRes = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
    const sitesBody = await sitesRes.text();
    if (!sitesRes.ok) {
      return new Response(JSON.stringify({ error: 'Falha ao listar propriedades', status: sitesRes.status, details: sitesBody }), {
        status: sitesRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const entries: SiteEntry[] = JSON.parse(sitesBody).siteEntry ?? [];
    const target = new URL(ORIGIN);
    const matches = entries.filter((e) => e.permissionLevel !== 'siteUnverifiedUser' && covers(e.siteUrl, target));
    if (matches.length === 0) {
      return new Response(JSON.stringify({ status: 'no_property', message: 'Nenhuma propriedade verificada cobre este domínio.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let siteUrl: string;
    if (selectedSiteUrl) {
      const found = matches.find((m) => m.siteUrl === selectedSiteUrl);
      if (!found) {
        return new Response(JSON.stringify({ status: 'selection_required', candidates: matches.map((m) => m.siteUrl) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      siteUrl = found.siteUrl;
    } else if (matches.length === 1) {
      siteUrl = matches[0].siteUrl;
    } else {
      return new Response(JSON.stringify({ status: 'selection_required', candidates: matches.map((m) => m.siteUrl) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- searchAnalytics ----
    const end = new Date(); end.setDate(end.getDate() - 2);
    const start = new Date(end); start.setDate(start.getDate() - days);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const analytics = async (dimension: 'query' | 'page') => {
      const r = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: [dimension], rowLimit: 25 }),
      });
      if (!r.ok) return { rows: [], error: `${r.status}: ${(await r.text()).slice(0, 300)}` };
      const j = await r.json();
      return { rows: j.rows ?? [], error: null };
    };
    const [queries, pages] = await Promise.all([analytics('query'), analytics('page')]);

    // ---- amostra do sitemap + URL Inspection ----
    const coverage: Array<{ url: string; verdict: string; indexing_state: string; coverage_state: string; last_crawl: string | null; canonical: string | null; canonical_ok: boolean }> = [];
    let sitemapUrls: string[] = [];
    try {
      const xml = await (await fetch(`${ORIGIN}/sitemap.xml`, { cache: 'no-store' } as RequestInit)).text();
      sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    } catch { /* sitemap indisponível */ }

    const sample = sitemapUrls.slice(0, inspectLimit);
    for (const u of sample) {
      try {
        const r = await fetch(`${GATEWAY}/v1/urlInspection/index:inspect`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inspectionUrl: u, siteUrl }),
        });
        if (!r.ok) {
          coverage.push({ url: u, verdict: 'ERRO', indexing_state: `${r.status}`, coverage_state: (await r.text()).slice(0, 160), last_crawl: null, canonical: null, canonical_ok: false });
          continue;
        }
        const j = await r.json();
        const idx = j?.inspectionResult?.indexStatusResult ?? {};
        coverage.push({
          url: u,
          verdict: j?.inspectionResult?.indexStatusResult?.verdict ?? 'DESCONHECIDO',
          indexing_state: idx.indexingState ?? '—',
          coverage_state: idx.coverageState ?? '—',
          last_crawl: idx.lastCrawlTime ?? null,
          canonical: idx.googleCanonical ?? null,
          canonical_ok: !idx.googleCanonical || idx.googleCanonical === (idx.userCanonical ?? u),
        });
      } catch (e) {
        coverage.push({ url: u, verdict: 'ERRO', indexing_state: '—', coverage_state: e instanceof Error ? e.message : 'erro', last_crawl: null, canonical: null, canonical_ok: false });
      }
    }

    // ---- correlação com falhas de envio ----
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: failures } = await supabase
      .from('seo_submission_log')
      .select('id, channel, status, ok, url_count, created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    const recentFailures = (failures ?? []).filter((f: { ok?: boolean }) => f.ok === false);


    const excluded = coverage.filter((c) => c.verdict !== 'PASS');

    return new Response(JSON.stringify({
      ran_at: new Date().toISOString(),
      site_url: siteUrl,
      period: { start: fmt(start), end: fmt(end), days },
      summary: {
        sitemap_urls: sitemapUrls.length,
        inspected: coverage.length,
        indexed: coverage.filter((c) => c.verdict === 'PASS').length,
        excluded: excluded.length,
        canonical_mismatch: coverage.filter((c) => !c.canonical_ok).length,
        clicks: queries.rows.reduce((a: number, r: { clicks?: number }) => a + (r.clicks ?? 0), 0),
        impressions: queries.rows.reduce((a: number, r: { impressions?: number }) => a + (r.impressions ?? 0), 0),
        submission_failures: recentFailures.length,
      },
      queries: queries.rows,
      pages: pages.rows,
      analytics_errors: [queries.error, pages.error].filter(Boolean),
      coverage,
      submission_failures: recentFailures,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
