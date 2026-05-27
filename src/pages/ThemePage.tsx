/**
 * Fase 10.3 — Hub temático público (/tema/:slug).
 * SAFE MODE: renderiza sempre, mas só indexa quando aprovado e com score forte.
 */
import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronRight, ShoppingBag, MessageCircle, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/ProductCard";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import ItemListStructuredData from "@/components/ItemListStructuredData";
import RelatedContent, { type RelatedItem } from "@/components/RelatedContent";
import SemanticLinkingBlock from "@/components/SemanticLinkingBlock";
import { buildContextualLinksForTheme } from "@/lib/linkOrchestrator";
import { useSemanticContext } from "@/hooks/useSemanticContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useThemeHubBySlug } from "@/hooks/useThemeHubs";
import {
  SITE_ORIGIN,
  buildThemeTitle,
  buildThemeDescription,
  detectThemeCannibalization,
  evaluateThemeIndexability,
  themeAuthorityScore,
  type ThemeSignals,
} from "@/lib/themeGovernance";
import type { Product } from "@/data/products";

const MAX_PRODUCTS = 24;
const MAX_LINKS = 12;

interface TaxRow { id: string; name: string; slug: string }

const ThemePage = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const { buildWhatsappUrl } = useContactInfo();
  const hubQuery = useThemeHubBySlug(slug);
  const hub = hubQuery.data ?? null;
  const { data: semanticCtx } = useSemanticContext();

  // Produtos relacionados ao tema: via tag_id (se houver) → product_tags
  const productsQuery = useQuery({
    queryKey: ["theme-products", hub?.id, hub?.tag_id],
    enabled: !!hub?.tag_id,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rel = await (supabase.from("product_tags") as any)
        .select("product_id").eq("tag_id", hub!.tag_id);
      if (rel.error) throw rel.error;
      const ids = (rel.data || []).map((r: { product_id: string }) => r.product_id);
      if (ids.length === 0) return [] as Product[];

      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, original_price, images, badge, rating, min_quantity, keywords, is_active, created_at")
        .in("id", ids.slice(0, 100))
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(MAX_PRODUCTS);
      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id, slug: p.slug, name: p.name, description: p.description || "",
        price: `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`,
        originalPrice: p.original_price ? `R$ ${Number(p.original_price).toFixed(2).replace(".", ",")}` : undefined,
        image: p.images?.[0] || "/placeholder.svg",
        images: p.images ?? [], link: "", badge: p.badge || undefined,
        rating: Math.round(p.rating ?? 5), category: "outros" as const,
        occasions: [], keywords: p.keywords ?? [], min_quantity: p.min_quantity || undefined,
      })) as Product[];
    },
  });

  const products = productsQuery.data ?? [];
  const productIds = products.map((p) => p.id);

  // Ocasiões e segmentos derivados dos produtos (diversidade)
  const taxonomiesQuery = useQuery({
    queryKey: ["theme-taxonomies", productIds.join(",")],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const [occRes, segRes, revRes] = await Promise.all([
        supabase.from("product_occasions").select("occasion_id, occasion:occasions(id, name, slug)").in("product_id", productIds),
        supabase.from("product_segments").select("segment_id, segment:segments(id, name, slug)").in("product_id", productIds),
        supabase.from("product_reviews").select("id").in("product_id", productIds).eq("is_visible", true),
      ]);
      if (occRes.error) throw occRes.error;
      if (segRes.error) throw segRes.error;
      if (revRes.error) throw revRes.error;

      const occMap = new Map<string, { item: TaxRow; n: number }>();
      for (const row of (occRes.data || []) as Array<{ occasion: TaxRow | null }>) {
        if (!row.occasion) continue;
        const prev = occMap.get(row.occasion.id);
        if (prev) prev.n += 1; else occMap.set(row.occasion.id, { item: row.occasion, n: 1 });
      }
      const segMap = new Map<string, { item: TaxRow; n: number }>();
      for (const row of (segRes.data || []) as Array<{ segment: TaxRow | null }>) {
        if (!row.segment) continue;
        const prev = segMap.get(row.segment.id);
        if (prev) prev.n += 1; else segMap.set(row.segment.id, { item: row.segment, n: 1 });
      }
      const occs = [...occMap.values()].sort((a, b) => b.n - a.n);
      const segs = [...segMap.values()].sort((a, b) => b.n - a.n);
      const totalOccProducts = occs.reduce((acc, x) => acc + x.n, 0);
      const largestShare = occs.length > 0 ? occs[0].n / Math.max(1, totalOccProducts) : 0;
      return { occs, segs, reviewsCount: (revRes.data || []).length, largestShare };
    },
  });

  const occs = taxonomiesQuery.data?.occs ?? [];
  const segs = taxonomiesQuery.data?.segs ?? [];

  // Posts relacionados via related_posts do hub
  const postsQuery = useQuery({
    queryKey: ["theme-posts", hub?.id, (hub?.related_posts ?? []).join(",")],
    enabled: !!hub && (hub.related_posts?.length ?? 0) > 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("blog_posts") as any)
        .select("id, slug, title, excerpt, cover_image")
        .in("id", hub!.related_posts)
        .eq("is_published", true)
        .limit(6);
      if (error) throw error;
      return data as Array<{ id: string; slug: string; title: string; excerpt: string | null; cover_image: string | null }>;
    },
  });

  const posts = postsQuery.data ?? [];

  // Score + governança
  const signals = useMemo<ThemeSignals>(() => {
    const goodImages = products.filter((p) => p.image && p.image !== "/placeholder.svg").length;
    return {
      productsCount: products.length,
      occasionsCount: occs.length,
      segmentsCount: segs.length,
      reviewsCount: taxonomiesQuery.data?.reviewsCount ?? 0,
      hasEditorial: Boolean(hub?.editorial_content && hub.editorial_content.length >= 80),
      goodImagesCount: goodImages,
      visualDiversity: products.length > 0 ? Math.min(1, goodImages / products.length) : 0,
      blogPostsCount: posts.length,
      relatedContentCount:
        (hub?.related_themes?.length ?? 0) +
        (hub?.related_occasions?.length ?? 0) +
        (hub?.related_segments?.length ?? 0),
    };
  }, [products, occs, segs, posts, hub, taxonomiesQuery.data]);

  const cannibalRisk = useMemo(
    () =>
      detectThemeCannibalization({
        hubSlug: slug,
        occasionSlugs: occs.map((x) => x.item.slug),
        segmentSlugs: segs.map((x) => x.item.slug),
        productsCount: products.length,
        largestOccasionShare: taxonomiesQuery.data?.largestShare,
      }),
    [slug, occs, segs, products.length, taxonomiesQuery.data]
  );

  const verdict = useMemo(
    () => evaluateThemeIndexability(hub, signals, cannibalRisk),
    [hub, signals, cannibalRisk]
  );

  const score = hub?.authority_score ?? themeAuthorityScore(signals);

  const pageUrl = `${SITE_ORIGIN}/tema/${slug}`;
  const title = hub ? buildThemeTitle(hub.title) : "Hub temático | Empório LeleCute";
  const description = hub
    ? hub.meta_description ||
      buildThemeDescription({
        title: hub.title,
        productsCount: products.length,
        occasionNames: occs.map((x) => x.item.name),
      })
    : undefined;
  const h1 = hub?.title ?? "";

  const breadcrumbItems = hub
    ? [
        { name: "Início", url: `${SITE_ORIGIN}/` },
        { name: "Temas", url: `${SITE_ORIGIN}/produtos` },
        { name: h1, url: pageUrl },
      ]
    : [];

  const collectionSchema = hub
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: h1,
        description,
        url: pageUrl,
        inLanguage: "pt-BR",
        isPartOf: { "@type": "WebSite", name: "Empório LeleCute", url: SITE_ORIGIN },
      }
    : null;

  const whatsappHref = useMemo(() => {
    if (!hub) return null;
    return buildWhatsappUrl(`Olá! Tenho interesse em lembrancinhas tema ${hub.title.toLowerCase()}.`);
  }, [buildWhatsappUrl, hub]);

  const loading = hubQuery.isLoading || productsQuery.isLoading;
  const notFound = !hubQuery.isLoading && !hub;
  const isAdminPreview = typeof window !== "undefined" && window.location.search.includes("admin_preview=1");

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col">
        <Helmet>
          <meta name="robots" content="noindex,follow" />
          <title>Tema não encontrado | Empório LeleCute</title>
          <link rel="canonical" href={`${SITE_ORIGIN}/produtos`} />
        </Helmet>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-semibold mb-3">Tema não encontrado</h1>
          <p className="text-muted-foreground mb-6">Este hub temático não está disponível.</p>
          <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  // Internal linking (máx 12)
  const internalLinks: RelatedItem[] = [];
  for (const o of occs.slice(0, 4)) internalLinks.push({ type: "occasion", slug: o.item.slug, title: o.item.name });
  for (const s of segs.slice(0, 3)) internalLinks.push({ type: "segment", slug: s.item.slug, title: s.item.name });
  for (const p of posts.slice(0, 3)) internalLinks.push({ type: "post", slug: p.slug, title: p.title, description: p.excerpt ?? undefined, image: p.cover_image ?? undefined });
  const dedupedLinks = internalLinks.slice(0, MAX_LINKS);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DynamicSEO title={title} description={description} url={pageUrl} type="website" image={hub?.hero_image_url ?? undefined} />
      <Helmet>
        <link rel="canonical" href={verdict.canonical} />
        <meta name="robots" content={verdict.robots} />
        {collectionSchema && (
          <script type="application/ld+json">{JSON.stringify(collectionSchema)}</script>
        )}
      </Helmet>

      {breadcrumbItems.length > 0 && <BreadcrumbStructuredData items={breadcrumbItems} />}
      {products.length > 0 && (
        <ItemListStructuredData
          listName={h1}
          products={products.map((p) => ({
            name: p.name, description: p.description, image: p.image,
            price: Number(String(p.price).replace(/[^0-9,]/g, "").replace(",", ".")) || 0,
            slug: p.slug,
          }))}
        />
      )}

      <Header />

      {isAdminPreview && (
        <div className="bg-muted border-b text-xs">
          <div className="container mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
            <span className="font-semibold">Preview admin:</span>
            <Badge variant={verdict.indexable ? "default" : "secondary"}>
              {verdict.indexable ? "Indexável" : "noindex"}
            </Badge>
            <Badge variant="outline">Authority: {score}</Badge>
            <Badge variant="outline">{verdict.classification}</Badge>
            {cannibalRisk !== "none" && (
              <Badge variant={cannibalRisk === "high" ? "destructive" : "outline"}>
                Canibalização: {cannibalRisk}
              </Badge>
            )}
            {verdict.reasons.length > 0 && (
              <span className="text-muted-foreground">· {verdict.reasons.join(" · ")}</span>
            )}
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-secondary/40 via-background to-background border-b">
          <div className="container mx-auto px-4 py-10 lg:py-14">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4" aria-label="Navegação">
              <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium truncate">Tema {h1}</span>
            </nav>

            <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end">
              <div className="flex flex-col gap-3 max-w-3xl">
                <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-primary font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Hub temático
                </span>
                <h1 className="text-3xl lg:text-3xl sm:text-4xl font-display font-semibold text-foreground">{h1}</h1>
                {hub?.intro && (
                  <p className="text-muted-foreground text-base lg:text-lg">{hub.intro}</p>
                )}
              </div>
              {hub?.hero_image_url && (
                <img
                  src={hub.hero_image_url}
                  alt={`Tema ${h1}`}
                  className="hidden lg:block w-48 h-48 object-cover rounded-2xl shadow-md"
                  loading="eager"
                />
              )}
            </div>
          </div>
        </section>

        {/* Editorial */}
        {(hub?.editorial_content || hub?.intro) && (
          <section className="container mx-auto px-4 pt-10">
            <div className="max-w-3xl text-muted-foreground leading-relaxed">
              {hub.editorial_content ? (
                <p className="whitespace-pre-line">{hub.editorial_content}</p>
              ) : (
                <p>{hub.intro}</p>
              )}
            </div>
          </section>
        )}

        {/* Grid produtos */}
        <section className="container mx-auto px-4 py-10 lg:py-14">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-display font-semibold mb-2">
                Ainda não há produtos vinculados a este tema
              </h2>
              <p className="text-muted-foreground mb-6">
                Estamos preparando esta coleção com carinho. Enquanto isso, explore nosso catálogo.
              </p>
              <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-lg font-display font-medium text-foreground">
                  {products.length} {products.length === 1 ? "produto encontrado" : "produtos encontrados"}
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {products.map((product, i) => (
                  <ProductCard key={product.id} product={product} priority={i < 4} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Produtos por ocasião */}
        {occs.length > 0 && (
          <section className="border-t bg-secondary/20">
            <div className="container mx-auto px-4 py-10">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Por ocasião
              </h3>
              <div className="flex flex-wrap gap-2">
                {occs.slice(0, 8).map((o) => (
                  <Link
                    key={o.item.id}
                    to={`/ocasiao/${o.item.slug}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-background hover:bg-secondary text-sm border transition-colors"
                  >
                    {o.item.name} <span className="ml-1.5 text-xs text-muted-foreground">({o.n})</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Produtos por segmento */}
        {segs.length > 0 && (
          <section className="container mx-auto px-4 py-10">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Por segmento
            </h3>
            <div className="flex flex-wrap gap-2">
              {segs.slice(0, 8).map((s) => (
                <Link
                  key={s.item.id}
                  to={`/segmento/${s.item.slug}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-background hover:bg-secondary text-sm border transition-colors"
                >
                  {s.item.name} <span className="ml-1.5 text-xs text-muted-foreground">({s.n})</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Conteúdo relacionado (posts + taxonomias) */}
        {dedupedLinks.length > 0 && (
          <section className="container mx-auto px-4">
            <RelatedContent title="Explore também" items={dedupedLinks} />
          </section>
        )}

        {/* Fase 11.1 — Descubra também (autoridade filtrada, max 10, sem hubs fracos) */}
        {(() => {
          const used = new Set<string>([`/tema/${slug}`]);
          dedupedLinks.forEach((l) => {
            const prefix =
              l.type === "occasion" ? "/ocasiao/"
              : l.type === "segment" ? "/segmento/"
              : l.type === "post" ? "/blog/"
              : l.type === "category" ? "/categoria/"
              : l.type === "tag" ? "/tag/"
              : l.type === "theme" ? "/tema/" : "/";
            used.add(`${prefix}${l.slug}`);
          });
          occs.forEach((o) => used.add(`/ocasiao/${o.item.slug}`));
          segs.forEach((s) => used.add(`/segmento/${s.item.slug}`));

          const strongThemes = semanticCtx.themes.filter((t) => (t.authority_score ?? 0) >= 70);
          const links = buildContextualLinksForTheme(
            { slug },
            {
              themes: strongThemes,
              combinations: semanticCtx.combinations,
              posts: semanticCtx.posts,
            }
          )
            .filter((l) => !used.has(l.path))
            .slice(0, 10);

          if (links.length < 3) return null;
          return (
            <section className="container mx-auto px-4">
              <SemanticLinkingBlock title="Descubra também" links={links} />
            </section>
          );
        })()}

        {whatsappHref && (
          <section className="container mx-auto px-4 py-12">
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg md:text-xl font-display font-semibold mb-1">
                  Quer algo especial no tema {h1.toLowerCase()}?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Fale com a gente no WhatsApp — fazemos sob medida com carinho.
                </p>
              </div>
              <Button asChild size="lg">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Falar no WhatsApp
                </a>
              </Button>
            </div>
          </section>
        )}
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default ThemePage;
