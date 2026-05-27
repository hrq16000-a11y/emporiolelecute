/**
 * Fase 11 — SEO Operations Dashboard.
 *
 * Visão executiva consolidada da operação SEO/editorial.
 * Apenas leitura — não altera nada.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, BookOpen, Image, Link2, ShieldCheck, Sparkles, Star, TrendingUp } from "lucide-react";
import {
  buildExecutionBuckets,
  type EditorialTargetInput,
} from "@/lib/editorialPriorities";

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: any;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "bad" ? "text-rose-600"
    : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${toneClass}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminSeoOperations() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "seo-ops"],
    queryFn: async () => {
      const [
        themes,
        combos,
        categories,
        occasions,
        segments,
        products,
        reviews,
        posts,
      ] = await Promise.all([
        supabase.from("theme_hubs" as any).select("id, slug, name, authority_score, readiness_score, topical_coverage, in_sitemap, is_approved, thin_content_risk, product_count, products_count"),
        supabase.from("combination_pages_registry").select("id, path, readiness_score, topical_coverage, thin_content_risk, is_indexable"),
        supabase.from("categories").select("id, slug, name, description_seo, faqs"),
        supabase.from("occasions").select("id, slug, name, description_seo, faqs"),
        supabase.from("segments").select("id, slug, name, description_seo, faqs"),
        supabase.from("products").select("id, images").eq("is_active", true),
        supabase.from("product_reviews").select("product_id").eq("is_visible", true),
        supabase.from("blog_posts").select("id, content, related_categories, related_occasions, related_segments, related_themes, is_published"),
      ]);

      return {
        themes: themes.data || [],
        combos: combos.data || [],
        categories: categories.data || [],
        occasions: occasions.data || [],
        segments: segments.data || [],
        products: products.data || [],
        reviews: reviews.data || [],
        posts: posts.data || [],
      };
    },
  });

  const metrics = useMemo(() => {
    if (!data) return null;
    const totalTaxonomies = data.categories.length + data.occasions.length + data.segments.length;
    const taxonomiesWithEditorial = [...data.categories, ...data.occasions, ...data.segments].filter(
      (t: any) => (t.description_seo || "").length >= 300,
    ).length;
    const taxonomiesWithFaq = [...data.categories, ...data.occasions, ...data.segments].filter(
      (t: any) => Array.isArray(t.faqs) && t.faqs.length > 0,
    ).length;

    const totalProducts = data.products.length;
    const productsWithImages = data.products.filter((p: any) => (p.images?.length ?? 0) >= 2).length;
    const productsWithReviews = new Set(data.reviews.map((r: any) => r.product_id)).size;

    const themesApproved = data.themes.filter((t: any) => t.is_approved).length;
    const themesInSitemap = data.themes.filter((t: any) => t.in_sitemap).length;
    const themesThin = data.themes.filter((t: any) => t.thin_content_risk).length;
    const avgThemeAuthority = data.themes.length
      ? Math.round(
          data.themes.reduce((s: number, t: any) => s + (t.authority_score || 0), 0) / data.themes.length,
        )
      : 0;
    const avgThemeReadiness = data.themes.length
      ? Math.round(
          data.themes.reduce((s: number, t: any) => s + (t.readiness_score || 0), 0) / data.themes.length,
        )
      : 0;

    const combosIndexable = data.combos.filter((c: any) => c.is_indexable).length;
    const combosThin = data.combos.filter((c: any) => c.thin_content_risk).length;

    const publishedPosts = data.posts.filter((p: any) => p.is_published).length;
    const postsWithoutLinks = data.posts.filter((p: any) => {
      const rel = [
        ...(p.related_categories || []),
        ...(p.related_occasions || []),
        ...(p.related_segments || []),
        ...(p.related_themes || []),
      ];
      return rel.length === 0;
    }).length;

    const reviewCoverage = totalProducts ? Math.round((productsWithReviews / totalProducts) * 100) : 0;
    const editorialCoverage = totalTaxonomies ? Math.round((taxonomiesWithEditorial / totalTaxonomies) * 100) : 0;
    const imageCoverage = totalProducts ? Math.round((productsWithImages / totalProducts) * 100) : 0;

    return {
      totalTaxonomies,
      taxonomiesWithEditorial,
      taxonomiesWithFaq,
      totalProducts,
      productsWithImages,
      productsWithReviews,
      themesApproved,
      themesInSitemap,
      themesThin,
      avgThemeAuthority,
      avgThemeReadiness,
      combosIndexable,
      combosThin,
      publishedPosts,
      postsWithoutLinks,
      reviewCoverage,
      editorialCoverage,
      imageCoverage,
    };
  }, [data]);

  const buckets = useMemo(() => {
    if (!data) return null;
    const inputs: EditorialTargetInput[] = [];
    // só amostragem para top opportunities/risks
    [...data.categories, ...data.occasions, ...data.segments].forEach((t: any) => {
      const type = data.categories.includes(t) ? "category" : data.occasions.includes(t) ? "occasion" : "segment";
      inputs.push({
        type: type as any,
        slug: t.slug,
        name: t.name,
        editorialLength: (t.description_seo || "").length,
        hasFaq: Array.isArray(t.faqs) && t.faqs.length > 0,
        hasMeta: true,
        hasHeroImage: false,
        signals: {
          productsCount: 0, occasionsCount: 0, segmentsCount: 0, categoriesCount: 0, tagsCount: 0,
          reviewsCount: 0, hasEditorial: (t.description_seo || "").length >= 300,
          goodImagesCount: 0, visualDiversity: 0, blogPostsCount: 0, relatedContentCount: 0, internalLinksCount: 0,
        },
      });
    });
    return buildExecutionBuckets(inputs);
  }, [data]);

  if (isLoading || !metrics) {
    return <div className="p-4 sm:p-6 text-sm text-muted-foreground">Carregando dashboard…</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" /> SEO Operations
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Dashboard executivo da operação editorial. Foco em autoridade real,
            cobertura editorial e densidade temática (SAFE MODE).
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/editorial-execution" className="text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground">
            Abrir Execution Center
          </Link>
          <Link to="/admin/authority" className="text-sm px-3 py-2 rounded-lg border">
            Authority Center
          </Link>
        </div>
      </div>

      {/* Authority Growth */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Authority Growth
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Authority médio (hubs)" value={metrics.avgThemeAuthority} icon={TrendingUp} tone="good" />
          <Stat label="Readiness médio (hubs)" value={metrics.avgThemeReadiness} icon={ShieldCheck} />
          <Stat label="Hubs aprovados" value={metrics.themesApproved} icon={Sparkles} hint={`${data!.themes.length} totais`} />
          <Stat label="Hubs no sitemap" value={metrics.themesInSitemap} icon={ShieldCheck} tone="good" />
        </div>
      </section>

      {/* Editorial Coverage */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Editorial Coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Cobertura editorial" value={`${metrics.editorialCoverage}%`} icon={BookOpen}
            tone={metrics.editorialCoverage >= 60 ? "good" : "warn"} />
          <Stat label="Taxonomias com FAQ" value={metrics.taxonomiesWithFaq} icon={BookOpen}
            hint={`${metrics.totalTaxonomies} taxonomias`} />
          <Stat label="Posts publicados" value={metrics.publishedPosts} icon={BookOpen} />
          <Stat label="Posts órfãos (sem links)" value={metrics.postsWithoutLinks} icon={Link2}
            tone={metrics.postsWithoutLinks > 0 ? "warn" : "good"} />
        </div>
      </section>

      {/* Thin Content & Sitemap */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Risco & Sitemap
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Hubs thin" value={metrics.themesThin} icon={AlertTriangle}
            tone={metrics.themesThin > 0 ? "bad" : "good"} />
          <Stat label="Combos thin" value={metrics.combosThin} icon={AlertTriangle}
            tone={metrics.combosThin > 0 ? "warn" : "good"} />
          <Stat label="Combos indexáveis" value={metrics.combosIndexable} icon={ShieldCheck} />
          <Stat label="Sitemap qualidade" value={metrics.themesInSitemap + metrics.combosIndexable}
            icon={Activity} hint="hubs + combos elegíveis" />
        </div>
      </section>

      {/* Coverage operacional */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Operação
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Cobertura de reviews" value={`${metrics.reviewCoverage}%`} icon={Star}
            tone={metrics.reviewCoverage >= 40 ? "good" : "warn"} />
          <Stat label="Cobertura de imagens" value={`${metrics.imageCoverage}%`} icon={Image}
            tone={metrics.imageCoverage >= 70 ? "good" : "warn"} />
          <Stat label="Produtos ativos" value={metrics.totalProducts} icon={Sparkles} />
          <Stat label="Produtos com review" value={metrics.productsWithReviews} icon={Star} />
        </div>
      </section>

      {/* Top opportunities / risks */}
      {buckets && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Oportunidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {buckets.highPotential.slice(0, 8).map((t) => (
                <div key={`${t.type}-${t.slug}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{t.name} <span className="text-xs text-muted-foreground">/{t.slug}</span></span>
                  <Badge variant="secondary">A {t.authority}</Badge>
                </div>
              ))}
              {buckets.highPotential.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem oportunidades evidentes.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Riscos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {buckets.thinContent.slice(0, 8).map((t) => (
                <div key={`${t.type}-${t.slug}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{t.name} <span className="text-xs text-muted-foreground">/{t.slug}</span></span>
                  <Badge variant="destructive">thin</Badge>
                </div>
              ))}
              {buckets.thinContent.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum risco crítico ✨</p>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
