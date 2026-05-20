import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductSkeleton";
import { useDbProducts } from "@/hooks/useProducts";
import type { Product } from "@/data/products";
import { useHomeRegistry } from "@/contexts/HomeRegistry";
import { sortByHomePriority } from "@/lib/homePriority";
import { urls, CANONICAL_ORIGIN } from "@/lib/urls";

const STORAGE_KEY = "bestsellers:selection:v2";
const TTL_MS = 1000 * 60 * 60 * 24; // 24h — same selection across reloads / sessions

type Cached = { ids: string[]; ts: number };

const readCache = (): Cached | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (!parsed?.ids || Date.now() - parsed.ts > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (ids: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids, ts: Date.now() } satisfies Cached));
  } catch {
    /* ignore */
  }
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const BestSellers = () => {
  const { data: dbProducts, isLoading } = useDbProducts();
  const registry = useHomeRegistry();

  const { products, totalActive } = useMemo(() => {
    const active = (dbProducts || []).filter(p => p.is_active);
    // Sprint final — dedupe global da home: descarta produtos já reivindicados
    // por blocos anteriores. Restantes vão por score editorial determinístico.
    const remainingIds = new Set(registry.filterProducts(active.map(p => p.id)));
    const candidates = active.filter(p => remainingIds.has(p.id));
    const desiredMax = 16;
    const pool = candidates.length > 0 ? candidates : active; // fallback se tudo já foi reivindicado
    const targetCount = Math.min(
      pool.length >= 4 ? Math.floor(pool.length / 4) * 4 : pool.length,
      desiredMax
    );

    // Score editorial: featured_weight + badge manual.
    const sorted = sortByHomePriority(
      pool.map(p => ({
        ...p,
        featured_weight: (p as any).featured_weight ?? 0,
        badge: p.badge,
      }))
    );
    const chosen = sorted.slice(0, targetCount);

    // Cache curto-circuita re-ordenações entre navegações.
    const cached = readCache();
    let finalChosen = chosen;
    if (cached && targetCount > 0) {
      const byId = new Map(chosen.map(p => [p.id, p]));
      const restored = cached.ids.map(id => byId.get(id)).filter(Boolean) as typeof chosen;
      if (restored.length === targetCount) finalChosen = restored;
    }
    if (finalChosen.length > 0) writeCache(finalChosen.map(p => p.id));

    // Claim no registry para próximos blocos não repetirem.
    registry.claimProducts(finalChosen.map(p => p.id));

    const mapped: Product[] = finalChosen.map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description || '',
      longDescription: p.long_description || undefined,
      price: `R$ ${p.price.toFixed(2).replace('.', ',')}`,
      priceValue: Number(p.price),
      originalPrice: p.original_price ? `R$ ${p.original_price.toFixed(2).replace('.', ',')}` : undefined,
      image: p.images?.[0] || '/placeholder.svg',
      images: p.images || [],
      link: '',
      badge: p.badge || "Mais Vendido",
      rating: Math.round(p.rating || 5),
      category: 'outros' as const,
      occasions: [],
      keywords: p.keywords || [],
      min_quantity: p.min_quantity || undefined,
    }));

    return { products: mapped, totalActive: active.length };
  }, [dbProducts, registry]);

  // ItemList JSON-LD (SEO)
  const itemListJsonLd = useMemo(() => {
    if (products.length === 0) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : CANONICAL_ORIGIN;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Mais vendidos — Empório LeleCute",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: urls.productAbsolute(p.slug, origin),
        name: p.name,
      })),
    };
  }, [products]);

  return (
    <section
      id="mais-vendidos"
      className="py-16 md:py-24 bg-background relative overflow-hidden"
      aria-labelledby="mais-vendidos-heading"
    >
      {itemListJsonLd && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
        </Helmet>
      )}
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Section Header — editorial, alinhado à PDP/RelatedProducts */}
          <header className="flex items-end justify-between gap-4 mb-10 flex-wrap">
            <h2 id="mais-vendidos-heading" className="font-display text-2xl lg:text-3xl font-light text-foreground">
              Mais vendidos
            </h2>
            <Link
              to="/produtos"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors border-b border-border/60 hover:border-foreground/40 pb-0.5"
            >
              Ver todos
            </Link>
          </header>

          {/* Products Grid */}
          {isLoading ? (
            <div className="mb-12">
              <ProductGridSkeleton count={4} />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {products.map((product, index) => (
                <div
                  key={product.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default BestSellers;
