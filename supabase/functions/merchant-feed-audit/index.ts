// Validação automática do feed do Google Merchant (Shopping).
// Busca o XML gerado por `merchant-feed` e aplica as regras do Merchant Center
// item a item, retornando erros/avisos por produto. Somente leitura.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

interface Issue { severity: 'error' | 'warn'; code: string; detail: string }
interface ItemReport {
  id: string; title: string; link: string; issues: Issue[]
  images: string[]; https_images: number; price: string; availability: string
}
interface FeedDiff {
  previous_at: string | null
  added: string[]
  removed: string[]
  changed: { id: string; title: string; fields: string[] }[]
}

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? decode(m[1].trim()) : null
}
const tagAll = (xml: string, name: string): string[] =>
  [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => decode(m[1].trim()))

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const isHttps = (u: string | null) => !!u && /^https:\/\//i.test(u)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const feedUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/merchant-feed?format=xml`
    const res = await fetch(feedUrl, {
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    })

    if (!res.ok) {
      const body = await res.text()
      return new Response(
        JSON.stringify({ error: `Feed indisponível [${res.status}]`, details: body.slice(0, 500) }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const xml = await res.text()
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])

    const reports: ItemReport[] = []
    const idSeen = new Set<string>()
    const titleSeen = new Map<string, string>()

    for (const item of items) {
      const issues: Issue[] = []
      const id = tag(item, 'g:id') ?? ''
      const title = tag(item, 'g:title') ?? ''
      const description = tag(item, 'g:description') ?? ''
      const link = tag(item, 'g:link') ?? ''
      const image = tag(item, 'g:image_link')
      const extraImages = tagAll(item, 'g:additional_image_link')
      const price = tag(item, 'g:price') ?? ''
      const salePrice = tag(item, 'g:sale_price')
      const availability = tag(item, 'g:availability') ?? ''
      const condition = tag(item, 'g:condition') ?? ''
      const brand = tag(item, 'g:brand') ?? ''
      const gcat = tag(item, 'g:google_product_category') ?? ''
      const ptype = tag(item, 'g:product_type') ?? ''
      const mpn = tag(item, 'g:mpn') ?? ''

      if (!id) issues.push({ severity: 'error', code: 'id_missing', detail: 'Item sem g:id — Google rejeita o produto.' })
      else if (idSeen.has(id)) issues.push({ severity: 'error', code: 'id_duplicate', detail: `g:id duplicado (${id}).` })
      else idSeen.add(id)

      if (!title) issues.push({ severity: 'error', code: 'title_missing', detail: 'Sem g:title.' })
      else {
        if (title.length > 150) issues.push({ severity: 'error', code: 'title_too_long', detail: `Título com ${title.length} caracteres (máx. 150).` })
        if (title.length < 20) issues.push({ severity: 'warn', code: 'title_short', detail: `Título curto (${title.length} caracteres) — ideal 30 a 70.` })
        if (title === title.toUpperCase() && /[A-Z]{5,}/.test(title)) {
          issues.push({ severity: 'warn', code: 'title_caps', detail: 'Título todo em maiúsculas — o Merchant Center penaliza.' })
        }
        const dup = titleSeen.get(title.toLowerCase())
        if (dup && dup !== id) issues.push({ severity: 'warn', code: 'title_duplicate', detail: 'Título idêntico ao de outro item do feed.' })
        else titleSeen.set(title.toLowerCase(), id)
      }

      if (!description) issues.push({ severity: 'error', code: 'description_missing', detail: 'Sem g:description.' })
      else {
        if (description.length > 5000) issues.push({ severity: 'error', code: 'description_too_long', detail: `Descrição com ${description.length} caracteres (máx. 5000).` })
        if (description.length < 100) issues.push({ severity: 'warn', code: 'description_short', detail: `Descrição com ${description.length} caracteres — ideal acima de 150.` })
        if (/<[a-z][\s\S]*>/i.test(description)) issues.push({ severity: 'warn', code: 'description_html', detail: 'Descrição contém HTML — remova as tags.' })
      }

      if (!isHttps(link)) issues.push({ severity: 'error', code: 'link_invalid', detail: 'g:link ausente ou fora de HTTPS absoluto.' })
      if (!isHttps(image)) issues.push({ severity: 'error', code: 'image_invalid', detail: 'g:image_link ausente ou fora de HTTPS absoluto.' })
      else if (/placeholder/i.test(image!)) issues.push({ severity: 'error', code: 'image_placeholder', detail: 'Imagem principal é o placeholder da loja.' })
      const httpsImages = [image, ...extraImages].filter((u): u is string => isHttps(u))
      if (httpsImages.length < 2) {
        issues.push({
          severity: 'error',
          code: 'image_insufficient',
          detail: `Apenas ${httpsImages.length} imagem HTTPS válida — o Merchant Center exige no mínimo 2. Faltam ${2 - httpsImages.length} imagem(ns).`,
        })
      } else if (httpsImages.length < 3) {
        issues.push({ severity: 'warn', code: 'image_few', detail: '2 imagens — anúncios convertem mais com 3 ou mais.' })
      }
      if (extraImages.some((u) => !isHttps(u))) issues.push({ severity: 'warn', code: 'image_extra_invalid', detail: 'Alguma imagem adicional não é HTTPS absoluta.' })

      const priceValue = Number.parseFloat(price)
      if (!/^\d+\.\d{2} [A-Z]{3}$/.test(price) || !(priceValue > 0)) {
        issues.push({ severity: 'error', code: 'price_invalid', detail: `g:price inválido ("${price}") — use "12.90 BRL".` })
      }
      if (salePrice) {
        const saleValue = Number.parseFloat(salePrice)
        if (!(saleValue > 0) || saleValue > priceValue) {
          issues.push({ severity: 'error', code: 'sale_price_invalid', detail: 'g:sale_price maior que g:price ou inválido.' })
        }
      }

      if (!['in_stock', 'out_of_stock', 'preorder', 'backorder'].includes(availability)) {
        issues.push({ severity: 'error', code: 'availability_invalid', detail: `Disponibilidade inválida ("${availability}").` })
      }
      if (!['new', 'refurbished', 'used'].includes(condition)) {
        issues.push({ severity: 'error', code: 'condition_invalid', detail: `Condição inválida ("${condition}").` })
      }
      if (!brand) issues.push({ severity: 'error', code: 'brand_missing', detail: 'Sem g:brand.' })
      if (!mpn) issues.push({ severity: 'warn', code: 'mpn_missing', detail: 'Sem g:mpn — com identifier_exists=no o Google exige marca + MPN.' })

      if (!gcat) issues.push({ severity: 'warn', code: 'google_category_missing', detail: 'Sem g:google_product_category.' })
      else if (!gcat.includes('>')) issues.push({ severity: 'warn', code: 'google_category_shallow', detail: 'Categoria Google genérica — use o caminho completo da taxonomia.' })
      if (!ptype) issues.push({ severity: 'warn', code: 'product_type_missing', detail: 'Sem g:product_type — perde segmentação no Performance Max.' })

      reports.push({
        id, title, link, issues,
        images: [image, ...extraImages].filter((u): u is string => !!u),
        https_images: [image, ...extraImages].filter((u): u is string => isHttps(u)).length,
        price, availability,
      })
    }

    const withIssues = reports.filter((r) => r.issues.length > 0)
    const blocked = reports.filter((r) => r.issues.some((i) => i.severity === 'error'))
    const summary = {
      items: reports.length,
      ok: reports.length - withIssues.length,
      errors: reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === 'error').length, 0),
      warnings: reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === 'warn').length, 0),
      ready_to_upload: reports.length - blocked.length,
      blocked: blocked.length,
      missing_images: reports.filter((r) => r.https_images < 2).length,
      feed_bytes: xml.length,
    }

    // --- Histórico e diff do feed ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const fingerprint = reports.map((r) => ({
      id: r.id, title: r.title, price: r.price, availability: r.availability,
      link: r.link, images: r.images.length,
    }))
    const checksum = [...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fingerprint))),
    )].map((b) => b.toString(16).padStart(2, '0')).join('')

    const { data: prevRow } = await supabase
      .from('merchant_feed_snapshots')
      .select('created_at, items, checksum')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const diff: FeedDiff = { previous_at: prevRow?.created_at ?? null, added: [], removed: [], changed: [] }
    if (prevRow?.items) {
      const prevItems = (prevRow.items as typeof fingerprint) ?? []
      const prevMap = new Map(prevItems.map((i) => [i.id, i]))
      const currMap = new Map(fingerprint.map((i) => [i.id, i]))
      for (const [id, curr] of currMap) {
        const prev = prevMap.get(id)
        if (!prev) { diff.added.push(curr.title || id); continue }
        const fields: string[] = []
        if (prev.title !== curr.title) fields.push(`título: "${prev.title}" → "${curr.title}"`)
        if (prev.price !== curr.price) fields.push(`preço: ${prev.price} → ${curr.price}`)
        if (prev.availability !== curr.availability) fields.push(`disponibilidade: ${prev.availability} → ${curr.availability}`)
        if (prev.link !== curr.link) fields.push('link alterado')
        if (prev.images !== curr.images) fields.push(`imagens: ${prev.images} → ${curr.images}`)
        if (fields.length) diff.changed.push({ id, title: curr.title || id, fields })
      }
      for (const [id, prev] of prevMap) {
        if (!currMap.has(id)) diff.removed.push(prev.title || id)
      }
    }

    const unchanged = prevRow?.checksum === checksum
    if (!unchanged) {
      await supabase.from('merchant_feed_snapshots').insert({
        item_count: summary.items,
        errors: summary.errors,
        warnings: summary.warnings,
        ready: summary.ready_to_upload,
        checksum,
        items: fingerprint,
      })
    }

    return new Response(
      JSON.stringify({
        summary,
        items: withIssues,
        diff: { ...diff, unchanged },
        upload_allowed: blocked.length === 0,
        feed_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/merchant-feed`,
        ran_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('merchant-feed-audit error', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
