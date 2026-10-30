/**
 * Smoke test da geração de sitemap.
 *
 * Objetivo: detectar ANTES do deploy (a) colunas ausentes no schema e
 * (b) queries quebradas, que antes derrubavam o sitemap inteiro em produção.
 *
 * Como rodar:
 *   deno test -A supabase/functions/_tests/generate_sitemap_smoke_test.ts
 *
 * Requer no .env: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * (sem service key o teste roda apenas a verificação do endpoint público).
 */
import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resilientSelect } from '../_shared/resilientSelect.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') ?? '';

/** Espelha exatamente as colunas lidas por generate-sitemap/index.ts */
const EXPECTED: Record<string, string[]> = {
  products: ['slug', 'name', 'images', 'updated_at', 'is_active'],
  categories: ['id', 'slug', 'is_indexed', 'is_draft'],
  occasions: ['id', 'slug', 'is_indexed', 'is_draft'],
  segments: ['id', 'slug', 'is_indexed', 'is_draft'],
  product_occasions: ['occasion_id'],
  product_segments: ['segment_id'],
  blog_posts: ['slug', 'updated_at', 'is_published', 'is_indexed'],
  pages: ['slug', 'updated_at', 'status'],
  theme_hubs: [
    'slug', 'updated_at', 'is_approved', 'is_indexed', 'readiness_score', 'topical_coverage',
    'authority_score', 'internal_links_count', 'thin_content_risk', 'cannibalization_risk',
    'editorial_content', 'faqs',
  ],
  combination_pages_registry: [
    'path', 'updated_at', 'discovery_status', 'is_indexable', 'readiness_score', 'topical_coverage',
    'quality_score', 'products_count', 'internal_links_count', 'thin_content_risk',
    'cannibalization_risk', 'editorial_content', 'faqs',
  ],
};

Deno.test({
  name: 'sitemap: todas as colunas esperadas existem no schema',
  ignore: !SERVICE_KEY,
  fn: async () => {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const problems: string[] = [];

    for (const [table, columns] of Object.entries(EXPECTED)) {
      const { diagnostic } = await resilientSelect(supabase, table, columns, (q: unknown) =>
        (q as { limit: (n: number) => unknown }).limit(1));
      if (!diagnostic.ok) problems.push(`${table}: query falhou -> ${diagnostic.error}`);
      if (diagnostic.missing_columns.length) {
        problems.push(`${table}: colunas ausentes -> ${diagnostic.missing_columns.join(', ')}`);
      }
    }

    assert(problems.length === 0, `Drift de schema detectado:\n- ${problems.join('\n- ')}`);
  },
});

Deno.test({
  name: 'sitemap: função responde com XML válido e sem falhas de query',
  ignore: !ANON_KEY && !SERVICE_KEY,
  fn: async () => {
    const key = SERVICE_KEY || ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-sitemap?diagnostics=1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await res.json();
    assert(res.ok, `HTTP ${res.status}`);
    assert(body.ok === true, `Falhas: ${JSON.stringify(body.failure_summary)}`);
    assert((body.total_urls ?? 0) > 0, 'sitemap sem URLs');
  },
});
