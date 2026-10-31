import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CANONICAL_ORIGIN, productAbsolute } from '../_shared/urls.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = CANONICAL_ORIGIN
const BRAND = 'Empório LeleCute'

// Default Google Product Category for handmade/artisan products
const DEFAULT_GOOGLE_CATEGORY = 'Arts & Entertainment > Party & Celebration > Gift Giving > Party Favors'
const DEFAULT_GOOGLE_CATEGORY_ID = '5709'

interface Category {
  name: string
  slug: string
  google_product_category?: string | null
}

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  long_description: string | null
  price: number
  original_price: number | null
  images: string[] | null
  is_active: boolean
  category_id: string | null
  google_product_category: string | null
  production_days: number | null
  weight: number | null
  updated_at: string
  categories?: Category | Category[] | null
}

interface MerchantFeedConfig {
  google_product_category: string
  google_product_category_id: string
  shipping_country: string
  shipping_price: number
  shipping_service: string
  currency: string
  language: string
  tax_included: boolean
}

const defaultFeedConfig: MerchantFeedConfig = {
  google_product_category: DEFAULT_GOOGLE_CATEGORY,
  google_product_category_id: DEFAULT_GOOGLE_CATEGORY_ID,
  shipping_country: 'BR',
  shipping_price: 0, // 0 means calculated separately
  shipping_service: 'Standard',
  currency: 'BRL',
  language: 'pt-BR',
  tax_included: true,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const format = url.searchParams.get('format') || 'xml'
    
    console.log(`Generating merchant feed in ${format} format...`)
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Fetch feed configuration from store_settings
    const { data: feedConfigData } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'merchant_feed_config')
      .single()
    
    const feedConfig: MerchantFeedConfig = {
      ...defaultFeedConfig,
      ...(feedConfigData?.value as Partial<MerchantFeedConfig> || {}),
    }
    
    // Fetch SEO settings for canonical URL
    const { data: seoData } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'seo_config')
      .single()
    
    const seoConfig = seoData?.value as { canonical_url?: string } | null
    const siteUrl = seoConfig?.canonical_url || SITE_URL
    
    // Fetch all active products with category
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        description,
        long_description,
        price,
        original_price,
        images,
        is_active,
        category_id,
        google_product_category,
        production_days,
        weight,
        updated_at,
        categories (
          name,
          slug,
          google_product_category
        )
      `)
      .eq('is_active', true)
      .gt('price', 0)
      .order('updated_at', { ascending: false })
    
    if (productsError) {
      console.error('Error fetching products:', productsError)
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }
    
    console.log(`Found ${products?.length || 0} active products for merchant feed`)
    
    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No products found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Generate feed based on format
    if (format === 'json') {
      const jsonFeed = generateJsonFeed(products as Product[], feedConfig, siteUrl)
      return new Response(JSON.stringify(jsonFeed, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } else {
      const xmlFeed = generateXmlFeed(products as Product[], feedConfig, siteUrl)
      return new Response(xmlFeed, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error generating merchant feed:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function generateJsonFeed(products: Product[], config: MerchantFeedConfig, siteUrl: string): object {
  return {
    feed_info: {
      title: `${BRAND} - Google Merchant Feed`,
      link: siteUrl,
      description: 'Lembrancinhas personalizadas artesanais para todas as ocasiões especiais',
      language: config.language,
      currency: config.currency,
      country: config.shipping_country,
      generated_at: new Date().toISOString(),
      total_items: products.length,
    },
    products: products.map((product) => formatProductForFeed(product, config, siteUrl)),
  }
}

function generateXmlFeed(products: Product[], config: MerchantFeedConfig, siteUrl: string): string {
  const today = new Date().toISOString()
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(BRAND)} - Google Merchant Feed</title>
    <link>${siteUrl}</link>
    <description>Lembrancinhas personalizadas artesanais para todas as ocasiões especiais</description>
    <lastBuildDate>${today}</lastBuildDate>
`

  for (const product of products) {
    const formattedProduct = formatProductForFeed(product, config, siteUrl)
    
    xml += `    <item>
      <g:id>${escapeXml(formattedProduct.id)}</g:id>
      <g:title>${escapeXml(formattedProduct.title)}</g:title>
      <g:description>${escapeXml(formattedProduct.description)}</g:description>
      <g:link>${escapeXml(formattedProduct.link)}</g:link>
      <g:image_link>${escapeXml(formattedProduct.image_link)}</g:image_link>
`
    
    // Add additional images (up to 10)
    if (formattedProduct.additional_image_links && formattedProduct.additional_image_links.length > 0) {
      for (const additionalImage of formattedProduct.additional_image_links.slice(0, 10)) {
        xml += `      <g:additional_image_link>${escapeXml(additionalImage)}</g:additional_image_link>
`
      }
    }
    
    xml += `      <g:availability>${formattedProduct.availability}</g:availability>
      <g:price>${formattedProduct.price}</g:price>
`
    
    if (formattedProduct.sale_price) {
      xml += `      <g:sale_price>${formattedProduct.sale_price}</g:sale_price>
`
    }
    
    xml += `      <g:condition>${formattedProduct.condition}</g:condition>
      <g:brand>${escapeXml(formattedProduct.brand)}</g:brand>
      <g:google_product_category>${escapeXml(formattedProduct.google_product_category)}</g:google_product_category>
      <g:product_type>${escapeXml(formattedProduct.product_type)}</g:product_type>
      <g:identifier_exists>no</g:identifier_exists>
`
    
    // Add MPN (using product slug as unique identifier)
    xml += `      <g:mpn>${escapeXml(formattedProduct.mpn)}</g:mpn>
`
    
    // Add custom labels for Performance Max segmentation
    xml += `      <g:custom_label_0>${escapeXml(formattedProduct.custom_label_0 || '')}</g:custom_label_0>
`
    
    // Add shipping information
    if (config.shipping_price > 0) {
      xml += `      <g:shipping>
        <g:country>${config.shipping_country}</g:country>
        <g:service>${config.shipping_service}</g:service>
        <g:price>${config.shipping_price.toFixed(2)} ${config.currency}</g:price>
      </g:shipping>
`
    }
    
    // Add shipping weight
    if (formattedProduct.shipping_weight) {
      xml += `      <g:shipping_weight>${formattedProduct.shipping_weight}</g:shipping_weight>
`
    }
    
    // Add tax info (taxes included in price for Brazil)
    if (config.tax_included) {
      xml += `      <g:tax>
        <g:country>${config.shipping_country}</g:country>
        <g:tax_ship>no</g:tax_ship>
      </g:tax>
`
    }
    
    xml += `    </item>
`
  }

  xml += `  </channel>
</rss>`

  return xml
}

function formatProductForFeed(product: Product, config: MerchantFeedConfig, siteUrl: string): {
  id: string
  title: string
  description: string
  link: string
  image_link: string
  additional_image_links: string[]
  availability: string
  price: string
  sale_price?: string
  condition: string
  brand: string
  google_product_category: string
  product_type: string
  custom_label_0: string
  shipping_weight?: string
  mpn: string
} {
  // Clean and prepare title (max 150 chars for Google)
  const title = cleanText(product.name).substring(0, 150)
  
  // Clean and prepare description (max 5000 chars, but aim for quality)
  let description = ''
  if (product.long_description) {
    description = cleanText(stripHtml(product.long_description))
  } else if (product.description) {
    description = cleanText(product.description)
  } else {
    description = `${title} - Lembrancinha artesanal personalizada da ${BRAND}`
  }
  description = description.substring(0, 5000)
  
  // Ensure minimum description length
  if (description.length < 50) {
    description = `${description}. Produto artesanal feito com carinho pela ${BRAND}. Personalizamos para sua ocasião especial.`
  }
  
  // Get images
  const images = product.images || []
  const mainImage = images.length > 0 ? images[0] : `${siteUrl}/placeholder.svg`
  const additionalImages = images.slice(1, 11) // Google accepts up to 10 additional images
  
  // Calculate prices
  const price = Number(product.price)
  const originalPrice = product.original_price ? Number(product.original_price) : null
  
  // Format prices for Google (with currency)
  const formattedPrice = `${price.toFixed(2)} ${config.currency}`
  let salePrice: string | undefined
  
  // If original_price exists and is higher than current price, current price is the sale price
  if (originalPrice && originalPrice > price) {
    salePrice = formattedPrice
  }
  
  // Get category name for product_type
  const categories = product.categories
  const category = Array.isArray(categories) ? categories[0] : categories
  const categoryName = category?.name || 'Lembrancinhas'
  // Categoria Google: produto > mapeamento da categoria da loja > padrão da loja
  const googleCategory =
    (product.google_product_category && product.google_product_category.trim()) ||
    (category?.google_product_category && category.google_product_category.trim()) ||
    config.google_product_category
  const productType = `Lembrancinhas Personalizadas > ${categoryName}`
  
  // Shipping weight (if available)
  let shippingWeight: string | undefined
  if (product.weight && product.weight > 0) {
    shippingWeight = `${(product.weight / 1000).toFixed(2)} kg`
  }
  
  // Generate MPN from slug (unique product identifier)
  const mpn = `ELC-${product.slug.substring(0, 50).toUpperCase().replace(/[^A-Z0-9]/g, '-')}`
  
  return {
    id: product.id,
    title,
    description,
    link: productAbsolute(product.slug, siteUrl),
    image_link: mainImage,
    additional_image_links: additionalImages,
    availability: 'in_stock',
    price: originalPrice && originalPrice > price ? `${originalPrice.toFixed(2)} ${config.currency}` : formattedPrice,
    sale_price: salePrice,
    condition: 'new',
    brand: BRAND,
    google_product_category: googleCategory,
    product_type: productType,
    custom_label_0: categoryName,
    shipping_weight: shippingWeight,
    mpn,
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
