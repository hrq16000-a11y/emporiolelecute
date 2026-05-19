import { Helmet } from 'react-helmet-async';
import { urls, CANONICAL_ORIGIN } from '@/lib/urls';

interface ItemListProduct {
  name: string;
  description: string;
  image: string;
  price: number;
  slug: string;
}

interface ItemListStructuredDataProps {
  products: ItemListProduct[];
  listName?: string;
}

const ItemListStructuredData = ({ products, listName = "Produtos em Destaque" }: ItemListStructuredDataProps) => {
  if (!products || products.length === 0) return null;

  // Calculate priceValidUntil - one year from now in YYYY-MM-DD format
  const priceValidUntil = new Date();
  priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);
  const priceValidUntilStr = priceValidUntil.toISOString().split('T')[0];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": listName,
    "numberOfItems": products.length,
    "itemListElement": products.map((product, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Product",
        "name": product.name,
        "description": product.description,
        "image": product.image,
        "url": urls.productCanonical(product.slug),
        "sku": product.slug,
        "brand": {
          "@type": "Brand",
          "name": "Empório LeleCute"
        },
        "offers": {
          "@type": "Offer",
          "url": urls.productCanonical(product.slug),
          "priceCurrency": "BRL",
          "price": Number(Number(product.price).toFixed(2)),
          "priceValidUntil": priceValidUntilStr,
          "availability": "https://schema.org/InStock",
          "itemCondition": "https://schema.org/NewCondition",
          "seller": {
            "@type": "Organization",
            "name": "Empório LeleCute"
          }
        }
      }
    }))
  };

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
