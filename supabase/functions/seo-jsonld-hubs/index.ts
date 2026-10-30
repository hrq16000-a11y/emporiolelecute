/**
 * seo-jsonld-hubs
 * ---------------
 * Audita o JSON-LD renderizado (prerender / bot UA) das páginas de
 * theme_hub (/tema/:slug) e combination_page (path do registry).
 *
 * Verifica, por URL:
 *  - Organization (ou Organization dentro de @graph)
 *  - BreadcrumbList com itemListElement válido
 *  - CollectionPage / ItemList (vitrine) e Product quando houver produtos
 *  - JSON inválido (bloco que não parseia)
 *
 * Somente leitura: nunca escreve no catálogo. Registra o resultado em
 * `seo_submission_log` (channel = 'jsonld-hubs').
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resilientSelect } from '../_shared/resilientSelect.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORIGIN = 'https://emporiolelecute.com.br';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PRERENDER = `${Deno.env.get('SUPABASE_URL')}/functions/v1/prerender`;

interface Check { field: string; ok: boolean; detail: string; severity: 'error' | 'warn' }
interface PageReport {
  kind: 'theme_hub' | 'combination_page';
  path: string;
  url: string;
  ok: boolean;
  source: 'prerender' | 'live';
  types: string[];
  checks: Check[];
  duration_ms: number;
  /** Blocos JSON-LD brutos, já normalizados (pretty-print) para inspeção/cópia. */
  ld_raw: string[];
  /** Trecho do <head> renderizado, para conferência lado a lado. */
  html_head: string;
}

// deno-lint-ignore no-explicit-any
function extractLd(html: string): { blocks: any[]; invalid: number; raw: string[] } {
  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [];
  const raw: string[] = [];
  let invalid = 0;
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].replace(/\\u003c/g, '<'));
      raw.push(JSON.stringify(parsed, null, 2));
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of arr) {
        blocks.push(node);
        if (Array.isArray(node?.['@graph'])) blocks.push(...node['@graph']);
      }
    } catch {
      invalid += 1;
      raw.push(`/* JSON inválido */\n${m[1].trim().slice(0, 4000)}`);
    }
  }
  return { blocks, invalid, raw };
}

// deno-lint-ignore no-explicit-any
const typeOf = (b: any): string[] =>
  (Array.isArray(b?.['@type']) ? b['@type'] : [b?.['@type']]).filter(Boolean).map(String);

async function fetchHtml(path: string): Promise<{ html: string; source: 'prerender' | 'live' }> {
  try {
    const res = await fetch(`${PRERENDER}?path=${encodeURIComponent(path)}`, {
      headers: { 'User-Agent': BOT_UA },
    });
    const html = await res.text();
    if (res.ok && html.includes('application/ld+json')) return { html, source: 'prerender' };
  } catch { /* cai para live */ }
  const res = await fetch(`${ORIGIN}${path}`, { headers: { 'User-Agent': BOT_UA } });
  return { html: await res.text(), source: 'live' };
}

async function auditPage(kind: PageReport['kind'], path: string): Promise<PageReport> {
  const started = Date.now();
  const checks: Check[] = [];
  let types: string[] = [];
  let source: PageReport['source'] = 'live';
  let ldRaw: string[] = [];
  let htmlHead = '';

  try {
    const r = await fetchHtml(path);
    source = r.source;
    const { blocks, invalid, raw } = extractLd(r.html);
    ldRaw = raw;
    htmlHead = (r.html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? r.html).slice(0, 12000);
    types = [...new Set(blocks.flatMap(typeOf))];

    checks.push({
      field: 'JSON-LD parseável',
      ok: invalid === 0 && blocks.length > 0,
      detail: invalid ? `${invalid} bloco(s) inválido(s)` : `${blocks.length} nó(s) encontrados`,
      severity: 'error',
    });

    const org = blocks.find((b) => typeOf(b).some((t) => /Organization|LocalBusiness/.test(t)));
    checks.push({
      field: 'Organization',
      ok: Boolean(org?.name && org?.url),
      detail: org ? `name="${org.name ?? '—'}"` : 'ausente',
      severity: 'error',
    });

    const bc = blocks.find((b) => typeOf(b).includes('BreadcrumbList'));
    const bcItems = Array.isArray(bc?.itemListElement) ? bc.itemListElement : [];
    checks.push({
      field: 'BreadcrumbList',
      ok: bcItems.length >= 2 && bcItems.every((i: Record<string, unknown>) => i.name && (i.item || i.position)),
      detail: bc ? `${bcItems.length} item(ns)` : 'ausente',
      severity: 'error',
    });

    const collection = blocks.find((b) => typeOf(b).some((t) => /CollectionPage|ItemList/.test(t)));
    checks.push({
      field: 'CollectionPage/ItemList',
      ok: Boolean(collection),
      detail: collection ? typeOf(collection).join(', ') : 'ausente (vitrine sem lista estruturada)',
      severity: 'warn',
    });

    const list = blocks.find((b) => typeOf(b).includes('ItemList'));
    const listItems = Array.isArray(list?.itemListElement) ? list.itemListElement : [];
    if (listItems.length) {
      const badOffers = listItems.filter((i: Record<string, any>) => {
        const item = i.item ?? i;
        const offers = Array.isArray(item?.offers) ? item.offers[0] : item?.offers;
        return !item?.name || !offers?.price || offers?.priceCurrency !== 'BRL';
      }).length;
      checks.push({
        field: 'Product (itens da lista)',
        ok: badOffers === 0,
        detail: badOffers ? `${badOffers}/${listItems.length} sem name/price/BRL` : `${listItems.length} itens válidos`,
        severity: 'error',
      });
    }
  } catch (e) {
    checks.push({
      field: 'fetch',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      severity: 'error',
    });
  }

  return {
    kind,
    path,
    url: `${ORIGIN}${path}`,
    ok: checks.filter((c) => c.severity === 'error').every((c) => c.ok),
    source,
    types,
    checks,
    duration_ms: Date.now() - started,
    ld_raw: ldRaw,
    html_head: htmlHead,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let limit = 12;
    try {
      const body = await req.json();
      if (Number.isFinite(body?.limit)) limit = Math.min(Math.max(1, body.limit), 40);
    } catch { /* sem body */ }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // deno-lint-ignore no-explicit-any
    const hubs = await resilientSelect<any>(
      supabase,
      'theme_hubs',
      ['slug', 'is_approved', 'is_indexed', 'updated_at'],
      (q: any) => q.order('updated_at', { ascending: false }).limit(limit),
    );
    // deno-lint-ignore no-explicit-any
    const combos = await resilientSelect<any>(
      supabase,
      'combination_pages_registry',
      ['path', 'is_indexable', 'discovery_status', 'updated_at'],
      (q: any) => q.order('updated_at', { ascending: false }).limit(limit),
    );

    const targets: Array<{ kind: PageReport['kind']; path: string }> = [
      ...(hubs.data ?? []).map((h: any) => ({ kind: 'theme_hub' as const, path: `/tema/${h.slug}` })),
      ...(combos.data ?? [])
        .filter((c: any) => typeof c.path === 'string' && c.path.startsWith('/'))
        .map((c: any) => ({ kind: 'combination_page' as const, path: c.path })),
    ].slice(0, limit * 2);

    const pages: PageReport[] = [];
    for (const t of targets) pages.push(await auditPage(t.kind, t.path));

    const failing = pages.filter((p) => !p.ok);
    const payload = {
      ran_at: new Date().toISOString(),
      summary: {
        pages: pages.length,
        valid: pages.length - failing.length,
        invalid: failing.length,
        theme_hubs: pages.filter((p) => p.kind === 'theme_hub').length,
        combination_pages: pages.filter((p) => p.kind === 'combination_page').length,
      },
      ok: failing.length === 0,
      pages,
    };

    await supabase.from('seo_submission_log').insert({
      channel: 'jsonld-hubs',
      status: failing.length ? `invalid (${failing.length})` : 'valid',
      ok: failing.length === 0,
      url_count: pages.length,
      target: ORIGIN,
      detail: payload.summary,
    });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('seo-jsonld-hubs error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
