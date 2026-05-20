import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  CANONICAL_ORIGIN,
  PRODUCT_PATH_PREFIX,
  productAbsolute,
} from '../_shared/urls.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = CANONICAL_ORIGIN

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting sitemap generation...')
    
    // Parse request body for notification settings
    let sendNotification = false
    let notificationEmail = ''
    
    try {
      const body = await req.json()
      sendNotification = body?.sendNotification || false
      notificationEmail = body?.notificationEmail || ''
    } catch {
      // No body or invalid JSON, continue without notification
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Fetch SEO settings
    const { data: seoData } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'seo_config')
      .single()
    
    const seoConfig = seoData?.value as { canonical_url?: string } | null
    const siteUrl = seoConfig?.canonical_url || SITE_URL
    
    // Fetch all active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('slug, name, images, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
    
    if (productsError) {
      console.error('Error fetching products:', productsError)
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }
    
    console.log(`Found ${products?.length || 0} active products`)
    
    // Fetch all occasions (apenas indexáveis E publicadas — Bloco 3 SAFE)
    const { data: occasions, error: occasionsError } = await supabase
      .from('occasions')
      .select('slug, name, is_indexed')
      .eq('is_indexed', true)
      .eq('is_draft', false)
    
    if (occasionsError) {
      console.error('Error fetching occasions:', occasionsError)
    }
    
    // Fetch all categories (apenas indexáveis E publicadas)
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('slug, name, is_indexed')
      .eq('is_indexed', true)
      .eq('is_draft', false)
    
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
    }

    // Fetch all segments (apenas indexáveis E publicados)
    const { data: segments, error: segmentsError } = await supabase
      .from('segments')
      .select('slug, name, is_indexed')
      .eq('is_indexed', true)
      .eq('is_draft', false)

    // Fase 6 — Contagem de produtos por taxonomia (para excluir órfãos)
    const [catProductsRes, occProductsRes, segProductsRes] = await Promise.all([
      supabase.from('products').select('category_id').eq('is_active', true),
      supabase.from('product_occasions').select('occasion_id'),
      supabase.from('product_segments').select('segment_id'),
    ])
    const catCount = new Map<string, number>()
    ;(catProductsRes.data ?? []).forEach((r: { category_id: string | null }) => {
      if (r.category_id) catCount.set(r.category_id, (catCount.get(r.category_id) ?? 0) + 1)
    })
    const occCount = new Map<string, number>()
    ;(occProductsRes.data ?? []).forEach((r: { occasion_id: string | null }) => {
      if (r.occasion_id) occCount.set(r.occasion_id, (occCount.get(r.occasion_id) ?? 0) + 1)
    })
    const segCount = new Map<string, number>()
    ;(segProductsRes.data ?? []).forEach((r: { segment_id: string | null }) => {
      if (r.segment_id) segCount.set(r.segment_id, (segCount.get(r.segment_id) ?? 0) + 1)
    })

    // Re-fetch taxonomies WITH id para correlacionar com counts (mesmas travas SAFE)
    const { data: catRows } = await supabase
      .from('categories').select('id, slug, is_indexed').eq('is_indexed', true).eq('is_draft', false)
    const { data: occRows } = await supabase
      .from('occasions').select('id, slug, is_indexed').eq('is_indexed', true).eq('is_draft', false)
    const { data: segRows } = await supabase
      .from('segments').select('id, slug, is_indexed').eq('is_indexed', true).eq('is_draft', false)

    const today = new Date().toISOString().split('T')[0]

    // Fase 9 — Posts editoriais do banco (apenas indexáveis e publicados)
    const { data: dbBlogPosts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('is_published', true)
      .eq('is_indexed', true)
      .limit(500);
    const dbBlogPostsXml = (dbBlogPosts || []).map((p: { slug: string; updated_at: string }) => `  <url>
    <loc>${siteUrl}/blog/${p.slug}</loc>
    <lastmod>${(p.updated_at || '').split('T')[0] || today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');

    // ============================================================
    // Fase 10.5 — SAFE MODE
    // only ultra-qualified semantic pages may enter sitemap
    // gates duros: approved + indexed + readiness>=75 + topical>=60
    //              + !thin + cannibal!=high + !manipulation
    //              + internal_links>=3 + authority>=80 + products>=8
    //              + editorial>=500 + faqs>=2
    // ============================================================
    const isHighGate = (e: any, kind: 'theme' | 'combination'): boolean => {
      if (!e) return false;
      if (e.thin_content_risk) return false;
      if (e.cannibalization_risk === 'high') return false;
      if (e.authority_manipulation === true) return false;
      if ((e.readiness_score ?? 0) < 75) return false;
      if ((e.topical_coverage ?? 0) < 60) return false;
      if ((e.authority_score ?? e.quality_score ?? 0) < 80) return false;
      if ((e.internal_links_count ?? 0) < 3) return false;
      if (kind === 'theme') {
        if (e.is_approved !== true) return false;
        if (e.is_indexed !== true) return false;
        // editorial + faq gates (theme)
        const editorialLen = (e.editorial_content ?? '').length;
        const faqCount = Array.isArray(e.faqs) ? e.faqs.length : 0;
        if (editorialLen < 500) return false;
        if (faqCount < 2) return false;
      } else {
        if (e.discovery_status !== 'approved') return false;
        if (e.is_indexable !== true) return false;
        if ((e.products_count ?? 0) < 8) return false;
        const editorialLen = (e.editorial_content ?? '').length;
        const faqCount = Array.isArray(e.faqs) ? e.faqs.length : 0;
        if (editorialLen < 500) return false;
        if (faqCount < 2) return false;
      }
      return true;
    };

    const { data: themeHubs } = await supabase
      .from('theme_hubs')
      .select('slug, updated_at, is_approved, is_indexed, readiness_score, topical_coverage, authority_score, internal_links_count, thin_content_risk, cannibalization_risk, authority_manipulation, editorial_content, faqs')
      .limit(500);
    const themeHubsXml = (themeHubs ?? [])
      .filter((h: any) => isHighGate(h, 'theme'))
      .map((h: any) => `  <url>
    <loc>${siteUrl}/tema/${h.slug}</loc>
    <lastmod>${(h.updated_at || '').split('T')[0] || today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>`).join('\n');

    const { data: comboPages } = await supabase
      .from('combination_pages_registry')
      .select('path, updated_at, discovery_status, is_indexable, readiness_score, topical_coverage, quality_score, products_count, internal_links_count, thin_content_risk, cannibalization_risk, authority_manipulation, editorial_content, faqs')
      .limit(500);
    const comboPagesXml = (comboPages ?? [])
      .filter((c: any) => isHighGate(c, 'combination'))
      .map((c: any) => `  <url>
    <loc>${siteUrl}${c.path}</loc>
    <lastmod>${(c.updated_at || '').split('T')[0] || today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.70</priority>
  </url>`).join('\n');

    // Generate sitemap XML
    // Fase 2.1b — metadata operacional para materialização auditável.
    // Marcadores `lovable:sitemap-source` permitem ao script/test confirmar
    // que `public/sitemap.xml` foi gerado por esta função (anti-drift).
    const generatedAt = new Date().toISOString()
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- lovable:sitemap-source generate-sitemap@v2.1b -->
<!-- lovable:sitemap-generated-at ${generatedAt} -->
<!-- lovable:sitemap-namespace ${PRODUCT_PATH_PREFIX} -->
<!-- lovable:sitemap-products-count ${products?.length ?? 0} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  
  <!-- Homepage -->
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Products Catalog -->
  <url>
    <loc>${siteUrl}${PRODUCT_PATH_PREFIX}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  
  <!-- Individual Product Pages -->
`
    
    // Add products (prioridade 0.7)
    if (products && products.length > 0) {
      for (const product of products) {
        const lastmod = product.updated_at 
          ? new Date(product.updated_at).toISOString().split('T')[0]
          : today
        
        sitemap += `  <url>
    <loc>${productAbsolute(product.slug, siteUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>`
        
        // Add image if available
        if (product.images && product.images.length > 0) {
          const imageUrl = product.images[0]
          const escapedName = escapeXml(product.name)
          sitemap += `
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapedName}</image:title>
    </image:image>`
        }
        
        sitemap += `
  </url>
`
      }
    }

    // Helper: emit taxonomy URL block, skipping orphans
    const emitTaxonomies = (
      rows: { id: string; slug: string }[] | null | undefined,
      prefix: string,
      counts: Map<string, number>,
      priority: string,
      changefreq: string,
    ) => {
      let out = ''
      let kept = 0
      ;(rows ?? []).forEach((r) => {
        const n = counts.get(r.id) ?? 0
        if (n === 0) return // exclui órfãos
        kept++
        out += `  <url>
    <loc>${siteUrl}${prefix}/${r.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
`
      })
      return { xml: out, kept }
    }

    const catBlock = emitTaxonomies(catRows, '/categoria', catCount, '0.9', 'weekly')
    const occBlock = emitTaxonomies(occRows, '/ocasiao',   occCount, '0.8', 'weekly')
    const segBlock = emitTaxonomies(segRows, '/segmento',  segCount, '0.8', 'weekly')
    sitemap += catBlock.xml + occBlock.xml + segBlock.xml
    
    // Fetch dynamic pages
    const { data: dynamicPages } = await supabase
      .from('pages')
      .select('slug, updated_at')
      .eq('status', 'published')
    
    // Add dynamic pages
    if (dynamicPages && dynamicPages.length > 0) {
      sitemap += `\n  <!-- Dynamic Pages -->\n`
      for (const page of dynamicPages) {
        const lastmod = page.updated_at 
          ? new Date(page.updated_at).toISOString().split('T')[0]
          : today
        sitemap += `  <url>
    <loc>${siteUrl}/${page.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`
      }
    }
    
    // Fase 3.3 — URLs legadas /lembrancinhas-* removidas do sitemap.
    // Conteúdo SEO consolidado em /ocasiao/:slug; URLs antigas respondem via redirect 301
    // (tabela `redirects`). Bloco mantido como comentário para reversibilidade documental.

    // Add static pages (removed anchor URLs which Google doesn't index)
    sitemap += `
  <!-- Static Pages -->
  <url>
    <loc>${siteUrl}/loja</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>${siteUrl}/envio</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${siteUrl}/sobre</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>${siteUrl}/contato</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>${siteUrl}/depoimentos</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>${siteUrl}/rastrear</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  
  <url>
    <loc>${siteUrl}/ocasioes</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${siteUrl}/orcamento</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>${siteUrl}/blog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
${[
  'como-fazer-sabonete-artesanal-para-lembrancinhas',
  'lembrancinhas-maternidade-ideias-criativas',
  'cha-de-bebe-e-cha-revelacao-lembrancinhas',
  'lembrancinhas-batizado-aniversario-formatura',
].map((s) => `  <url>
    <loc>${siteUrl}/blog/${s}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
${dbBlogPostsXml}
${themeHubsXml}
${comboPagesXml}

</urlset>`
    
    const totalUrls = (products?.length || 0) + catBlock.kept + occBlock.kept + segBlock.kept + (dynamicPages?.length || 0) + 9
    console.log('Sitemap generated successfully')
    console.log(`Total URLs: ${totalUrls} (cats=${catBlock.kept}, occs=${occBlock.kept}, segs=${segBlock.kept})`)
    
    // Update last sitemap generation time
    await supabase
      .from('store_settings')
      .upsert({
        key: 'last_sitemap_update',
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      })
    
    // Send email notification if configured
    if (sendNotification && notificationEmail) {
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY')
        if (resendKey) {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: 'Empório LeleCute <noreply@emporiolelecute.com.br>',
              to: [notificationEmail],
              subject: 'Sitemap Atualizado - Empório LeleCute',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #F87C6D;">Sitemap Atualizado</h2>
                  <p>O sitemap do site foi atualizado com sucesso.</p>
                  <ul>
                    <li><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</li>
                    <li><strong>Total de URLs:</strong> ${totalUrls}</li>
                    <li><strong>Produtos:</strong> ${products?.length || 0}</li>
                    <li><strong>Ocasiões:</strong> ${occasions?.length || 0}</li>
                    <li><strong>Categorias:</strong> ${categories?.length || 0}</li>
                  </ul>
                  <p>
                    <a href="${siteUrl}/sitemap.xml" style="color: #F87C6D;">
                      Ver Sitemap
                    </a>
                  </p>
                </div>
              `,
            }),
          })
          
          if (!emailResponse.ok) {
            console.error('Failed to send notification email:', await emailResponse.text())
          } else {
            console.log('Notification email sent successfully')
          }
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError)
      }
    }
    
    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    })
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error generating sitemap:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
