// Fase 10.2 — Rota combinatória pública em SAFE MODE.
// /segmento/:segmentSlug/ocasiao/:occasionSlug
//
// - Renderiza sempre (UX continua), mas SEO é controlado:
//   indexável APENAS se passar nos gates do registry (status=approved,
//   is_indexable, score>=70, produtos>=6, sem thin_content, sem canibalização).
// - Caso contrário: noindex,follow + canonical para /produtos.
// - Nunca entra no sitemap nesta fase.

import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronRight, ShoppingBag, MessageCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/ProductCard";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import ItemListStructuredData from "@/components/ItemListStructuredData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useSemanticContext } from "@/hooks/useSemanticContext";
import { buildContextualLinksForCombination } from "@/lib/linkOrchestrator";
import SemanticLinkingBlock from "@/components/SemanticLinkingBlock";
import {
  SITE_ORIGIN,
  buildCombinationCanonicalPath,
  buildCombinationTitle,
  buildCombinationDescription,
  evaluateIndexability,
  type RegistryEntry,
} from "@/lib/combinationGovernance";
import type { Product } from "@/data/products";

const MAX_PRODUCTS = 24;
const MAX_INTERNAL_LINKS = 8;

interface TaxRow { id: string; name: string; slug: string; description: string | null; image_url: string | null }

const CombinationPage = () => {
  const { segmentSlug = "", occasionSlug = "" } = useParams<{ segmentSlug: string; occasionSlug: string }>();
  const canonicalPath = buildCombinationCanonicalPath(segmentSlug, occasionSlug);
  const { buildWhatsappUrl } = useContactInfo();
  const { data: semanticCtx } = useSemanticContext();

  // 1. Entidades em paralelo
  const entitiesQuery = useQuery({
    queryKey: ["combo-entities", segmentSlug, occasionSlug],
    enabled: !!segmentSlug && !!occasionSlug,
    queryFn: async () => {
      const [segRes, occRes] = await Promise.all([
        supabase.from("segments")
          .select("id, name, slug, description, image_url")
          .eq("slug", segmentSlug).maybeSingle(),
        supabase.from("occasions")
          .select("id, name, slug, description, image_url")
          .eq("slug", occasionSlug).maybeSingle(),
      ]);
      if (segRes.error) throw segRes.error;
      if (occRes.error) throw occRes.error;
      return {
        segment: (segRes.data as TaxRow | null) ?? null,
        occasion: (occRes.data as TaxRow | null) ?? null,
      };
    },
  });

  const segment = entitiesQuery.data?.segment ?? null;
  const occasion = entitiesQuery.data?.occasion ?? null;
  const notFound = !entitiesQuery.isLoading && (!segment || !occasion);

  // 2. Registry entry (governança)
  const registryQuery = useQuery({
    queryKey: ["combo-registry", canonicalPath],
    enabled: !!segment && !!occasion,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combination_pages_registry")
        .select("*")
        .eq("path", canonicalPath)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as RegistryEntry) ?? null;
    },
  });

  // 3. Produtos (interseção segmento × ocasião) — LIMIT server-side
  const productsQuery = useQuery({
    queryKey: ["combo-products", segment?.id, occasion?.id],
    enabled: !!segment?.id && !!occasion?.id,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [segRel, occRel] = await Promise.all([
        (supabase.from("product_segments") as any)
          .select("product_id").eq("segment_id", segment!.id),
        (supabase.from("product_occasions") as any)
          .select("product_id").eq("occasion_id", occasion!.id),
      ]);
      if (segRel.error) throw segRel.error;
      if (occRel.error) throw occRel.error;
      const segIds = new Set<string>((segRel.data || []).map((r: { product_id: string }) => r.product_id));
      const intersect = (occRel.data || [])
        .map((r: { product_id: string }) => r.product_id)
        .filter((id: string) => segIds.has(id));
      if (intersect.length === 0) return [] as Product[];

      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, original_price, images, badge, rating, min_quantity, keywords, is_active, created_at")
        .in("id", intersect.slice(0, 100))
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(MAX_PRODUCTS);
      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id, slug: p.slug, name: p.name, description: p.description || "",
        price: `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`,
        priceValue: Number(p.price),
        originalPrice: p.original_price ? `R$ ${Number(p.original_price).toFixed(2).replace(".", ",")}` : undefined,
        image: p.images?.[0] || "/placeholder.svg",
        images: p.images ?? [], link: "", badge: p.badge || undefined,
        rating: Math.round(p.rating ?? 5), category: "outros" as const,
        occasions: [], keywords: p.keywords ?? [], min_quantity: p.min_quantity || undefined,
      })) as Product[];
    },
  });

  const products = productsQuery.data ?? [];

  // 4. Internal linking leve (max 8) — categorias mais frequentes nos produtos
  const relatedQuery = useQuery({
    queryKey: ["combo-related", products.map((p) => p.id).slice(0, 24).join(",")],
    enabled: products.length > 0,
    queryFn: async () => {
      const ids = products.map((p) => p.id);
      const { data, error } = await supabase
        .from("products")
        .select("category:categories(id, name, slug)")
        .in("id", ids);
      if (error) throw error;
      const counts = new Map<string, { item: { id: string; name: string; slug: string }; n: number }>();
      for (const row of (data || []) as Array<{ category: { id: string; name: string; slug: string } | null }>) {
        const c = row.category;
        if (!c) continue;
        const prev = counts.get(c.id);
        if (prev) prev.n += 1;
        else counts.set(c.id, { item: c, n: 1 });
      }
      return [...counts.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, Math.max(0, MAX_INTERNAL_LINKS - 2)) // reserva 2 para seg/occ
        .map((x) => x.item);
    },
  });

  const relatedCategories = relatedQuery.data ?? [];

  // 5. SEO governance
  const pageUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const verdict = useMemo(
    () =>
      evaluateIndexability(registryQuery.data ?? null, {
        canonicalPath,
        primaryType: "segment",
        productsCount: products.length,
      }),
    [registryQuery.data, canonicalPath, products.length]
  );

  const segName = segment?.name ?? "";
  const occName = occasion?.name ?? "";
  const title = segment && occasion ? buildCombinationTitle(segName, occName) : "Empório LeleCute";
  const description = segment && occasion ? buildCombinationDescription(segName, occName, products.length) : undefined;
  const h1 = segment && occasion ? `${segName} para ${occName}` : "";

  const breadcrumbItems = segment && occasion
    ? [
        { name: "Início", url: `${SITE_ORIGIN}/` },
        { name: segName, url: `${SITE_ORIGIN}/segmento/${segment.slug}` },
        { name: occName, url: `${SITE_ORIGIN}/ocasiao/${occasion.slug}` },
        { name: h1, url: pageUrl },
      ]
    : [];

  const collectionSchema = segment && occasion
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
    if (!segName || !occName) return null;
    return buildWhatsappUrl(
      `Olá! Tenho interesse em ${segName.toLowerCase()} para ${occName.toLowerCase()}.`
    );
  }, [buildWhatsappUrl, segName, occName]);

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col">
        <Helmet>
          <meta name="robots" content="noindex,follow" />
          <title>Combinação não encontrada | Empório LeleCute</title>
          <link rel="canonical" href={`${SITE_ORIGIN}/produtos`} />
        </Helmet>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-semibold mb-3">Combinação não encontrada</h1>
          <p className="text-muted-foreground mb-6">
            Não localizamos esta combinação de segmento e ocasião.
          </p>
          <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    );
  }

  const loading = entitiesQuery.isLoading || productsQuery.isLoading;
  const isAdminPreview = typeof window !== "undefined" && window.location.search.includes("admin_preview=1");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DynamicSEO title={title} description={description} url={pageUrl} type="website" />
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

      {/* Admin preview banner */}
      {isAdminPreview && (
        <div className="bg-muted border-b text-xs">
          <div className="container mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
            <span className="font-semibold">Preview admin:</span>
            <Badge variant={verdict.indexable ? "default" : "secondary"}>
              {verdict.indexable ? "Indexável" : "noindex"}
            </Badge>
            {verdict.cannibalRisk !== "none" && (
              <Badge variant={verdict.cannibalRisk === "high" ? "destructive" : "outline"}>
                Canibalização: {verdict.cannibalRisk}
              </Badge>
            )}
            {verdict.reasons.length > 0 && (
              <span className="text-muted-foreground">
                · {verdict.reasons.join(" · ")}
              </span>
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
              {segment && (
                <Link to={`/segmento/${segment.slug}`} className="hover:text-foreground transition-colors">
                  {segName}
                </Link>
              )}
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium truncate">{occName}</span>
            </nav>

            <div className="flex flex-col gap-3 max-w-3xl">
              <span className="inline-block text-xs uppercase tracking-wider text-primary font-semibold">
                Coleção temática
              </span>
              <h1 className="text-3xl lg:text-3xl sm:text-4xl font-display font-semibold text-foreground">{h1}</h1>
              {description && (
                <p className="text-muted-foreground text-base lg:text-lg">{description}</p>
              )}
            </div>
          </div>
        </section>

        {/* Editorial curto (mensagem padrão se registry sem editorial_content) */}
        <section className="container mx-auto px-4 pt-10">
          <div className="max-w-3xl text-muted-foreground leading-relaxed">
            {registryQuery.data?.editorial_content ? (
              <p className="whitespace-pre-line">{registryQuery.data.editorial_content}</p>
            ) : (
              <p>
                Selecionamos opções de <strong>{segName.toLowerCase()}</strong> que combinam
                com o clima de <strong>{occName.toLowerCase()}</strong>. Todos os itens podem
                ser personalizados para tornar o momento ainda mais especial.
              </p>
            )}
          </div>
        </section>

        {/* Grid */}
        <section className="container mx-auto px-4 py-10 lg:py-14">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-display font-semibold mb-2">
                Ainda não há produtos nessa combinação
              </h2>
              <p className="text-muted-foreground mb-6">
                Explore as páginas principais de {segName.toLowerCase()} ou {occName.toLowerCase()}.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {segment && <Button asChild variant="outline"><Link to={`/segmento/${segment.slug}`}>Ver {segName}</Link></Button>}
                {occasion && <Button asChild variant="outline"><Link to={`/ocasiao/${occasion.slug}`}>Ver {occName}</Link></Button>}
                <Button asChild><Link to="/produtos">Todos os produtos</Link></Button>
              </div>
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

        {/* Internal linking leve — Explore também */}
        {(segment || occasion || relatedCategories.length > 0) && (
          <section className="border-t bg-secondary/20">
            <div className="container mx-auto px-4 py-10">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Explore também
              </h3>
              <div className="flex flex-wrap gap-2">
                {segment && (
                  <Link
                    to={`/segmento/${segment.slug}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-background hover:bg-secondary text-sm border transition-colors"
                  >
                    {segName}
                  </Link>
                )}
                {occasion && (
                  <Link
                    to={`/ocasiao/${occasion.slug}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-background hover:bg-secondary text-sm border transition-colors"
                  >
                    {occName}
                  </Link>
                )}
                {relatedCategories.map((c) => (
                  <Link
                    key={c.id}
                    to={`/categoria/${c.slug}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-background hover:bg-secondary text-sm border transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Fase 11.1 — Linking semântico (somente combinações aprovadas com score forte) */}
        {(() => {
          const reg = registryQuery.data;
          if (!reg) return null;
          const approved = reg.discovery_status === "approved" && reg.is_indexable !== false;
          const readiness = reg.readiness_score ?? 0;
          const coverage = reg.topical_coverage ?? 0;
          if (!approved || readiness < 75 || coverage < 60) return null;
          if (!verdict.indexable) return null;

          const used = new Set<string>([canonicalPath]);
          if (segment) used.add(`/segmento/${segment.slug}`);
          if (occasion) used.add(`/ocasiao/${occasion.slug}`);
          relatedCategories.forEach((c) => used.add(`/categoria/${c.slug}`));

          const links = buildContextualLinksForCombination(
            { path: canonicalPath },
            {
              themes: semanticCtx.themes,
              combinations: semanticCtx.combinations,
              posts: semanticCtx.posts,
            }
          )
            .filter((l) => !used.has(l.path))
            .slice(0, 6);

          if (links.length < 3) return null;
          return (
            <section className="container mx-auto px-4">
              <SemanticLinkingBlock title="Conexões relacionadas" links={links} />
            </section>
          );
        })()}

        {whatsappHref && (
          <section className="container mx-auto px-4 py-12">
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg md:text-xl font-display font-semibold mb-1">
                  Não encontrou o ideal para {occName.toLowerCase()}?
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

export default CombinationPage;
