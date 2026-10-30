/**
 * Valida o JSON-LD (schema.org) renderizado das páginas de produto.
 *
 * Busca o HTML servido a crawlers (prerender) e confere, campo a campo:
 * name / description / image / offers.price / offers.availability / offers.url,
 * comparando com os dados reais do banco. Retorna `upload_allowed=false`
 * quando houver inconsistência — usado para bloquear o envio do feed.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CANONICAL_ORIGIN, productAbsolute } from '../_shared/urls.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const DEFAULT_LIMIT = 20;

interface FieldCheck { field: string; ok: boolean; expected: string; found: string }
interface PageReport {
  slug: string;
  name: string;
  url: string;
  ok: boolean;
  has_product_ld: boolean;
  checks: FieldCheck[];
}

// deno-lint-ignore no-explicit-any
function extractLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].replace(/\\u003c/g, '<'));
      Array.isArray(parsed) ? out.push(...parsed) : out.push(parsed);
    } catch { /* bloco inválido é ignorado e reportado pela ausência de Product */ }
  }
  return out;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let limit = DEFAULT_LIMIT;
    try {
      const body = await req.json();
      if (Number.isFinite(body?.limit)) limit = Math.min(Math.max(1, body.limit), 60);
    } catch { /* sem body */ }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: products, error } = await supabase
      .from('products')
      .select('slug, name, description, long_description, price, images, is_active')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const reports: PageReport[] = [];

    const prerenderBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/prerender`;

    for (const p of products ?? []) {
      const url = productAbsolute(p.slug, CANONICAL_ORIGIN);
      const checks: FieldCheck[] = [];
      let hasProduct = false;

      try {
        // A hospedagem entrega o SPA (JSON-LD injetado no cliente). Para auditar o
        // markup servido a robôs que não executam JS, lemos o HTML pré-renderizado
        // e, se ele falhar, caímos para o HTML público com UA de bot.
        const path = `/produto/${p.slug}`;
        let res = await fetch(`${prerenderBase}?path=${encodeURIComponent(path)}`, {
          headers: { 'User-Agent': BOT_UA },
        });
        let html = await res.text();
        let blocks = extractLd(html);
        if (!blocks.some((b) => b?.['@type'] === 'Product')) {
          res = await fetch(url, { headers: { 'User-Agent': BOT_UA } });
          html = await res.text();
          blocks = extractLd(html);
        }
        const product = blocks.find((b) => b?.['@type'] === 'Product');
        hasProduct = Boolean(product);

        if (!product) {
          checks.push({ field: 'Product JSON-LD', ok: false, expected: 'bloco @type=Product', found: `status ${res.status}, ${blocks.length} bloco(s)` });
        } else {
          const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          const images = Array.isArray(product.image) ? product.image : [product.image].filter(Boolean);
          const expectedDesc = (p.description || p.long_description || '').slice(0, 60);

          checks.push({
            field: 'name', ok: str(product.name).trim() === str(p.name).trim(),
            expected: str(p.name), found: str(product.name),
          });
          checks.push({
            field: 'description',
            ok: str(product.description).length >= 30 && (!expectedDesc || str(product.description).startsWith(expectedDesc.slice(0, 30))),
            expected: `${expectedDesc.slice(0, 40)}…`, found: `${str(product.description).slice(0, 40)}…`,
          });
          checks.push({
            field: 'image',
            ok: images.length > 0 && images.every((i: string) => str(i).startsWith('https://')),
            expected: `${(p.images ?? []).length} imagem(ns) HTTPS`, found: `${images.length} imagem(ns)`,
          });
          checks.push({
            field: 'offers.price', ok: Number(offers?.price) === Number(p.price),
            expected: str(p.price), found: str(offers?.price),
          });
          const expectedAvail = (p.is_active ?? true)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock';
          checks.push({
            field: 'offers.availability', ok: str(offers?.availability) === expectedAvail,
            expected: expectedAvail, found: str(offers?.availability),
          });
          checks.push({
            field: 'offers.priceCurrency', ok: str(offers?.priceCurrency) === 'BRL',
            expected: 'BRL', found: str(offers?.priceCurrency),
          });
          checks.push({
            field: 'offers.url', ok: str(offers?.url) === url,
            expected: url, found: str(offers?.url),
          });
        }
      } catch (e) {
        checks.push({
          field: 'fetch', ok: false, expected: '200 OK',
          found: e instanceof Error ? e.message : String(e),
        });
      }

      reports.push({
        slug: p.slug, name: p.name, url,
        ok: checks.every((c) => c.ok), has_product_ld: hasProduct, checks,
      });
    }

    const failing = reports.filter((r) => !r.ok);
    const payload = {
      ran_at: new Date().toISOString(),
      summary: {
        pages: reports.length,
        valid: reports.length - failing.length,
        invalid: failing.length,
        fields_checked: reports.reduce((a, r) => a + r.checks.length, 0),
      },
      upload_allowed: failing.length === 0,
      pages: failing.length ? failing : reports.slice(0, 5),
    };

    await supabase.from('seo_submission_log').insert({
      channel: 'jsonld',
      status: failing.length ? `invalid (${failing.length})` : 'valid',
      ok: failing.length === 0,
      url_count: reports.length,
      target: CANONICAL_ORIGIN,
      detail: payload.summary,
    });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('seo-jsonld-audit error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
