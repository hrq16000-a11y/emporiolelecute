/**
 * seo-jsonld-autofix
 * ------------------
 * Correção automática em lote das causas de JSON-LD inválido em
 * theme_hub (/tema/:slug) e combination_page.
 *
 * O JSON-LD dessas páginas é derivado das linhas do banco: quando
 * `meta_title` / `meta_description` estão vazios, o Organization/
 * BreadcrumbList renderizado sai sem `name`/`description`, quebrando a
 * validação. Esta função preenche apenas campos VAZIOS (nunca sobrescreve
 * conteúdo editorial existente) e devolve o antes/depois por URL.
 *
 * Requer JWT de admin.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORIGIN = 'https://emporiolelecute.com.br';
const BRAND = 'Empório LeleCute';

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const stripHtml = (v: unknown) => clean(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const titleCase = (slug: string) =>
  slug.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const cut = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

interface FixRow {
  kind: 'theme_hub' | 'combination_page';
  path: string;
  url: string;
  changed: boolean;
  before: Record<string, string>;
  after: Record<string, string>;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // --- Autorização: somente admin ---
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userRes } = await supabase.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let dryRun = false;
    let paths: string[] | null = null;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
      if (Array.isArray(body?.paths) && body.paths.length) paths = body.paths.map(String);
    } catch { /* sem body */ }

    const rows: FixRow[] = [];

    // ---------- theme_hubs ----------
    const { data: hubs, error: hubErr } = await supabase
      .from('theme_hubs')
      .select('id, slug, title, intro, meta_title, meta_description')
      .limit(200);
    if (hubErr) throw hubErr;

    for (const h of hubs ?? []) {
      const path = `/tema/${h.slug}`;
      if (paths && !paths.includes(path)) continue;
      const before = {
        meta_title: clean(h.meta_title),
        meta_description: clean(h.meta_description),
      };
      const name = clean(h.title) || titleCase(String(h.slug ?? ''));
      const after = {
        meta_title: before.meta_title || cut(`${name} | ${BRAND}`, 60),
        meta_description:
          before.meta_description ||
          cut(
            stripHtml(h.intro) ||
              `Descubra ${name.toLowerCase()} no ateliê ${BRAND}, em Curitiba: papelaria e sabonetes artesanais feitos à mão.`,
            158,
          ),
      };
      const changed =
        after.meta_title !== before.meta_title || after.meta_description !== before.meta_description;

      if (changed && !dryRun) {
        const { error } = await supabase.from('theme_hubs').update(after).eq('id', h.id);
        if (error) {
          rows.push({ kind: 'theme_hub', path, url: `${ORIGIN}${path}`, changed: false, before, after, error: error.message });
          continue;
        }
      }
      rows.push({ kind: 'theme_hub', path, url: `${ORIGIN}${path}`, changed, before, after });
    }

    // ---------- combination_pages_registry ----------
    const { data: combos, error: comboErr } = await supabase
      .from('combination_pages_registry')
      .select('id, path, primary_slug, secondary_slug, editorial_content, meta_title, meta_description')
      .limit(200);
    if (comboErr) throw comboErr;

    for (const c of combos ?? []) {
      const path = clean(c.path);
      if (!path.startsWith('/')) continue;
      if (paths && !paths.includes(path)) continue;
      const before = {
        meta_title: clean(c.meta_title),
        meta_description: clean(c.meta_description),
      };
      const label = [c.primary_slug, c.secondary_slug].filter(Boolean).map((s) => titleCase(String(s))).join(' · ')
        || titleCase(path.replace(/^\//, '').replace(/\//g, '-'));
      const after = {
        meta_title: before.meta_title || cut(`${label} | ${BRAND}`, 60),
        meta_description:
          before.meta_description ||
          cut(
            stripHtml(c.editorial_content) ||
              `${label}: seleção artesanal do ateliê ${BRAND} em Curitiba, com envio para todo o Brasil.`,
            158,
          ),
      };
      const changed =
        after.meta_title !== before.meta_title || after.meta_description !== before.meta_description;

      if (changed && !dryRun) {
        const { error } = await supabase.from('combination_pages_registry').update(after).eq('id', c.id);
        if (error) {
          rows.push({ kind: 'combination_page', path, url: `${ORIGIN}${path}`, changed: false, before, after, error: error.message });
          continue;
        }
      }
      rows.push({ kind: 'combination_page', path, url: `${ORIGIN}${path}`, changed, before, after });
    }

    const applied = rows.filter((r) => r.changed).length;
    const failed = rows.filter((r) => r.error).length;

    await supabase.from('seo_submission_log').insert({
      channel: 'jsonld-autofix',
      status: dryRun ? `dry-run (${applied})` : `applied (${applied})`,
      ok: failed === 0,
      url_count: rows.length,
      target: ORIGIN,
      detail: {
        dry_run: dryRun,
        applied,
        failed,
        changes: rows.filter((r) => r.changed || r.error).slice(0, 50),
      },
    });

    return new Response(
      JSON.stringify({
        ran_at: new Date().toISOString(),
        dry_run: dryRun,
        summary: { evaluated: rows.length, applied, failed },
        rows,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('seo-jsonld-autofix error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
