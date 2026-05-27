/**
 * Fase 11 — Editorial Execution Center.
 *
 * Centro operacional editorial. Reúne todos os sinais da infra
 * (taxonomias, hubs temáticos, reviews, imagens, blog, links) num único
 * painel orientado a AÇÃO HUMANA.
 *
 * SAFE MODE: nada aqui publica, indexa ou altera SEO automaticamente.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  buildExecutionBuckets,
  type EditorialTarget,
  type EditorialTargetInput,
} from "@/lib/editorialPriorities";
import EditorialActionChecklist from "@/components/admin/EditorialActionChecklist";
import { Sparkles, TrendingUp } from "lucide-react";

function priorityVariant(p: EditorialTarget["priority"]) {
  if (p === "critical") return "destructive" as const;
  if (p === "high") return "default" as const;
  if (p === "medium") return "secondary" as const;
  return "outline" as const;
}

function TargetCard({
  target,
  onSelect,
  selected,
}: {
  target: EditorialTarget;
  onSelect: (t: EditorialTarget) => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(target)}
      className={`text-left w-full rounded-lg border p-4 transition-all hover:border-primary/50 ${
        selected ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{target.name}</p>
          <p className="text-xs text-muted-foreground">
            {target.type} · /{target.slug}
          </p>
        </div>
        <Badge variant={priorityVariant(target.priority)}>{target.priority}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Authority" value={target.authority} />
        <Metric label="Readiness" value={target.readiness} />
        <Metric label="Cobertura" value={target.topicalCoverage} />
        <Metric label="Produtos" value={target.productsCount} />
        <Metric label="Reviews" value={target.reviewsCount} />
        <Metric label="Links" value={target.internalLinksCount} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {target.thinContentRisk && (
          <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">
            thin
          </Badge>
        )}
        {target.inSitemap && (
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
            sitemap
          </Badge>
        )}
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-muted/40 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function TargetList({
  targets,
  selectedSlug,
  onSelect,
}: {
  targets: EditorialTarget[];
  selectedSlug: string | null;
  onSelect: (t: EditorialTarget) => void;
}) {
  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Nada por aqui ✨
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {targets.slice(0, 40).map((t) => (
        <TargetCard
          key={`${t.type}-${t.slug}`}
          target={t}
          onSelect={onSelect}
          selected={selectedSlug === `${t.type}:${t.slug}`}
        />
      ))}
    </div>
  );
}

export default function AdminEditorialExecution() {
  const [selected, setSelected] = useState<EditorialTarget | null>(null);

  const { data: inputs = [], isLoading } = useQuery({
    queryKey: ["admin", "editorial-execution", "inputs"],
    queryFn: async (): Promise<EditorialTargetInput[]> => {
      const [
        categoriesRes,
        occasionsRes,
        segmentsRes,
        themesRes,
        productsRes,
        productOccRes,
        productSegRes,
        reviewsRes,
        blogRes,
      ] = await Promise.all([
        supabase.from("categories").select("id, slug, name, description_seo, faqs, image_url"),
        supabase.from("occasions").select("id, slug, name, description_seo, faqs, image_url"),
        supabase.from("segments").select("id, slug, name, description_seo, faqs, image_url"),
        supabase.from("theme_hubs" as any).select("*"),
        supabase.from("products").select("id, category_id, images").eq("is_active", true),
        supabase.from("product_occasions").select("product_id, occasion_id"),
        supabase.from("product_segments").select("product_id, segment_id"),
        supabase.from("product_reviews").select("product_id").eq("is_visible", true),
        supabase.from("blog_posts").select("id, related_categories, related_occasions, related_segments, related_themes").eq("is_published", true),
      ]);

      const products = productsRes.data || [];
      const reviews = reviewsRes.data || [];
      const blogPosts = blogRes.data || [];

      const reviewByProduct = new Map<string, number>();
      reviews.forEach((r: any) => {
        reviewByProduct.set(r.product_id, (reviewByProduct.get(r.product_id) || 0) + 1);
      });

      const productsByCategory = new Map<string, string[]>();
      products.forEach((p: any) => {
        if (!p.category_id) return;
        const arr = productsByCategory.get(p.category_id) || [];
        arr.push(p.id);
        productsByCategory.set(p.category_id, arr);
      });
      const productsByOccasion = new Map<string, string[]>();
      (productOccRes.data || []).forEach((r: any) => {
        const arr = productsByOccasion.get(r.occasion_id) || [];
        arr.push(r.product_id);
        productsByOccasion.set(r.occasion_id, arr);
      });
      const productsBySegment = new Map<string, string[]>();
      (productSegRes.data || []).forEach((r: any) => {
        const arr = productsBySegment.get(r.segment_id) || [];
        arr.push(r.product_id);
        productsBySegment.set(r.segment_id, arr);
      });

      const visualDiversity = (productIds: string[]): number => {
        if (productIds.length === 0) return 0;
        const imageSet = new Set<string>();
        let counted = 0;
        for (const pid of productIds) {
          const p: any = products.find((x: any) => x.id === pid);
          if (!p) continue;
          (p.images || []).forEach((u: string) => imageSet.add(u));
          counted += 1;
        }
        if (counted === 0) return 0;
        return Math.min(1, imageSet.size / Math.max(1, counted * 2));
      };
      const goodImages = (productIds: string[]): number => {
        return productIds.reduce((acc, pid) => {
          const p: any = products.find((x: any) => x.id === pid);
          return acc + ((p?.images?.length ?? 0) >= 2 ? 1 : 0);
        }, 0);
      };
      const reviewsFor = (productIds: string[]): number =>
        productIds.reduce((acc, pid) => acc + (reviewByProduct.get(pid) || 0), 0);

      const blogCountFor = (kind: "category" | "occasion" | "segment" | "theme", id: string): number =>
        blogPosts.filter((p: any) => {
          const arr =
            kind === "category" ? p.related_categories
            : kind === "occasion" ? p.related_occasions
            : kind === "segment" ? p.related_segments
            : p.related_themes;
          return Array.isArray(arr) && arr.includes(id);
        }).length;

      const out: EditorialTargetInput[] = [];

      const pushTaxonomy = (
        type: "category" | "occasion" | "segment",
        rows: any[] | null,
        idToProducts: Map<string, string[]>,
      ) => {
        (rows || []).forEach((row) => {
          const productIds = idToProducts.get(row.id) || [];
          const editorialLength = (row.description_seo || "").length;
          const faqs = Array.isArray(row.faqs) ? row.faqs : [];
          out.push({
            type,
            slug: row.slug,
            name: row.name,
            editorialLength,
            hasFaq: faqs.length > 0,
            hasMeta: true,
            hasHeroImage: !!row.image_url,
            signals: {
              productsCount: productIds.length,
              occasionsCount: type === "occasion" ? 1 : 0,
              segmentsCount: type === "segment" ? 1 : 0,
              categoriesCount: type === "category" ? 1 : 0,
              tagsCount: 0,
              reviewsCount: reviewsFor(productIds),
              hasEditorial: editorialLength >= 300,
              goodImagesCount: goodImages(productIds),
              visualDiversity: visualDiversity(productIds),
              blogPostsCount: blogCountFor(type, row.id),
              relatedContentCount: 0,
              internalLinksCount: faqs.length + (row.description_seo ? 2 : 0),
            },
          });
        });
      };

      pushTaxonomy("category", categoriesRes.data, productsByCategory);
      pushTaxonomy("occasion", occasionsRes.data, productsByOccasion);
      pushTaxonomy("segment", segmentsRes.data, productsBySegment);

      (themesRes.data || []).forEach((row: any) => {
        out.push({
          type: "theme",
          slug: row.slug,
          name: row.name || row.slug,
          editorialLength: (row.editorial_content || row.intro || "").length,
          hasFaq: Array.isArray(row.faqs) && row.faqs.length > 0,
          hasMeta: !!(row.meta_title && row.meta_description),
          hasHeroImage: !!(row.hero_image_url || row.image_url),
          approved: !!row.is_approved,
          inSitemap: !!row.in_sitemap,
          readinessScore: row.readiness_score ?? undefined,
          signals: {
            productsCount: row.product_count ?? row.products_count ?? 0,
            occasionsCount: row.occasions_count ?? 0,
            segmentsCount: row.segments_count ?? 0,
            categoriesCount: row.categories_count ?? 0,
            tagsCount: 0,
            reviewsCount: row.reviews_count ?? 0,
            hasEditorial: (row.editorial_content?.length ?? 0) >= 300,
            goodImagesCount: row.good_images_count ?? 0,
            visualDiversity: row.visual_diversity ?? 0.3,
            blogPostsCount: blogCountFor("theme", row.id),
            relatedContentCount: row.related_count ?? 0,
            internalLinksCount: row.internal_links_count ?? 0,
          },
        });
      });

      return out;
    },
  });

  const buckets = useMemo(() => buildExecutionBuckets(inputs), [inputs]);

  const tabs = [
    { key: "priorityMax", label: "Prioridade Máxima", list: buckets.priorityMax },
    { key: "highPotential", label: "Potencial Alto", list: buckets.highPotential },
    { key: "thinContent", label: "Thin Content", list: buckets.thinContent },
    { key: "noFaq", label: "Sem FAQ", list: buckets.noFaq },
    { key: "noEditorial", label: "Sem Editorial", list: buckets.noEditorial },
    { key: "fewReviews", label: "Poucas Reviews", list: buckets.fewReviews },
    { key: "weakImages", label: "Imagens Fracas", list: buckets.weakImages },
    { key: "strongHubs", label: "Hubs Fortes", list: buckets.strongHubs },
    { key: "premium", label: "Premium", list: buckets.premium },
  ];

  const selectedKey = selected ? `${selected.type}:${selected.slug}` : null;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" /> Editorial Execution Center
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Operação editorial premium em <strong>SAFE MODE</strong>. Nenhuma ação aqui publica,
            indexa ou altera SEO automaticamente — tudo é orientação para curadoria humana.
          </p>
        </div>
        <Card className="min-w-[220px]">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Entidades analisadas
            </p>
            <p className="text-3xl font-bold">{inputs.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {buckets.priorityMax.length} críticas · {buckets.thinContent.length} thin
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando sinais…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="priorityMax">
            <TabsList className="flex flex-wrap h-auto">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="text-xs">
                  {t.label}
                  <Badge variant="outline" className="ml-2 h-4 text-[10px]">{t.list.length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.key} value={t.key} className="mt-4">
                <TargetList targets={t.list} selectedSlug={selectedKey} onSelect={setSelected} />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{selected.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selected.type} · /{selected.slug}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Metric label="Authority" value={selected.authority} />
                    <Metric label="Readiness" value={selected.readiness} />
                    <Metric label="Cobertura" value={selected.topicalCoverage} />
                    <Metric label="Editorial" value={selected.editorialLength} />
                  </div>
                  {selected.suggested_actions.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Ações sugeridas
                      </p>
                      <ul className="text-sm space-y-1">
                        {selected.suggested_actions.map((a) => (
                          <li key={a} className="text-foreground">• {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
              <EditorialActionChecklist target={selected} />
            </>
          ) : (
            <Card>
              <CardContent className="p-4 sm:p-6 text-sm text-muted-foreground text-center">
                Selecione uma entidade ao lado para ver checklist e ações sugeridas.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
