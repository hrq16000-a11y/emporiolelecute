/**
 * Fase 12 — Knowledge Graph Visualizer.
 *
 * Visualização tabular + heatmap simplificado dos clusters, fluxos,
 * órfãos, loops semânticos e áreas fracas. SAFE MODE: só leitura.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Network, AlertTriangle, GitBranch, Layers, Eye, Activity } from "lucide-react";
import { buildKnowledgeGraph, calculateKnowledgeHealth, detectAuthorityLeaks, detectSemanticLoops } from "@/lib/knowledgeGraph";
import { evaluateAuthority } from "@/lib/authorityEngine";

export default function AdminKnowledgeGraph() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "knowledge-graph", "v1"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [cats, occs, segs, tags, themes, combos, products, prodOcc, prodSeg, prodTag, blog] = await Promise.all([
        supabase.from("categories").select("id, slug, name, description_seo, faqs"),
        supabase.from("occasions").select("id, slug, name, description_seo, faqs"),
        supabase.from("segments").select("id, slug, name, description_seo, faqs"),
        supabase.from("tags").select("id, slug, name"),
        supabase.from("theme_hubs" as any).select("id, slug, name, authority_score, topical_coverage, is_approved, thin_content_risk"),
        supabase.from("combination_pages_registry").select("id, path, primary_slug, secondary_slug, authority_score:readiness_score, readiness_score, is_indexable").limit(200),
        supabase.from("products").select("id, slug, name, category_id").eq("is_active", true).limit(1000),
        supabase.from("product_occasions").select("product_id, occasion_id"),
        supabase.from("product_segments").select("product_id, segment_id"),
        supabase.from("product_tags").select("product_id, tag_id"),
        supabase.from("blog_posts").select("id, title, slug, related_categories, related_occasions, related_segments, related_themes, related_tags, related_products").eq("is_published", true),
      ]);
      return {
        cats: cats.data || [], occs: occs.data || [], segs: segs.data || [],
        tags: tags.data || [], themes: (themes.data || []) as any[],
        combos: (combos.data || []) as any[], products: products.data || [],
        prodOcc: prodOcc.data || [], prodSeg: prodSeg.data || [], prodTag: prodTag.data || [],
        blog: blog.data || [],
      };
    },
  });

  const graph = useMemo(() => {
    if (!data) return null;

    const productCountByCat = new Map<string, number>();
    data.products.forEach((p: any) => p.category_id && productCountByCat.set(p.category_id, (productCountByCat.get(p.category_id) || 0) + 1));

    const withAuth = <T extends { id: string; faqs?: any; description_seo?: string }>(
      rows: T[], type: "category" | "occasion" | "segment", counts: Map<string, number>,
    ) => rows.map((r) => {
      const c = counts.get(r.id) || 0;
      const auth = evaluateAuthority({
        productsCount: c, occasionsCount: type === "occasion" ? 1 : 0,
        segmentsCount: type === "segment" ? 1 : 0, categoriesCount: type === "category" ? 1 : 0,
        tagsCount: 0, reviewsCount: 0,
        hasEditorial: ((r.description_seo || "").length) >= 300,
        goodImagesCount: 0, visualDiversity: 0.3, blogPostsCount: 0,
        relatedContentCount: 0, internalLinksCount: Array.isArray(r.faqs) ? r.faqs.length : 0,
      });
      return { ...r, authority: auth.authority, topical: auth.topicalCoverage, thin: auth.thinContentRisk };
    });

    const byOccCount = new Map<string, number>();
    data.prodOcc.forEach((r: any) => byOccCount.set(r.occasion_id, (byOccCount.get(r.occasion_id) || 0) + 1));
    const bySegCount = new Map<string, number>();
    data.prodSeg.forEach((r: any) => bySegCount.set(r.segment_id, (bySegCount.get(r.segment_id) || 0) + 1));

    return buildKnowledgeGraph({
      products: data.products.map((p: any) => ({ ...p, authority: 30 })),
      categories: withAuth(data.cats as any, "category", productCountByCat) as any,
      occasions:  withAuth(data.occs as any, "occasion", byOccCount) as any,
      segments:   withAuth(data.segs as any, "segment", bySegCount) as any,
      tags: data.tags as any,
      themes: data.themes.map((t: any) => ({ ...t, authority: t.authority_score, topical: t.topical_coverage })),
      combinations: data.combos.map((c: any) => ({ id: c.id, path: c.path, primary_slug: c.primary_slug, secondary_slug: c.secondary_slug, authority: c.readiness_score, readiness: c.readiness_score, approved: c.is_indexable })),
      blogPosts: data.blog as any,
      productOccasions: data.prodOcc as any,
      productSegments: data.prodSeg as any,
      productTags: data.prodTag as any,
    });
  }, [data]);

  if (isLoading || !graph) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="h-6 w-6 text-primary" /> Knowledge Graph</h1>
        <Card className="mt-4"><CardContent className="p-8 text-center text-muted-foreground">Construindo grafo semântico…</CardContent></Card>
      </div>
    );
  }

  const health = calculateKnowledgeHealth(graph);
  const leaks = detectAuthorityLeaks(graph.nodes, graph.edges);
  const loops = detectSemanticLoops(graph.edges);
  const maxAuth = Math.max(1, ...graph.clusters.map((c) => c.authorityAvg));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="h-6 w-6 text-primary" /> Knowledge Graph</h1>
        <p className="text-sm text-muted-foreground">Visão semântica completa. {graph.nodes.length} nós · {graph.edges.length} arestas · {graph.clusters.length} clusters</p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Knowledge Health</div><div className="text-2xl font-semibold mt-1">{health.score}</div><Badge className="mt-1" variant="outline">{health.rating}</Badge></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Órfãos</div><div className="text-2xl font-semibold mt-1">{graph.orphanNodes.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Áreas fracas</div><div className="text-2xl font-semibold mt-1">{graph.weakAreas.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Loops semânticos</div><div className="text-2xl font-semibold mt-1">{loops.length}</div></CardContent></Card>
      </section>

      <Tabs defaultValue="clusters">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="clusters"><Layers className="w-3.5 h-3.5 mr-1" />Clusters</TabsTrigger>
          <TabsTrigger value="flow"><GitBranch className="w-3.5 h-3.5 mr-1" />Authority Flow</TabsTrigger>
          <TabsTrigger value="weak"><AlertTriangle className="w-3.5 h-3.5 mr-1" />Weak Areas</TabsTrigger>
          <TabsTrigger value="loops">Loops</TabsTrigger>
          <TabsTrigger value="orphans">Órfãos</TabsTrigger>
          <TabsTrigger value="leaks"><Eye className="w-3.5 h-3.5 mr-1" />Authority Leaks</TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="space-y-2">
          {graph.clusters.sort((a, b) => b.authorityAvg - a.authorityAvg).map((c) => {
            const intensity = Math.round((c.authorityAvg / maxAuth) * 100);
            return (
              <div key={c.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.nodeIds.length} entidades</p>
                  </div>
                  <Badge variant="outline">{c.authorityAvg} authority</Badge>
                </div>
                <div className="mt-2 h-2 bg-muted rounded">
                  <div className="h-2 rounded bg-primary" style={{ width: `${intensity}%` }} />
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="flow" className="space-y-2">
          {graph.authorityFlows.slice(0, 30).map((f, i) => (
            <div key={i} className="text-sm border rounded-md p-2 flex justify-between">
              <span className="truncate">{f.fromCluster} → {f.toNode}</span>
              <Badge variant="secondary">flow {f.estimatedFlow}</Badge>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="weak" className="space-y-2">
          {graph.weakAreas.map((w, i) => (
            <div key={i} className="border rounded-md p-3 text-sm flex justify-between items-center">
              <span>{w.clusterId}</span>
              <div className="flex gap-2"><Badge variant="outline">{w.reason}</Badge><Badge variant="destructive">{w.score}</Badge></div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="loops" className="space-y-2">
          {loops.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum loop bidirecional detectado.</p>
          ) : loops.map((l, i) => (
            <div key={i} className="text-sm border rounded-md p-2 flex justify-between">
              <span>{l.a} ↔ {l.b}</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="orphans" className="space-y-1">
          {graph.orphanNodes.slice(0, 80).map((n) => (
            <div key={n.id} className="text-sm border rounded-md p-2 flex justify-between">
              <span>{n.name}</span>
              <Badge variant="outline">{n.type}</Badge>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="leaks" className="space-y-1">
          {leaks.map((l, i) => (
            <div key={i} className="text-sm border rounded-md p-2 flex justify-between">
              <span>{l.from.name}</span>
              <div className="flex gap-2"><Badge variant="outline">{l.from.type}</Badge><Badge variant="secondary">auth {l.from.authority}</Badge></div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10">
        <CardContent className="p-4 text-xs text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-600" /> SAFE MODE: nenhuma ação aplicada. Visualização puramente analítica.
        </CardContent>
      </Card>
    </div>
  );
}
