import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, ChevronRight, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/ProductCard";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import ItemListStructuredData from "@/components/ItemListStructuredData";
import CatalogFilters, { useCatalogFiltersFromUrl } from "@/components/CatalogFilters";
import { applyCatalogFilters, priceBoundsFrom } from "@/lib/catalogFilter";
import { useCollectionBySlug } from "@/hooks/useCollections";
import { useDbCategories, useDbOccasions } from "@/hooks/useProducts";
import { useTags } from "@/hooks/useTags";
import { useSegments } from "@/hooks/useSegments";
import { optimizeImage } from "@/lib/image";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/products";

const SITE_ORIGIN = "https://emporiolelecute.com.br";

const Colecao = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data: collection, isLoading } = useCollectionBySlug(slug);
  const { data: dbCategories } = useDbCategories({ publicOnly: true });
  const { data: dbOccasions } = useDbOccasions({ publicOnly: true });
  const { data: dbTags } = useTags();
  const { data: dbSegments } = useSegments({ publicOnly: true });
  const [filters, setFilters] = useCatalogFiltersFromUrl();

  const normalized = useMemo(
    () =>
      (collection?.products ?? []).map((p) => ({ ...p, occasions: [], tags: [], segments: [], category: null })),
    [collection]
  );
  const priceBounds = useMemo(() => priceBoundsFrom(normalized), [normalized]);
  // Ordenação: respeita `collection_products.position` (já vem ordenado do hook);
  // featured_weight só atua como desempate quando posições forem iguais (raro).
  const filtered = useMemo(
    () => applyCatalogFilters(normalized, filters),
    [normalized, filters]
  );

  const products: Product[] = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description || "",
        price: `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`,
        priceValue: Number(p.price),
        originalPrice: p.original_price ? `R$ ${Number(p.original_price).toFixed(2).replace(".", ",")}` : undefined,
        image: p.images?.[0] || "/placeholder.svg",
        images: p.images ?? [],
        link: "",
        badge: p.badge || undefined,
        rating: Math.round(p.rating ?? 5),
        category: "outros" as const,
        occasions: [],
        keywords: [],
        min_quantity: p.min_quantity || undefined,
        production_days: p.production_days ?? undefined,
        personalization_enabled: p.personalization_enabled ?? undefined,
      })),
    [filtered]
  );

  if (!isLoading && !collection) {
    return (
      <div className="min-h-screen flex flex-col">
        <Helmet>
          <meta name="robots" content="noindex,follow" />
          <title>Coleção não encontrada | Empório LeleCute</title>
        </Helmet>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-display font-semibold mb-3">Coleção não encontrada</h1>
          <p className="text-muted-foreground mb-6">A coleção que você procura não existe ou não está mais ativa.</p>
          <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  const pageUrl = `${SITE_ORIGIN}/colecao/${slug}`;
  const seoTitle = collection?.meta_title?.trim() || (collection ? `${collection.name} | Empório LeleCute` : "Coleção");
  const seoDesc = collection?.meta_description?.trim() || collection?.description || undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DynamicSEO title={seoTitle} description={seoDesc} image={collection?.image_url || undefined} url={pageUrl} type="website" />
      {collection && (
        <BreadcrumbStructuredData
          items={[
            { name: "Início", url: SITE_ORIGIN },
            { name: "Coleções", url: `${SITE_ORIGIN}/produtos` },
            { name: collection.name, url: pageUrl },
          ]}
        />
      )}
      {collection && products.length > 0 && (
        <ItemListStructuredData
          listName={collection.name}
          products={products.map((p) => ({
            name: p.name,
            description: p.description,
            image: p.image,
            price: Number(String(p.price).replace(/[^0-9,]/g, "").replace(",", ".")) || 0,
            slug: p.slug,
          }))}
        />
      )}

      <Header />

      <main className="flex-1">
        <section className="bg-gradient-to-br from-secondary/40 via-background to-background border-b">
          <div className="container mx-auto px-4 py-10 lg:py-14">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4" aria-label="Navegação">
              <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/produtos" className="hover:text-foreground transition-colors">Produtos</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium truncate">{collection?.name ?? ""}</span>
            </nav>
            <div className="flex flex-col-reverse lg:flex-row gap-8 items-start lg:items-center">
              <div className="flex-1 min-w-0">
                <span className="inline-block text-xs uppercase tracking-wider text-primary font-semibold mb-2">Coleção</span>
                <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground mb-3">{collection?.name ?? ""}</h1>
                {collection?.description && (
                  <p className="text-muted-foreground text-base lg:text-lg max-w-2xl">{collection.description}</p>
                )}
              </div>
              {collection?.image_url && (
                <div className="w-full max-w-xs lg:max-w-sm shrink-0">
                  <img
                    src={optimizeImage(collection.image_url, { width: 640, resize: "cover" })}
                    alt={collection.name}
                    className="w-full aspect-[4/3] object-cover rounded-2xl shadow-card"
                    loading="eager"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row gap-8">
            <CatalogFilters
              values={filters}
              onChange={setFilters}
              occasions={dbOccasions}
              categories={dbCategories}
              tags={dbTags}
              segments={dbSegments}
              priceBounds={priceBounds}
              totalCount={filtered.length}
              hide={{ category: true, occasion: true, segment: true }}
            />
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 max-w-md mx-auto">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-display font-semibold mb-2">Sem produtos nesta coleção</h2>
                  <p className="text-muted-foreground mb-6">Ajuste os filtros ou explore o catálogo.</p>
                  <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between mb-6">
                    <h2 className="text-lg font-display font-medium text-foreground">
                      {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                    {products.map((product, i) => (
                      <ProductCard key={product.id} product={product} priority={i < 4} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Colecao;
