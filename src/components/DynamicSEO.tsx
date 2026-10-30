import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useSEOConfig } from '@/hooks/useStoreSettings';

interface DynamicSEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  /** Metadados de produto para Open Graph / Merchant (product namespace). */
  product?: {
    price?: number;
    currency?: string;
    availability?: 'in stock' | 'out of stock' | 'preorder';
    brand?: string;
    condition?: 'new' | 'refurbished' | 'used';
    sku?: string;
    category?: string;
  };
}

const SITE_ORIGIN = 'https://emporiolelecute.com.br';

const buildCanonical = (pathname: string) => {
  // Strip trailing slash (except root) to enforce single preferred URL — no query/hash
  const clean = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
  return `${SITE_ORIGIN}${clean}`;
};

const DynamicSEO = ({ title, description, image, url, type = 'website', product }: DynamicSEOProps) => {
  const { data: seoConfig, isLoading } = useSEOConfig();
  const location = useLocation();

  if (isLoading || !seoConfig) {
    return null;
  }

  const pageTitle = title || seoConfig.site_title;
  const pageDescription = description || seoConfig.site_description;
  const pageImage = image || seoConfig.og_image;
  const pageUrl = url || buildCanonical(location.pathname);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={seoConfig.site_keywords} />
      <link rel="canonical" href={pageUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:site_name" content="Empório LeleCute" />
      
      {seoConfig.facebook_app_id && (
        <meta property="fb:app_id" content={seoConfig.facebook_app_id} />
      )}

      {/* Product Open Graph (previews e anúncios de Shopping) */}
      {product && (
        <meta property="product:price:amount" content={String(Number(product.price ?? 0).toFixed(2))} />
      )}
      {product && <meta property="product:price:currency" content={product.currency || 'BRL'} />}
      {product && <meta property="product:availability" content={product.availability || 'in stock'} />}
      {product && <meta property="product:condition" content={product.condition || 'new'} />}
      {product?.brand && <meta property="product:brand" content={product.brand} />}
      {product?.sku && <meta property="product:retailer_item_id" content={product.sku} />}
      {product?.category && <meta property="product:category" content={product.category} />}
      {product && <meta name="twitter:label1" content="Preço" />}
      {product && (
        <meta
          name="twitter:data1"
          content={Number(product.price ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        />
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={pageUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />
      {seoConfig.twitter_handle && (
        <meta name="twitter:site" content={seoConfig.twitter_handle} />
      )}

      {/* Search Console Verification */}
      {seoConfig.google_verification && (
        <meta name="google-site-verification" content={seoConfig.google_verification} />
      )}
      {seoConfig.bing_verification && (
        <meta name="msvalidate.01" content={seoConfig.bing_verification} />
      )}
    </Helmet>
  );
};

export default DynamicSEO;
