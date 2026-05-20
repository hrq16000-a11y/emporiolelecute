import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import CatalogFilters, { useCatalogFiltersFromUrl } from "@/components/CatalogFilters";
import { applyCatalogFilters, sortByFeatured, priceBoundsFrom, deriveFacets } from "@/lib/catalogFilter";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronRight, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/ProductCard";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import ItemListStructuredData from "@/components/ItemListStructuredData";
import FAQStructuredData from "@/components/FAQStructuredData";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImage } from "@/lib/image";
import { normalizeFaqs, metaTitleFallback, metaDescriptionFallback, buildBreadcrumbs, type TaxonomyKind as TaxKind } from "@/lib/taxonomy";
import { useSemanticContext } from "@/hooks/useSemanticContext";
import { buildContextualLinksForTaxonomy } from "@/lib/linkOrchestrator";
import SemanticLinkingBlock from "@/components/SemanticLinkingBlock";
import type { Product } from "@/data/products";

const SITE_ORIGIN = "https://emporiolelecute.com.br";
const MAX_PRODUCTS = 24;
const MAX_RELATED = 8;

type TaxonomyKind = "categoria" | "ocasiao" | "segmento";

interface TaxonomyConfig {
  kind: TaxonomyKind;
  table: "categories" | "occasions" | "segments";
  joinTable: "products" | "product_occasions" | "product_segments";
  joinCol: "category_id" | "occasion_id" | "segment_id";
  label: string;
  hubPath: string;
  routePrefix: string;
}

const CONFIGS: Record<TaxonomyKind, TaxonomyConfig> = {
  categoria: { kind: "categoria", table: "categories", joinTable: "products", joinCol: "category_id", label: "Categoria", hubPath: "/produtos", routePrefix: "/categoria" },
  ocasiao:   { kind: "ocasiao",   table: "occasions",  joinTable: "product_occasions", joinCol: "occasion_id", label: "Ocasião",  hubPath: "/ocasioes", routePrefix: "/ocasiao" },
  segmento:  { kind: "segmento",  table: "segments",   joinTable: "product_segments",  joinCol: "segment_id",  label: "Segmento", hubPath: "/produtos", routePrefix: "/segmento" },
};

interface TaxonomyEntity {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1_override: string | null;
  description_seo: string | null;
  is_indexed: boolean;
  is_draft: boolean | null;
  faqs: unknown;
}

interface MiniTaxonomy { id: string; name: string; slug: string }

interface Props { kind: TaxonomyKind }

const TaxonomyPage = ({ kind }: Props) => {
  const { slug = "" } = useParams<{ slug: string }>();
  const cfg = CONFIGS[kind];

  // 1. Entidade
  const entityQuery = useQuery({
    queryKey: ["taxonomy", cfg.table, slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.table)
        .select("id, name, slug, description, image_url, meta_title, meta_description, h1_override, description_seo, is_indexed, is_draft, faqs")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as TaxonomyEntity | null;
    },
  });

  const entity = entityQuery.data;

  // 2. Produtos
  const productsQuery = useQuery({
    queryKey: ["taxonomy-products", cfg.table, entity?.id],
    enabled: !!entity?.id,
    queryFn: async () => {
      const selectExpr = `id, slug, name, description, price, original_price, images, badge, rating, min_quantity, keywords, is_active, created_at, personalization_enabled, production_days, production_speed, featured_weight,
        category:categories(id, name, slug),
        occasions:product_occasions(occasion:occasions(id, name, slug)),
        tags:product_tags(tag:tags(id, name, slug)),
        segments:product_segments(segment:segments(id, name, slug))`;
      if (cfg.kind === "categoria") {
        const { data, error } = await supabase
          .from("products")
          .select(selectExpr)
          .eq("is_active", true)
          .eq("category_id", entity!.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(cfg.joinTable) as any)
        .select(`product:products(${selectExpr})`)
        .eq(cfg.joinCol, entity!.id);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type Row = { product: any | null };
      return ((data as Row[] | null) ?? [])
        .map((r) => r.product)
        .filter((p) => !!p && p.is_active)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
  });

  const dbProducts = productsQuery.data ?? [];

  // ============ FILTROS ============
  const [filters, setFilters] = useCatalogFiltersFromUrl();

  const normalized = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbProducts as any[]).map((p) => ({
        ...p,
        occasions: (p.occasions || []).map((x: { occasion: unknown }) => x.occasion).filter(Boolean),
        tags: (p.tags || []).map((x: { tag: unknown }) => x.tag).filter(Boolean),
        segments: (p.segments || []).map((x: { segment: unknown }) => x.segment).filter(Boolean),
      })),
    [dbProducts]
  );

  // Facets derived from the current taxonomy subset (not global lists)
  const facets = useMemo(() => deriveFacets(normalized), [normalized]);

  const priceBounds = useMemo(() => priceBoundsFrom(normalized), [normalized]);
  const filtered = useMemo(() => sortByFeatured(applyCatalogFilters(normalized, filters)), [normalized, filters]);
  const filteredLimited = filtered.slice(0, MAX_PRODUCTS);

  // 3. Taxonomias relacionadas (linking cruzado) — uma query por relação
  const productIds = useMemo(() => dbProducts.map((p) => p.id), [dbProducts]);

  const relatedQuery = useQuery({
    queryKey: ["taxonomy-related", cfg.kind, entity?.id, productIds.slice(0, 24).join(",")],
    enabled: !!entity?.id && productIds.length > 0,
    queryFn: async () => {
      type Agg = { categories: MiniTaxonomy[]; occasions: MiniTaxonomy[]; segments: MiniTaxonomy[] };
      const [catsRes, occsRes, segsRes] = await Promise.all([
        // categorias dos produtos
        supabase
          .from("products")
          .select("category:categories(id, name, slug)")
          .in("id", productIds),
        // ocasiões via join
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("product_occasions") as any)
          .select("occasion:occasions(id, name, slug)")
          .in("product_id", productIds),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("product_segments") as any)
          .select("segment:segments(id, name, slug)")
          .in("product_id", productIds),
      ]);

      const tally = <T extends MiniTaxonomy>(rows: { [k: string]: T | null }[] | null | undefined, key: string, excludeId?: string): T[] => {
        const counts = new Map<string, { item: T; n: number }>();
        (rows ?? []).forEach((r) => {
          const it = r?.[key];
          if (!it || !it.id || it.id === excludeId) return;
          const prev = counts.get(it.id);
          if (prev) prev.n += 1;
          else counts.set(it.id, { item: it, n: 1 });
        });
        return [...counts.values()]
          .sort((a, b) => b.n - a.n)
          .slice(0, MAX_RELATED)
          .map((x) => x.item);
      };

      const agg: Agg = {
        categories: tally<MiniTaxonomy>((catsRes.data as unknown) as { category: MiniTaxonomy | null }[], "category", cfg.kind === "categoria" ? entity!.id : undefined),
        occasions:  tally<MiniTaxonomy>((occsRes.data as unknown) as { occasion: MiniTaxonomy | null }[], "occasion", cfg.kind === "ocasiao"  ? entity!.id : undefined),
        segments:   tally<MiniTaxonomy>((segsRes.data as unknown) as { segment: MiniTaxonomy | null }[], "segment", cfg.kind === "segmento" ? entity!.id : undefined),
      };
      return agg;
    },
  });

  const related = relatedQuery.data;
  const { data: semanticCtx } = useSemanticContext();

  const products: Product[] = useMemo(
    () =>
      filteredLimited.map((p) => ({
        id: p.id, slug: p.slug, name: p.name, description: p.description || "",
        price: `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`,
        originalPrice: p.original_price ? `R$ ${Number(p.original_price).toFixed(2).replace(".", ",")}` : undefined,
        image: p.images?.[0] || "/placeholder.svg",
        images: p.images ?? [], link: "", badge: p.badge || undefined,
        rating: Math.round(p.rating ?? 5), category: "outros" as const,
        occasions: [], keywords: p.keywords ?? [], min_quantity: p.min_quantity || undefined,
        personalization_enabled: p.personalization_enabled ?? undefined,
        production_days: p.production_days ?? undefined,
      })),
    [filteredLimited]
  );

  const loading = entityQuery.isLoading || productsQuery.isLoading;
  const notFound = !entityQuery.isLoading && !entity;

  // ============ SEO ============
  const pageUrl = `${SITE_ORIGIN}${cfg.routePrefix}/${slug}`;
  // Fase 6 — fallbacks padronizados (não persistem no banco)
  const seoTitle = entity?.meta_title?.trim() || (entity ? metaTitleFallback(cfg.kind as TaxKind, entity.name) : "Empório LeleCute");
  const seoDesc = entity?.meta_description?.trim() || (entity ? metaDescriptionFallback(cfg.kind as TaxKind, entity.name) : undefined);
  const h1 = entity?.h1_override?.trim() || entity?.name || "";
  const isIndexed = entity?.is_indexed !== false;
  const faqs = normalizeFaqs(entity?.faqs);

  const breadcrumbItems = entity
    ? buildBreadcrumbs({
        kind: cfg.kind as TaxKind,
        taxonomyName: entity.name,
        taxonomySlug: entity.slug,
      })
    : [];

  // CollectionPage JSON-LD
  const collectionSchema = entity
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: entity.name,
        description: seoDesc,
        url: pageUrl,
        inLanguage: "pt-BR",
        isPartOf: { "@type": "WebSite", name: "Empório LeleCute", url: SITE_ORIGIN },
      }
    : null;

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col">
        <Helmet>
          <meta name="robots" content="noindex,follow" />
          <title>Não encontrado | Empório LeleCute</title>
        </Helmet>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-display font-semibold mb-3">{cfg.label} não encontrada</h1>
          <p className="text-muted-foreground mb-6">A página que você procura não existe ou foi removida.</p>
          <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  const RelatedBlock = ({ title, items, prefix }: { title: string; items: MiniTaxonomy[]; prefix: string }) => {
    if (!items?.length) return null;
    return (
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <Link
              key={it.id}
              to={`${prefix}/${it.slug}`}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary text-sm text-foreground transition-colors"
            >
              {it.name}
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DynamicSEO title={seoTitle} description={seoDesc} image={entity?.image_url || undefined} url={pageUrl} type="website" />
      <Helmet>
        <meta name="robots" content={isIndexed ? "index,follow" : "noindex,follow"} />
        {collectionSchema && (
          <script type="application/ld+json">{JSON.stringify(collectionSchema)}</script>
        )}
      </Helmet>

      {entity && breadcrumbItems.length > 0 && <BreadcrumbStructuredData items={breadcrumbItems} />}
      {entity && products.length > 0 && (
        <ItemListStructuredData
          listName={entity.name}
          products={products.map((p) => ({
            name: p.name, description: p.description, image: p.image,
            price: Number(String(p.price).replace(/[^0-9,]/g, "").replace(",", ".")) || 0,
            slug: p.slug,
          }))}
        />
      )}
      {faqs.length > 0 && <FAQStructuredData faqs={faqs.map((f, i) => ({ id: String(i), ...f }))} />}

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-secondary/40 via-background to-background border-b">
          <div className="container mx-auto px-4 py-10 lg:py-14">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4" aria-label="Navegação">
              <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to={cfg.hubPath} className="hover:text-foreground transition-colors">
                {cfg.label === "Categoria" ? "Produtos" : cfg.label === "Ocasião" ? "Ocasiões" : "Produtos"}
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium truncate">{entity?.name ?? ""}</span>
            </nav>

            <div className="flex flex-col-reverse lg:flex-row gap-8 items-start lg:items-center">
              <div className="flex-1 min-w-0">
                <span className="inline-block text-xs uppercase tracking-wider text-primary font-semibold mb-2">{cfg.label}</span>
                <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground mb-3">{h1}</h1>
                {entity?.description && (
                  <p className="text-muted-foreground text-base lg:text-lg max-w-2xl">{entity.description}</p>
                )}
              </div>

              {entity?.image_url && (
                <div className="w-full max-w-xs lg:max-w-sm shrink-0">
                  <img
                    src={optimizeImage(entity.image_url, { width: 640, resize: "cover" })}
                    alt={entity.name}
                    className="w-full aspect-[4/3] object-cover rounded-2xl shadow-card"
                    loading="eager"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Editorial intro long (description_seo) */}
        {entity?.description_seo && (
          <section className="container mx-auto px-4 pt-10">
            <div className="max-w-3xl prose prose-sm md:prose-base prose-neutral dark:prose-invert">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {entity.description_seo}
              </p>
            </div>
          </section>
        )}

        {/* Grid + Filtros */}
        <section className="container mx-auto px-4 py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row gap-8">
            <CatalogFilters
              values={filters}
              onChange={setFilters}
              occasions={facets.occasions}
              categories={facets.categories}
              tags={facets.tags}
              segments={facets.segments}
              priceBounds={priceBounds}
              totalCount={filtered.length}
              hide={{
                category: cfg.kind === "categoria",
                occasion: cfg.kind === "ocasiao",
                segment: cfg.kind === "segmento",
              }}
            />
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 max-w-md mx-auto">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-display font-semibold mb-2">Nenhum produto encontrado</h2>
                  <p className="text-muted-foreground mb-6">
                    Ajuste os filtros ou explore nosso catálogo completo.
                  </p>
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

        {/* Internal linking — taxonomias relacionadas */}
        {related && (related.categories.length + related.occasions.length + related.segments.length) > 0 && (
          <section className="border-t bg-secondary/20">
            <div className="container mx-auto px-4 py-10 lg:py-14 space-y-8">
              <h2 className="text-2xl font-display font-semibold">Explore também</h2>
              <div className="grid md:grid-cols-3 gap-8">
                {cfg.kind !== "categoria" && <RelatedBlock title="Categorias relacionadas" items={related.categories} prefix="/categoria" />}
                {cfg.kind !== "ocasiao"   && <RelatedBlock title="Ocasiões relacionadas"   items={related.occasions}  prefix="/ocasiao" />}
                {cfg.kind !== "segmento"  && <RelatedBlock title="Segmentos relacionados"  items={related.segments}   prefix="/segmento" />}
              </div>
            </div>
          </section>
        )}

        {/* FAQ editorial */}
        {faqs.length > 0 && (
          <section className="border-t">
            <div className="container mx-auto px-4 py-10 lg:py-14 max-w-3xl">
              <h2 className="text-2xl font-display font-semibold mb-6">Perguntas frequentes</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {faqs.map((f, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="bg-card border border-border rounded-xl px-5 data-[state=open]:border-primary/30"
                  >
                    <AccordionTrigger className="hover:no-underline py-4 text-left">
                      <span className="font-medium text-foreground pr-4">{f.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-muted-foreground leading-relaxed whitespace-pre-line">
                      {f.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        )}

        {/* Fase 11.1 — Linking semântico contextual (após FAQ) */}
        {(() => {
          const used = new Set<string>([`${cfg.routePrefix}/${slug}`]);
          related?.categories.forEach((c) => used.add(`/categoria/${c.slug}`));
          related?.occasions.forEach((o) => used.add(`/ocasiao/${o.slug}`));
          related?.segments.forEach((s) => used.add(`/segmento/${s.slug}`));

          const kindMap: Record<TaxonomyKind, "occasion" | "segment" | "category"> = {
            categoria: "category", ocasiao: "occasion", segmento: "segment",
          };
          const links = buildContextualLinksForTaxonomy(
            { slug, kind: kindMap[cfg.kind] },
            {
              themes: semanticCtx.themes,
              combinations: semanticCtx.combinations,
              posts: semanticCtx.posts,
            }
          )
            .filter((l) => !used.has(l.path))
            .slice(0, 8);

          if (links.length < 3) return null;
          return (
            <section className="container mx-auto px-4 pb-10">
              <SemanticLinkingBlock title="Conexões temáticas" links={links} />
            </section>
          );
        })()}
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default TaxonomyPage;
