// Auditoria SEO por produto (PDP): valida os dados que alimentam
// meta tags, Open Graph/Twitter, JSON-LD (schema.org/Product) e o
// feed do Google Merchant. Somente leitura.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const ORIGIN = 'https://emporiolelecute.com.br'
const PRODUCT_PREFIX = '/produto'

interface Issue { severity: 'error' | 'warn'; code: string; detail: string }
interface ProductReport {
  id: string
  name: string
  slug: string
  url: string
  issues: Issue[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: products, error } = await supabase
      .from('products')
      .select('id,name,slug,seo_title,description,long_description,price,images,is_active,seo_noindex,google_product_category,category_id')
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    const reports: ProductReport[] = []
    const slugSeen = new Map<string, string>()

    for (const p of products ?? []) {
      const issues: Issue[] = []
      const name = String(p.name ?? '')
      const slug = String(p.slug ?? '')
      const images: string[] = Array.isArray(p.images) ? (p.images as string[]) : []
      const desc = String(p.description ?? p.long_description ?? '')
      const title = String((p as { seo_title?: string | null }).seo_title ?? '') || name

      if (!slug) issues.push({ severity: 'error', code: 'slug_missing', detail: 'Produto sem slug — URL não indexável.' })
      else if (slugSeen.has(slug)) issues.push({ severity: 'error', code: 'slug_duplicate', detail: `Slug duplicado com "${slugSeen.get(slug)}".` })
      else slugSeen.set(slug, name)

      if (!/^[a-z0-9-]+$/.test(slug || 'x')) {
        issues.push({ severity: 'warn', code: 'slug_format', detail: 'Slug com caracteres fora de a-z, 0-9 e hífen.' })
      }
      if (title.length < 15) issues.push({ severity: 'warn', code: 'title_short', detail: `Título com ${title.length} caracteres (ideal 30-60).` })
      if (title.length > 65) issues.push({ severity: 'warn', code: 'title_long', detail: `Título com ${title.length} caracteres (ideal até 60). Use a correção em lote no SEO Check.` })
      if (!desc) issues.push({ severity: 'error', code: 'description_missing', detail: 'Sem descrição — meta description e JSON-LD ficam vazios.' })
      else if (desc.length < 70) issues.push({ severity: 'warn', code: 'description_short', detail: `Descrição com ${desc.length} caracteres (ideal 120-160).` })
      if (!images.length) issues.push({ severity: 'error', code: 'image_missing', detail: 'Sem imagem — Merchant Center e og:image quebram.' })
      if (!(Number(p.price) > 0)) issues.push({ severity: 'error', code: 'price_invalid', detail: 'Preço ausente ou zerado — offer inválido no rich result.' })
      if (p.seo_noindex) issues.push({ severity: 'warn', code: 'noindex', detail: 'Produto marcado como noindex — fora do índice do Google.' })
      if (!p.google_product_category) issues.push({ severity: 'warn', code: 'google_category_missing', detail: 'Sem categoria Google — feed usa a categoria padrão da loja.' })
      if (!p.category_id) issues.push({ severity: 'warn', code: 'category_missing', detail: 'Sem categoria — breadcrumb e feed menos precisos.' })

      reports.push({
        id: String(p.id),
        name,
        slug,
        url: `${ORIGIN}${PRODUCT_PREFIX}/${slug}`,
        issues,
      })
    }

    const withIssues = reports.filter((r) => r.issues.length > 0)
    const summary = {
      products: reports.length,
      ok: reports.length - withIssues.length,
      errors: reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === 'error').length, 0),
      warnings: reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === 'warn').length, 0),
      rich_results_ready: reports.filter((r) => !r.issues.some((i) => i.severity === 'error')).length,
    }

    return new Response(
      JSON.stringify({ summary, products: withIssues, ran_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('seo-product-audit error', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
