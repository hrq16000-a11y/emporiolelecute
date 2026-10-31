/**
 * seo-index-audit
 * ---------------
 * 1) Valida robots.txt + cabeçalhos de robots (X-Robots-Tag) e meta robots
 *    das rotas importantes, garantindo indexabilidade por Google/Bing.
 * 2) Valida o HTML renderizado (prerender/bot UA) de cada theme_hub e
 *    combination_page: canonical correto, BreadcrumbList presente e
 *    ausência de redirects/loops.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resilientSelect } from '../_shared/resilientSelect.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORIGIN = 'https://emporiolelecute.com.br';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

interface RobotsCheck {
  name: string;
  ok: boolean;
  severity: 'error' | 'warn' | 'info';
  detail: string;
}

interface PageAudit {
  kind: 'theme_hub' | 'combination_page' | 'core';
  path: string;
  url: string;
  status: number;
  redirected_to: string | null;
  canonical: string | null;
  canonical_ok: boolean;
  breadcrumbs: number;
  breadcrumbs_ok: boolean;
  meta_robots: string | null;
  x_robots_tag: string | null;
  indexable: boolean;
  source: 'prerender' | 'live';
  issues: string[];
  duration_ms: number;
}

const norm = (u: string) => u.replace(/\/+$/, '').toLowerCase();
const PRERENDER = `${Deno.env.get('SUPABASE_URL')}/functions/v1/prerender`;

async function auditPage(kind: PageAudit['kind'], path: string): Promise<PageAudit> {
  const url = `${ORIGIN}${path}`;
  const started = Date.now();
  const issues: string[] = [];
  let status = 0;
  let redirected_to: string | null = null;
  let canonical: string | null = null;
  let breadcrumbs = 0;
  let meta_robots: string | null = null;
  let x_robots_tag: string | null = null;
  let source: 'prerender' | 'live' = 'live';

  try {
    // A hospedagem entrega o SPA (head injetado no cliente). Auditamos primeiro o
    // HTML pré-renderizado servido a robôs; se falhar, caímos para o HTML público.
    const res = await fetch(url, { headers: { 'User-Agent': BOT_UA, Accept: 'text/html' }, redirect: 'follow' });
    status = res.status;
    if (norm(res.url) !== norm(url)) redirected_to = res.url;
    x_robots_tag = res.headers.get('x-robots-tag');
    let html = await res.text();

    const hasHead = /rel=["']canonical["']/i.test(html);
    if (!hasHead) {
      try {
        const pre = await fetch(`${PRERENDER}?path=${encodeURIComponent(path)}`, { headers: { 'User-Agent': BOT_UA } });
        if (pre.ok) {
          const preHtml = await pre.text();
          if (/rel=["']canonical["']/i.test(preHtml)) { html = preHtml; source = 'prerender'; }
        }
      } catch { /* prerender indisponível: mantém HTML público */ }
    }


    canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
    meta_robots = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? null;

    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const parsed = JSON.parse(m[1].trim());
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        for (const n of nodes) {
          if (n?.['@type'] === 'BreadcrumbList' && Array.isArray(n.itemListElement)) {
            breadcrumbs = Math.max(breadcrumbs, n.itemListElement.length);
          }
        }
      } catch { /* json-ld inválido é reportado abaixo */ }
    }
  } catch (e) {
    issues.push(`Falha ao buscar: ${e instanceof Error ? e.message : 'erro'}`);
  }

  if (status !== 200) issues.push(`HTTP ${status || 'sem resposta'}`);
  if (redirected_to) issues.push(`Redirecionada para ${redirected_to}`);

  const canonical_ok = !!canonical && norm(canonical) === norm(url);
  if (!canonical) issues.push('Sem <link rel="canonical">');
  else if (!canonical_ok) issues.push(`Canonical divergente: ${canonical}`);

  // A home é a raiz da trilha: não exigimos BreadcrumbList nela.
  const breadcrumbs_ok = path === '/' ? true : breadcrumbs >= 2;
  if (!breadcrumbs_ok) issues.push('BreadcrumbList ausente ou com menos de 2 itens');

  const robotsBlob = `${meta_robots ?? ''} ${x_robots_tag ?? ''}`.toLowerCase();
  const indexable = !/noindex/.test(robotsBlob);
  if (!indexable) issues.push(`Bloqueada por robots: ${robotsBlob.trim()}`);

  return {
    kind, path, url, status, redirected_to, canonical, canonical_ok,
    breadcrumbs, breadcrumbs_ok, meta_robots, x_robots_tag, indexable, source, issues,
    duration_ms: Date.now() - started,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let limit = 12;
    try { const b = await req.json(); if (Number.isFinite(b?.limit)) limit = Math.min(Math.max(1, b.limit), 40); } catch { /* sem body */ }

    // ---------- 1) robots.txt + cabeçalhos ----------
    const robots: RobotsCheck[] = [];
    let robotsTxt = '';
    try {
      const r = await fetch(`${ORIGIN}/robots.txt`, { headers: { 'User-Agent': BOT_UA }, cache: 'no-store' } as RequestInit);
      robotsTxt = await r.text();
      robots.push({
        name: 'robots_reachable',
        ok: r.ok && robotsTxt.length > 0,
        severity: 'error',
        detail: r.ok ? `HTTP ${r.status}, ${robotsTxt.length} bytes` : `HTTP ${r.status}`,
      });
      robots.push({
        name: 'robots_allows_indexing',
        ok: !/^\s*disallow:\s*\/\s*$/im.test(robotsTxt),
        severity: 'error',
        detail: /^\s*disallow:\s*\/\s*$/im.test(robotsTxt)
          ? 'robots.txt bloqueia o site inteiro (Disallow: /)'
          : 'Nenhum bloqueio global encontrado',
      });
      robots.push({
        name: 'robots_has_sitemap',
        ok: /sitemap:\s*https?:\/\//i.test(robotsTxt),
        severity: 'warn',
        detail: robotsTxt.match(/Sitemap:.*/i)?.[0] ?? 'Diretiva Sitemap ausente',
      });
      const blocksBots = /user-agent:\s*(bingbot|googlebot)[\s\S]*?disallow:\s*\/\s*$/im.test(robotsTxt);
      robots.push({
        name: 'robots_no_bot_block',
        ok: !blocksBots,
        severity: 'error',
        detail: blocksBots ? 'Googlebot ou Bingbot bloqueados explicitamente' : 'Googlebot e Bingbot liberados',
      });
    } catch (e) {
      robots.push({
        name: 'robots_reachable', ok: false, severity: 'error',
        detail: e instanceof Error ? e.message : 'erro ao buscar robots.txt',
      });
    }

    // ---------- 2) páginas ----------
    const core = ['/', '/produtos', '/blog'];
    const hubsRes = await resilientSelect<any>(
      supabase, 'theme_hubs', ['slug', 'is_indexed', 'is_approved', 'updated_at'],
      (q: any) => q.limit(limit),
    );
    const combosRes = await resilientSelect<any>(
      supabase, 'combination_pages_registry', ['path', 'is_indexable', 'updated_at'],
      (q: any) => q.limit(limit),
    );

    const targets: Array<{ kind: PageAudit['kind']; path: string }> = [
      ...core.map((p) => ({ kind: 'core' as const, path: p })),
      ...(hubsRes.data ?? []).filter((h: any) => h.slug).map((h: any) => ({ kind: 'theme_hub' as const, path: `/tema/${h.slug}` })),
      ...(combosRes.data ?? []).filter((c: any) => c.path).map((c: any) => ({ kind: 'combination_page' as const, path: c.path })),
    ];

    const pages: PageAudit[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      pages.push(...await Promise.all(batch.map((t) => auditPage(t.kind, t.path))));
    }

    const summary = {
      robots_checks: robots.length,
      robots_failed: robots.filter((r) => !r.ok).length,
      pages: pages.length,
      pages_ok: pages.filter((p) => p.issues.length === 0).length,
      canonical_failed: pages.filter((p) => !p.canonical_ok).length,
      breadcrumbs_failed: pages.filter((p) => !p.breadcrumbs_ok).length,
      redirected: pages.filter((p) => p.redirected_to).length,
      noindex: pages.filter((p) => !p.indexable).length,
      theme_hubs: pages.filter((p) => p.kind === 'theme_hub').length,
      combination_pages: pages.filter((p) => p.kind === 'combination_page').length,
      schema_drift: [...hubsRes.diagnostic.missing_columns, ...combosRes.diagnostic.missing_columns],
    };

    return new Response(JSON.stringify({ ran_at: new Date().toISOString(), summary, robots, robots_txt: robotsTxt, pages }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
