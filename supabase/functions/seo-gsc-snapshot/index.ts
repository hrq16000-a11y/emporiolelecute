/**
 * seo-gsc-snapshot
 * ----------------
 * Captura um snapshot diário do Google Search Console e persiste em
 * `seo_gsc_snapshots`, criando a série histórica usada pelo painel de
 * tendências em /admin/seo-check.
 *
 * - Agrega métricas por TIPO DE PÁGINA (produto, coleção, hub, blog, etc.)
 * - Guarda também a linha agregada `all`
 * - Dispara alerta por e-mail quando a cobertura piora (páginas excluídas)
 *
 * Idempotente: reexecutar no mesmo dia faz upsert na mesma linha.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSeoFailureAlert } from '../_shared/seoAlert.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console';
const ORIGIN = 'https://emporiolelecute.com.br';

interface SiteEntry { siteUrl: string; permissionLevel?: string }
interface Row { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }

function covers(siteUrl: string, target: URL) {
  if (siteUrl.startsWith('sc-domain:')) {
    const domain = siteUrl.slice('sc-domain:'.length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try { return target.href.startsWith(new URL(siteUrl).href); } catch { return false; }
}

/** Classifica uma URL do site em um tipo de página estável. */
export function classifyPageType(rawUrl: string): string {
  let path = rawUrl;
  try { path = new URL(rawUrl).pathname; } catch { /* já é path */ }
  path = path.replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  if (path.startsWith('/produto')) return 'produto';
  if (path.startsWith('/produtos') || path.startsWith('/loja')) return 'catalogo';
  if (path.startsWith('/colecao')) return 'colecao';
  if (path.startsWith('/kit')) return 'kit';
  if (path.startsWith('/ocasi')) return 'ocasiao';
  if (path.startsWith('/tema') || path.startsWith('/hub')) return 'theme_hub';
  if (path.startsWith('/segmento')) return 'combination_page';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/buscar')) return 'busca';
  return 'institucional';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

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
    let days = 1;
    try {
      const b = await req.json();
      if (typeof b?.site_url === 'string') selectedSiteUrl = b.site_url;
      if (Number.isFinite(b?.days)) days = Math.min(Math.max(1, b.days), 30);
    } catch { /* sem body */ }

    // ---- resolver propriedade verificada em runtime ----
    const sitesRes = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
    const sitesBody = await sitesRes.text();
    if (!sitesRes.ok) {
      await sendSeoFailureAlert(supabase, {
        channel: 'gsc', target: ORIGIN,
        reason: `Falha ao listar propriedades [${sitesRes.status}]: ${sitesBody.slice(0, 300)}`,
      });
      return new Response(JSON.stringify({ error: 'Falha ao listar propriedades', status: sitesRes.status, details: sitesBody }), {
        status: sitesRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const entries: SiteEntry[] = JSON.parse(sitesBody).siteEntry ?? [];
    const target = new URL(ORIGIN);
    const matches = entries.filter((e) => e.permissionLevel !== 'siteUnverifiedUser' && covers(e.siteUrl, target));
    if (matches.length === 0) {
      return new Response(JSON.stringify({ status: 'no_property' }), {
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

    // GSC tem ~2 dias de defasagem
    const end = new Date(); end.setDate(end.getDate() - 2);
    const start = new Date(end); start.setDate(start.getDate() - (days - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const snapshotDate = fmt(end);

    const query = async (dimensions: string[], rowLimit = 500) => {
      const r = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions, rowLimit }),
      });
      if (!r.ok) throw new Error(`searchAnalytics [${r.status}]: ${(await r.text()).slice(0, 300)}`);
      return ((await r.json()).rows ?? []) as Row[];
    };

    const [pageRows, queryRows] = await Promise.all([query(['page']), query(['query'], 25)]);

    // ---- agregação por tipo de página ----
    interface Agg { clicks: number; impressions: number; posSum: number; n: number }
    const byType = new Map<string, Agg>();
    const bump = (k: string, r: Row) => {
      const a = byType.get(k) ?? { clicks: 0, impressions: 0, posSum: 0, n: 0 };
      a.clicks += r.clicks ?? 0;
      a.impressions += r.impressions ?? 0;
      a.posSum += (r.position ?? 0) * (r.impressions ?? 1);
      a.n += r.impressions ?? 1;
      byType.set(k, a);
    };
    for (const r of pageRows) {
      const url = r.keys?.[0] ?? '';
      bump(classifyPageType(url), r);
      bump('all', r);
    }

    const topQueries = queryRows.slice(0, 25).map((r) => ({
      query: r.keys?.[0] ?? '',
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: Number(((r.ctr ?? 0) * 100).toFixed(2)),
      position: Number((r.position ?? 0).toFixed(1)),
    }));

    // ---- cobertura: quantas URLs do sitemap aparecem com impressões ----
    let sitemapUrls: string[] = [];
    try {
      const xml = await (await fetch(`${ORIGIN}/sitemap.xml`, { cache: 'no-store' } as RequestInit)).text();
      sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    } catch { /* sitemap indisponível */ }
    const seen = new Set(pageRows.map((r) => (r.keys?.[0] ?? '').replace(/\/+$/, '')));
    const coverageByType = new Map<string, { indexed: number; excluded: number }>();
    for (const u of sitemapUrls) {
      const t = classifyPageType(u);
      const c = coverageByType.get(t) ?? { indexed: 0, excluded: 0 };
      if (seen.has(u.replace(/\/+$/, ''))) c.indexed++; else c.excluded++;
      coverageByType.set(t, c);
      const all = coverageByType.get('all') ?? { indexed: 0, excluded: 0 };
      if (seen.has(u.replace(/\/+$/, ''))) all.indexed++; else all.excluded++;
      coverageByType.set('all', all);
    }

    const rows = [...byType.entries()].map(([pageType, a]) => {
      const cov = coverageByType.get(pageType) ?? { indexed: 0, excluded: 0 };
      return {
        snapshot_date: snapshotDate,
        site_url: siteUrl,
        page_type: pageType,
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.impressions > 0 ? Number(((a.clicks / a.impressions) * 100).toFixed(2)) : 0,
        position: a.n > 0 ? Number((a.posSum / a.n).toFixed(2)) : 0,
        indexed_count: cov.indexed,
        excluded_count: cov.excluded,
        top_queries: pageType === 'all' ? topQueries : [],
        coverage_issues: [],
      };
    });

    // tipos presentes no sitemap mas sem nenhuma impressão ainda
    for (const [pageType, cov] of coverageByType) {
      if (byType.has(pageType)) continue;
      rows.push({
        snapshot_date: snapshotDate, site_url: siteUrl, page_type: pageType,
        clicks: 0, impressions: 0, ctr: 0, position: 0,
        indexed_count: cov.indexed, excluded_count: cov.excluded,
        top_queries: [], coverage_issues: [],
      });
    }

    const { error: upsertError } = await supabase
      .from('seo_gsc_snapshots')
      .upsert(rows, { onConflict: 'snapshot_date,site_url,page_type' });
    if (upsertError) throw new Error(`upsert falhou: ${upsertError.message}`);

    // ---- alerta de indexação: >30% do sitemap sem impressões ----
    const all = rows.find((r) => r.page_type === 'all');
    if (all && all.indexed_count + all.excluded_count >= 20) {
      const total = all.indexed_count + all.excluded_count;
      const ratio = all.excluded_count / total;
      if (ratio > 0.3) {
        const missing = sitemapUrls.filter((u) => !seen.has(u.replace(/\/+$/, ''))).slice(0, 20);
        await sendSeoFailureAlert(supabase, {
          channel: 'gsc',
          target: siteUrl,
          reason: `${all.excluded_count} de ${total} URLs do sitemap (${Math.round(ratio * 100)}%) não registraram impressões no Google Search Console.`,
          urls: missing,
          extra: { snapshot_date: snapshotDate, indexed: all.indexed_count, excluded: all.excluded_count },
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true, snapshot_date: snapshotDate, site_url: siteUrl,
      page_types: rows.length, sitemap_urls: sitemapUrls.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[seo-gsc-snapshot]', msg);
    await sendSeoFailureAlert(supabase, { channel: 'gsc', target: ORIGIN, reason: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
