import { Helmet } from 'react-helmet-async';
import { urls, CANONICAL_ORIGIN } from '@/lib/urls';

interface ReviewItem {
  author_name: string;
  rating: number;
  comment?: string | null;
  review_date?: string | null;
  source?: string | null;
}

interface ProductStructuredDataProps {
  name: string;
  description: string;
  price: number;
  /** Preço "de" original quando há desconto ativo. */
  originalPrice?: number;
  images: string[];
  slug: string;
  rating?: number;
  reviewCount?: number;
  productionDays?: number;
  category?: string;
  brand?: string;
  /** Optional: array of recent reviews to embed as schema.org Review nodes */
  reviews?: ReviewItem[];
  /** Optional: material/composition (e.g. "Sabonete artesanal vegetal") */
  material?: string;
  /** Optional: explicit SKU/MPN; falls back to slug */
  sku?: string;
}

const ProductStructuredData = ({
  name,
  description,
  price,
  images,
  slug,
  rating,
  reviewCount,
  productionDays = 7,
  category = "Lembrancinhas Artesanais",
  brand = "Empório LeleCute",
  reviews,
  material,
  sku,
}: ProductStructuredDataProps) => {
  const baseUrl = CANONICAL_ORIGIN;
  const productUrl = urls.productCanonical(slug);

  // Calculate priceValidUntil - one year from now in YYYY-MM-DD format
  const priceValidUntil = new Date();
  priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);
  const priceValidUntilStr = priceValidUntil.toISOString().split('T')[0];

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": name,
    "description": description,
    "image": images.length > 0 ? images : [`${baseUrl}/placeholder.svg`],
    "sku": sku || slug,
    "mpn": (sku || slug).toUpperCase(),
    "brand": {
      "@type": "Brand",
      "name": brand
    },
    "category": category,
    ...(material ? { "material": material } : {}),
    "additionalProperty": [
      { "@type": "PropertyValue", "name": "Feito à mão", "value": "Sim" },
      { "@type": "PropertyValue", "name": "Personalizado", "value": "Sim" },
      { "@type": "PropertyValue", "name": "Origem", "value": "Brasil" },
    ],
    "url": productUrl,
    "offers": {
      "@type": "Offer",
      "url": productUrl,
      "priceCurrency": "BRL",
      "price": Number(Number(price).toFixed(2)),
      "priceValidUntil": priceValidUntilStr,
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": brand
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": 0,
          "currency": "BRL"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "BR"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": productionDays,
            "maxValue": productionDays + 2,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 3,
            "maxValue": 15,
            "unitCode": "DAY"
          }
        }
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "BR",
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": 7,
        "returnMethod": "https://schema.org/ReturnByMail",
        "returnFees": "https://schema.org/FreeReturn"
      }
    },
    // aggregateRating só é incluído quando reviews reais existem (evita penalidade Google).
    ...(rating && reviewCount && reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(rating.toFixed(1)),
            reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviews && reviews.length > 0
      ? {
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author_name },
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            ...(r.comment ? { reviewBody: r.comment } : {}),
            ...(r.review_date ? { datePublished: r.review_date.slice(0, 10) } : {}),
            ...(r.source ? { publisher: { "@type": "Organization", name: r.source } } : {}),
          })),
        }
      : {}),
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

export default ProductStructuredData;
