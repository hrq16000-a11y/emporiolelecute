import { Helmet } from 'react-helmet-async';
import { urls, CANONICAL_ORIGIN } from '@/lib/urls';
import { parseSafePriceMonitored } from '@/lib/safePrice';

interface ItemListProduct {
  name: string;
  description: string;
  image: string;
  /** Pode chegar como string do Supabase (numeric) ou legado "R$ 95,00". */
  price: number | string | null | undefined;
  slug: string;
}

interface ItemListStructuredDataProps {
  products: ItemListProduct[];
  listName?: string;
}

/**
 * Builder PURO do JSON-LD da ItemList (exportado para testes).
 * O campo `price` é OMITIDO quando o valor é inválido — nunca emite NaN.
 */
export function buildItemListJsonLd(
  products: ItemListProduct[],
  listName: string,
  priceValidUntilStr: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": listName,
    "numberOfItems": products.length,
    "itemListElement": products.map((product, index) => {
      const safePrice = parseSafePriceMonitored(product.price, {
        source: 'ItemListStructuredData',
        ref: product.slug,
        field: 'price',
      });
      return {
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Product",
          "name": product.name,
          "description": product.description,
          "image": product.image,
          "url": urls.productCanonical(product.slug),
          "sku": product.slug,
          "brand": { "@type": "Brand", "name": "Empório LeleCute" },
          "offers": {
            "@type": "Offer",
            "url": urls.productCanonical(product.slug),
            "priceCurrency": "BRL",
            ...(safePrice !== null ? { price: safePrice } : {}),
            "priceValidUntil": priceValidUntilStr,
            "availability": "https://schema.org/InStock",
            "itemCondition": "https://schema.org/NewCondition",
            "seller": { "@type": "Organization", "name": "Empório LeleCute" },
          },
        },
      };
    }),
  };
}

const ItemListStructuredData = ({ products, listName = "Produtos em Destaque" }: ItemListStructuredDataProps) => {
  if (!products || products.length === 0) return null;

  // Calculate priceValidUntil - one year from now in YYYY-MM-DD format
  const priceValidUntil = new Date();
  priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);
  const priceValidUntilStr = priceValidUntil.toISOString().split('T')[0];

  const structuredData = buildItemListJsonLd(products, listName, priceValidUntilStr);


  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

// CANONICAL_ORIGIN re-exported para call-sites que precisem usar baseUrl puro.
export { CANONICAL_ORIGIN };
export default ItemListStructuredData;
