/**
 * Fase 12 — SEO Evolution Center.
 *
 * Captura snapshots manuais, mostra evolução de autoridade e
 * regressões detectadas a partir do histórico persistido.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { recordSeoSnapshotBatch, type EntitySnapshotInput, type EntitySnapshotRow } from "@/lib/seoMemory";
import { detectRegressions, regressionRiskScore, type EntitySeries } from "@/lib/regressionEngine";
import { evaluateContentDecay, buildDecayBuckets, contentDecayScore } from "@/lib/contentDecay";
import { evaluateAuthority } from "@/lib/authorityEngine";

export default function AdminSeoEvolution() {
  const qc = useQueryClient();
  const [capturing, setCapturing] = useState(false);

  const { data: live } = useQuery({
    queryKey: ["seo-evolution", "live", "v1"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [cats, occs, segs, themes, products, blog] = await Promise.all([
        supabase.from("categories").select("id, slug, name, description_seo, faqs, updated_at"),
        supabase.from("occasions").select("id, slug, name, description_seo, faqs, updated_at:created_at"),
        supabase.from("segments").select("id, slug, name, description_seo, faqs, updated_at"),
        supabase.from("theme_hubs" as any).select("id, slug, name, authority_score, topical_coverage, readiness_score, thin_content_risk, cannibalization_risk, updated_at"),
        supabase.from("products").select("id, category_id").eq("is_active", true),
        supabase.from("blog_posts").select("id, related_categories, related_occasions, related_segments, related_themes").eq("is_published", true),
      ]);
      return {
        cats: cats.data || [], occs: occs.data || [], segs: segs.data || [],
        themes: (themes.data || []) as any[],
        products: products.data || [], blog: blog.data || [],
      };
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["seo-evolution", "history", "v1"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("seo_entity_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(2000);
      return (data || []) as EntitySnapshotRow[];
    },
  });

  const captureMutation = useMutation({
    mutationFn: async () => {
      if (!live) return { inserted: 0 };
      setCapturing(true);
      const items: EntitySnapshotInput[] = [];
      const prodByCat = new Map<string, number>();
      live.products.forEach((p: any) => p.category_id && prodByCat.set(p.category_id, (prodByCat.get(p.category_id) || 0) + 1));
      const blogFor = (kind: string, id: string) =>
        live.blog.filter((b: any) => Array.isArray(b[`related_${kind}`]) && b[`related_${kind}`].includes(id)).length;

      const pushTax = (type: "category" | "occasion" | "segment", rows: any[], counts: Map<string, number>) => {
        rows.forEach((r) => {
          const c = counts.get(r.id) || 0;
          const faqs = Array.isArray(r.faqs) ? r.faqs : [];
          const editorialLength = (r.description_seo || "").length;
          const auth = evaluateAuthority({
            productsCount: c, occasionsCount: type === "occasion" ? 1 : 0,
            segmentsCount: type === "segment" ? 1 : 0, categoriesCount: type === "category" ? 1 : 0,
            tagsCount: 0, reviewsCount: 0, hasEditorial: editorialLength >= 300,
            goodImagesCount: 0, visualDiversity: 0.3,
            blogPostsCount: blogFor(`${type}ies`, r.id),
            relatedContentCount: 0, internalLinksCount: faqs.length,
          });
          items.push({
            entity_type: type, entity_id: r.id, entity_slug: r.slug, entity_name: r.name,
            authority_score: auth.authority,
            maturity_score: Math.round(auth.authority * 0.6 + auth.topicalCoverage * 0.4),
            readiness_score: Math.round(auth.authority * 0.5 + auth.topicalCoverage * 0.5),
            topical_coverage: auth.topicalCoverage,
            internal_links_count: faqs.length,
            reviews_count: 0,
            faq_count: faqs.length,
            editorial_size: editorialLength,
            semantic_connectivity: Math.min(100, c * 5),
            orphan_risk: c === 0,
            thin_content_risk: auth.thinContentRisk,
            cannibalization_risk: "unknown",
          });
        });
      };
      pushTax("category", live.cats, prodByCat);
      pushTax("occasion", live.occs, new Map());
      pushTax("segment",  live.segs, new Map());

      live.themes.forEach((t: any) => {
        const editorialLength = (t.editorial_content || "").length;
        const faqs = Array.isArray(t.faqs) ? t.faqs : [];
        items.push({
          entity_type: "theme", entity_id: t.id, entity_slug: t.slug, entity_name: t.name,
          authority_score: t.authority_score || 0,
          maturity_score: Math.round((t.authority_score || 0) * 0.7),
          readiness_score: t.readiness_score || 0,
          topical_coverage: t.topical_coverage || 0,
          internal_links_count: 0,
          reviews_count: 0, faq_count: faqs.length, editorial_size: editorialLength,
          semantic_connectivity: 0,
          orphan_risk: false,
          thin_content_risk: !!t.thin_content_risk,
          cannibalization_risk: t.cannibalization_risk || "unknown",
        });
      });

      const res = await recordSeoSnapshotBatch(items);
      setCapturing(false);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (r) => {
      toast.success(`Snapshot capturado: ${r.inserted} entidades`);
      qc.invalidateQueries({ queryKey: ["seo-evolution", "history"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao capturar snapshot"),
  });

  const analysis = useMemo(() => {
    if (!history.length) return null;
    const grouped = new Map<string, EntitySnapshotRow[]>();
    history.forEach((h) => {
      const k = `${h.entity_type}|${h.entity_id}`;
      const arr = grouped.get(k) || []; arr.push(h); grouped.set(k, arr);
    });
    const series: EntitySeries[] = [];
    grouped.forEach((rows, key) => {
      const sorted = [...rows].sort((a, b) => +new Date(a.snapshot_date) - +new Date(b.snapshot_date));
      const [type, id] = key.split("|");
      series.push({
        entityType: type, entityId: id,
        entitySlug: sorted[0]?.entity_slug, entityName: sorted[0]?.entity_name,
        snapshots: sorted,
      });
    });
    const regressions = detectRegressions(series);
    const decayResults = series.map((s) => {
      const last = s.snapshots[s.snapshots.length - 1];
      const first = s.snapshots[0];
      return evaluateContentDecay({
        entityType: s.entityType, entityId: s.entityId,
        entitySlug: s.entitySlug, entityName: s.entityName,
        lastEditedAt: (last as any).updated_at || last.snapshot_date,
        lastSnapshotAt: last.snapshot_date,
        authority: last.authority_score,
        authorityTrend: (last.authority_score ?? 0) - (first.authority_score ?? 0),
        linksTrend: (last.internal_links_count ?? 0) - (first.internal_links_count ?? 0),
        reviewsTrend: (last.reviews_count ?? 0) - (first.reviews_count ?? 0),
        hasRecentBlog: false,
        editorialLength: last.editorial_size,
      });
    });
    const gains = series
      .map((s) => ({ s, delta: (s.snapshots[s.snapshots.length - 1].authority_score ?? 0) - (s.snapshots[0].authority_score ?? 0) }))
      .sort((a, b) => b.delta - a.delta);
    return {
      series, regressions,
      regressionRisk: regressionRiskScore(regressions),
      decayBuckets: buildDecayBuckets(decayResults),
      decayScore: contentDecayScore(decayResults),
      topGains: gains.slice(0, 10),
      topLosses: gains.slice(-10).reverse(),
    };
  }, [history]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6 text-primary" /> SEO Evolution Center</h1>
          <p className="text-sm text-muted-foreground">Histórico estratégico, regressões e decay. SAFE MODE — captura manual.</p>
        </div>
        <Button onClick={() => captureMutation.mutate()} disabled={capturing || captureMutation.isPending}>
          <Save className="w-4 h-4 mr-2" /> {capturing ? "Capturando…" : "Capturar snapshot agora"}
        </Button>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Snapshots</div><div className="text-2xl font-semibold mt-1">{history.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Regression risk</div><div className="text-2xl font-semibold mt-1">{analysis?.regressionRisk ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Content decay</div><div className="text-2xl font-semibold mt-1">{analysis?.decayScore ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Entidades monitoradas</div><div className="text-2xl font-semibold mt-1">{analysis?.series.length ?? 0}</div></CardContent></Card>
      </section>

      {!analysis ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum snapshot ainda. Capture o primeiro para iniciar a memória SEO.</CardContent></Card>
      ) : (
        <Tabs defaultValue="gains">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="gains"><TrendingUp className="w-3.5 h-3.5 mr-1" />Top gains</TabsTrigger>
            <TabsTrigger value="losses"><TrendingDown className="w-3.5 h-3.5 mr-1" />Top losses</TabsTrigger>
            <TabsTrigger value="regressions"><AlertTriangle className="w-3.5 h-3.5 mr-1" />Regressões</TabsTrigger>
            <TabsTrigger value="decay">Decay</TabsTrigger>
          </TabsList>

          <TabsContent value="gains" className="space-y-2">
            {analysis.topGains.map(({ s, delta }) => (
              <div key={s.entityType + s.entityId} className="border rounded-md p-3 flex justify-between items-center">
                <div><p className="text-sm font-medium">{s.entityName}</p><p className="text-xs text-muted-foreground">{s.entityType} · /{s.entitySlug}</p></div>
                <Badge className="bg-emerald-600">+{delta}</Badge>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="losses" className="space-y-2">
            {analysis.topLosses.map(({ s, delta }) => (
              <div key={s.entityType + s.entityId} className="border rounded-md p-3 flex justify-between items-center">
                <div><p className="text-sm font-medium">{s.entityName}</p><p className="text-xs text-muted-foreground">{s.entityType} · /{s.entitySlug}</p></div>
                <Badge variant={delta < 0 ? "destructive" : "secondary"}>{delta}</Badge>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="regressions" className="space-y-2">
            {analysis.regressions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma regressão detectada.</p>
            ) : analysis.regressions.slice(0, 50).map((r, i) => (
              <div key={i} className="border rounded-md p-3">
                <div className="flex justify-between items-center">
                  <div><p className="text-sm font-medium">{r.entityName}</p><p className="text-xs text-muted-foreground">{r.entityType} · /{r.entitySlug}</p></div>
                  <div className="flex gap-2"><Badge variant="outline">{r.regressionType}</Badge><Badge variant={r.severity === "high" ? "destructive" : "secondary"}>{r.severity}</Badge></div>
                </div>
                <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  {r.suggestedActions.map((a, j) => <li key={j}>• {a}</li>)}
                </ul>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="decay" className="space-y-3">
            {(["critical", "decaying", "aging"] as const).map((k) => (
              <Card key={k}>
                <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{k} ({analysis.decayBuckets[k].length})</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {analysis.decayBuckets[k].slice(0, 15).map((d) => (
                    <div key={d.entityType + d.entityId} className="text-sm border rounded p-2 flex justify-between">
                      <span>{d.entityName}</span>
                      <Badge variant="outline">score {d.score}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
