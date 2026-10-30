/**
 * seo-image-audit
 * ---------------
 * Pipeline de qualidade de imagens para SEO:
 *  - imagem real e acessível (HTTP 200 + content-type de imagem)
 *  - HTTPS obrigatório
 *  - formato moderno servido (WebP/AVIF via transform do Storage)
 *  - peso máximo por imagem (compressão)
 *  - variante responsiva disponível (endpoint /render/image)
 *  - atributo alt preenchido no HTML renderizado da PDP
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORIGIN = 'https://emporiolelecute.com.br';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PRERENDER = `${Deno.env.get('SUPABASE_URL')}/functions/v1/prerender`;
const MAX_BYTES = 300 * 1024; // 300 KB por imagem servida
const PUBLIC_SEG = '/storage/v1/object/public/';
const RENDER_SEG = '/storage/v1/render/image/public/';

interface ImageIssue { severity: 'error' | 'warn'; code: string; detail: string }
interface ImageReport {
  product_id: string;
  product_name: string;
  slug: string;
  image_url: string;
  status: number;
  content_type: string | null;
  bytes: number;
  modern_format: boolean;
  responsive: boolean;
  issues: ImageIssue[];
}

function optimized(url: string, width: number) {
  if (!url.includes(PUBLIC_SEG)) return url;
  const t = url.replace(PUBLIC_SEG, RENDER_SEG);
  return `${t}${t.includes('?') ? '&' : '?'}width=${width}&quality=75&resize=cover`;
}

async function probe(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': BOT_UA, Accept: 'image/avif,image/webp,image/*' } });
  const ct = res.headers.get('content-type');
  const len = Number(res.headers.get('content-length') ?? 0);
  let bytes = len;
  if (!bytes && res.ok) bytes = (await res.arrayBuffer()).byteLength;
  else await res.body?.cancel();
  return { status: res.status, ct, bytes };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let limit = 15;
    try { const b = await req.json(); if (Number.isFinite(b?.limit)) limit = Math.min(Math.max(1, b.limit), 40); } catch { /* sem body */ }

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, slug, images')
      .eq('is_active', true)
      .limit(limit);
    if (error) throw error;

    const reports: ImageReport[] = [];
    const altChecks: Array<{ slug: string; url: string; images: number; with_alt: number; ok: boolean }> = [];

    for (const p of products ?? []) {
      const imgs: string[] = Array.isArray(p.images) ? p.images.filter(Boolean) : [];

      // ---- alt no HTML renderizado ----
      const pdp = `${ORIGIN}/produtos/${p.slug}`;
      try {
        // O HTML público é o shell do SPA; o markup servido a robôs vem do prerender.
        let html = await (await fetch(pdp, { headers: { 'User-Agent': BOT_UA, Accept: 'text/html' } })).text();
        let tags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
        try {
          const pre = await fetch(`${PRERENDER}?path=${encodeURIComponent(`/produto/${p.slug}`)}`, {
            headers: { 'User-Agent': BOT_UA },
          });
          if (pre.ok) {
            const preHtml = await pre.text();
            const preTags = [...preHtml.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
            if (preTags.length > tags.length) { html = preHtml; tags = preTags; }
          }
        } catch { /* prerender indisponível */ }
        const withAlt = tags.filter((t) => /alt=["'][^"']+["']/i.test(t)).length;
        altChecks.push({ slug: p.slug, url: pdp, images: tags.length, with_alt: withAlt, ok: tags.length > 0 && withAlt === tags.length });
      } catch {
        altChecks.push({ slug: p.slug, url: pdp, images: 0, with_alt: 0, ok: false });
      }

      for (const raw of imgs.slice(0, 3)) {
        const issues: ImageIssue[] = [];
        const responsive = raw.includes(PUBLIC_SEG);
        const target = responsive ? optimized(raw, 800) : raw;

        if (!raw.startsWith('https://')) {
          issues.push({ severity: 'error', code: 'not_https', detail: 'Imagem não servida por HTTPS' });
        }
        if (!responsive) {
          issues.push({ severity: 'warn', code: 'no_responsive', detail: 'Fora do Storage: sem variantes responsivas/WebP automáticas' });
        }

        let status = 0, ct: string | null = null, bytes = 0;
        try {
          const r = await probe(target);
          status = r.status; ct = r.ct; bytes = r.bytes;
        } catch (e) {
          issues.push({ severity: 'error', code: 'unreachable', detail: e instanceof Error ? e.message : 'falha ao buscar' });
        }

        if (status && status !== 200) issues.push({ severity: 'error', code: 'bad_status', detail: `HTTP ${status}` });
        if (ct && !ct.startsWith('image/')) issues.push({ severity: 'error', code: 'not_image', detail: `Content-Type ${ct}` });

        const modern = !!ct && /(webp|avif)/i.test(ct);
        if (!modern && responsive) {
          issues.push({ severity: 'warn', code: 'legacy_format', detail: `Formato servido: ${ct ?? 'desconhecido'} (esperado WebP/AVIF)` });
        }
        if (bytes > MAX_BYTES) {
          issues.push({ severity: 'warn', code: 'heavy', detail: `${Math.round(bytes / 1024)} KB acima do limite de ${MAX_BYTES / 1024} KB` });
        }

        if (issues.length) {
          reports.push({
            product_id: p.id, product_name: p.name, slug: p.slug, image_url: raw,
            status, content_type: ct, bytes, modern_format: modern, responsive, issues,
          });
        }
      }
    }

    const summary = {
      products: products?.length ?? 0,
      images_checked: (products ?? []).reduce((a, p) => a + Math.min(Array.isArray(p.images) ? p.images.length : 0, 3), 0),
      images_with_issues: reports.length,
      errors: reports.filter((r) => r.issues.some((i) => i.severity === 'error')).length,
      warnings: reports.filter((r) => r.issues.every((i) => i.severity === 'warn')).length,
      pdp_alt_ok: altChecks.filter((a) => a.ok).length,
      pdp_alt_total: altChecks.length,
    };

    return new Response(JSON.stringify({ ran_at: new Date().toISOString(), summary, reports, alt_checks: altChecks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
