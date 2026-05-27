/**
 * Fase 11.1 — SEO Link Health Dashboard.
 *
 * Visualiza saúde do linking semântico SEM executar nenhuma ação destrutiva.
 * Apenas leitura agregada de:
 *   - overlinking
 *   - órfãos
 *   - profundidade
 *   - top authority flows
 *   - links bloqueados pela governança
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, AlertTriangle, Link2, GitBranch, ShieldOff } from "lucide-react";
import { detectOverlinking, type OverlinkLink } from "@/lib/internalLinking";
import { computeTelemetry } from "@/lib/seoTelemetry";
import {
  buildContextualLinksForTheme,
  buildContextualLinksForCombination,
  buildContextualLinksForTaxonomy,
} from "@/lib/linkOrchestrator";
import { canBeIndexed, type IndexableEntity } from "@/lib/indexationGovernance";

interface HubRow {
  id: string;
  slug: string;
  title: string;
  authority_score: number;
  readiness_score: number;
  topical_coverage: number;
  internal_links_count: number;
  is_approved: boolean;
  is_indexed: boolean;
  thin_content_risk: boolean;
  cannibalization_risk: string;
}

interface ComboRow {
  id: string;
  path: string;
  primary_slug: string;
  secondary_slug: string;
  quality_score: number;
  readiness_score: number;
  topical_coverage: number;
  internal_links_count: number;
  discovery_status: string;
  is_indexable: boolean;
  thin_content_risk: boolean;
  cannibalization_risk: string;
}

interface TaxRow {
  id: string;
  slug: string;
  name: string;
  is_indexed: boolean | null;
}

const STALE = 5 * 60 * 1000;

function depthOf(path: string): number {
  return path.split("/").filter(Boolean).length;
}

function asEntity(r: HubRow | ComboRow): IndexableEntity {
  return {
    id: r.id,
    slug: "slug" in r ? r.slug : r.path,
    approved: "is_approved" in r ? r.is_approved : r.discovery_status === "approved",
    is_indexed: "is_indexed" in r ? r.is_indexed : r.is_indexable,
    authority_score: "authority_score" in r ? r.authority_score : r.quality_score,
    readiness_score: r.readiness_score,
    topical_coverage: r.topical_coverage,
    thin_content_risk: r.thin_content_risk,
    cannibalization_risk: (r.cannibalization_risk as IndexableEntity["cannibalization_risk"]) || "none",
    internal_links_count: r.internal_links_count,
  };
}

export default function AdminLinkHealth() {
  const themesQ = useQuery({
    queryKey: ["link-health", "themes"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("theme_hubs")
        .select("id, slug, title, authority_score, readiness_score, topical_coverage, internal_links_count, is_approved, is_indexed, thin_content_risk, cannibalization_risk")
        .order("authority_score", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as HubRow[];
    },
  });

  const combosQ = useQuery({
    queryKey: ["link-health", "combinations"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combination_pages_registry")
        .select("id, path, primary_slug, secondary_slug, quality_score, readiness_score, topical_coverage, internal_links_count, discovery_status, is_indexable, thin_content_risk, cannibalization_risk")
        .order("quality_score", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ComboRow[];
    },
  });

  const taxQ = useQuery({
    queryKey: ["link-health", "taxonomies"],
    staleTime: STALE,
    queryFn: async () => {
      const [cats, occs, segs] = await Promise.all([
        supabase.from("categories").select("id, slug, name, is_indexed").limit(200),
        supabase.from("occasions").select("id, slug, name, is_indexed").limit(200),
        supabase.from("segments").select("id, slug, name, is_indexed").limit(200),
      ]);
      return {
        categories: (cats.data || []) as TaxRow[],
        occasions: (occs.data || []) as TaxRow[],
        segments: (segs.data || []) as TaxRow[],
      };
    },
  });

  const loading = themesQ.isLoading || combosQ.isLoading || taxQ.isLoading;

  const themes = themesQ.data ?? [];
  const combos = combosQ.data ?? [];
  const tax = taxQ.data ?? { categories: [], occasions: [], segments: [] };

  const ctx = useMemo(
    () => ({
      themes: themes.filter((t) => t.is_approved && t.is_indexed).map((t) => ({
        id: t.id, slug: t.slug, name: t.title, title: t.title,
        approved: true, is_indexed: true,
        authority_score: t.authority_score, readiness_score: t.readiness_score,
        topical_coverage: t.topical_coverage, thin_content_risk: t.thin_content_risk,
        cannibalization_risk: t.cannibalization_risk as IndexableEntity["cannibalization_risk"],
        internal_links_count: t.internal_links_count,
      })),
      combinations: combos.filter((c) => c.discovery_status === "approved" && c.is_indexable).map((c) => ({
        id: c.id, slug: c.path, path: c.path, name: `${c.primary_slug} · ${c.secondary_slug}`,
        approved: true, is_indexed: true,
        authority_score: c.quality_score, readiness_score: c.readiness_score,
        topical_coverage: c.topical_coverage, thin_content_risk: c.thin_content_risk,
        cannibalization_risk: c.cannibalization_risk as IndexableEntity["cannibalization_risk"],
        internal_links_count: c.internal_links_count,
      })),
      posts: [] as Array<{ id: string; slug: string; name: string }>,
    }),
    [themes, combos]
  );

  // Simula linking de cada hub/combo/taxonomy via orchestrator
  const simulations = useMemo(() => {
    type Row = {
      kind: "theme" | "combination" | "category" | "occasion" | "segment";
      path: string;
      label: string;
      links: { href: string; type: string }[];
      depth: number;
      authority?: number;
    };
    const rows: Row[] = [];
    for (const t of themes) {
      const links = buildContextualLinksForTheme({ slug: t.slug }, ctx);
      rows.push({
        kind: "theme", path: `/tema/${t.slug}`, label: t.title,
        links: links.map((l) => ({ href: l.path, type: l.type })),
        depth: depthOf(`/tema/${t.slug}`), authority: t.authority_score,
      });
    }
    for (const c of combos) {
      const links = buildContextualLinksForCombination({ path: c.path }, ctx);
      rows.push({
        kind: "combination", path: c.path, label: `${c.primary_slug} · ${c.secondary_slug}`,
        links: links.map((l) => ({ href: l.path, type: l.type })),
        depth: depthOf(c.path), authority: c.quality_score,
      });
    }
    for (const cat of tax.categories) {
      const links = buildContextualLinksForTaxonomy({ slug: cat.slug, kind: "category" }, ctx);
      rows.push({
        kind: "category", path: `/categoria/${cat.slug}`, label: cat.name,
        links: links.map((l) => ({ href: l.path, type: l.type })),
        depth: depthOf(`/categoria/${cat.slug}`),
      });
    }
    for (const o of tax.occasions) {
      const links = buildContextualLinksForTaxonomy({ slug: o.slug, kind: "occasion" }, ctx);
      rows.push({
        kind: "occasion", path: `/ocasiao/${o.slug}`, label: o.name,
        links: links.map((l) => ({ href: l.path, type: l.type })),
        depth: depthOf(`/ocasiao/${o.slug}`),
      });
    }
    for (const s of tax.segments) {
      const links = buildContextualLinksForTaxonomy({ slug: s.slug, kind: "segment" }, ctx);
      rows.push({
        kind: "segment", path: `/segmento/${s.slug}`, label: s.name,
        links: links.map((l) => ({ href: l.path, type: l.type })),
        depth: depthOf(`/segmento/${s.slug}`),
      });
    }
    return rows;
  }, [themes, combos, tax, ctx]);

  const overlinking = useMemo(
    () =>
      simulations
        .map((r) => {
          const verdict = detectOverlinking(r.links.map<OverlinkLink>((l) => ({ href: l.href, type: l.type, depth: depthOf(l.href) })));
          return { ...r, verdict };
        })
        .filter((r) => r.verdict.risk !== "low")
        .sort((a, b) => a.verdict.score - b.verdict.score),
    [simulations]
  );

  const orphans = useMemo(() => simulations.filter((r) => r.links.length < 3), [simulations]);

  const deepPages = useMemo(() => simulations.filter((r) => r.depth > 3).sort((a, b) => b.depth - a.depth), [simulations]);

  const topFlows = useMemo(
    () =>
      simulations
        .filter((r) => (r.authority ?? 0) >= 70 && r.links.length >= 4)
        .sort((a, b) => (b.authority ?? 0) - (a.authority ?? 0))
        .slice(0, 20),
    [simulations]
  );

  const blocked = useMemo(() => {
    type Block = { source: string; target: string; reasons: string[] };
    const out: Block[] = [];
    const candidates: IndexableEntity[] = [
      ...themes.map(asEntity),
      ...combos.map(asEntity),
    ];
    for (const e of candidates) {
      const r = canBeIndexed(e);
      if (!r.allowed) {
        out.push({
          source: "(governança global)",
          target: e.slug ?? e.id ?? "?",
          reasons: r.reasons,
        });
      }
    }
    return out.slice(0, 100);
  }, [themes, combos]);

  const telemetry = useMemo(() => {
    const entities: IndexableEntity[] = [...themes.map(asEntity), ...combos.map(asEntity)];
    const totalLinks = simulations.reduce((a, r) => a + r.links.length, 0);
    const overlinkedPages = overlinking.length;
    const orphanEntities = orphans.length;
    return computeTelemetry(entities, { totalLinks, overlinkedPages, orphanEntities });
  }, [themes, combos, simulations, overlinking, orphans]);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando saúde de links…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <Helmet>
        <title>Saúde de Links — Admin</title>
      </Helmet>

      <header className="space-y-1">
        <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Saúde de Links Semânticos
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão de overlinking, órfãos, profundidade, fluxos de autoridade e links bloqueados.
          Apenas leitura — SAFE MODE absoluto.
        </p>
      </header>

      {/* Telemetry */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          ["Links totais", telemetry.total_contextual_links],
          ["Média/página", telemetry.avg_links_per_page],
          ["Overlinked", telemetry.overlinked_pages],
          ["Órfãos", telemetry.orphan_entities],
          ["Authority flow", telemetry.authority_flow_score],
          ["Conectividade", `${telemetry.semantic_connectivity_score}%`],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="py-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="text-xl font-semibold text-foreground mt-1">{String(value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overlinking">
        <TabsList>
          <TabsTrigger value="overlinking"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Overlinking</TabsTrigger>
          <TabsTrigger value="orphans"><Link2 className="w-3.5 h-3.5 mr-1" /> Órfãos</TabsTrigger>
          <TabsTrigger value="depth"><GitBranch className="w-3.5 h-3.5 mr-1" /> Profundidade</TabsTrigger>
          <TabsTrigger value="flows">Top Authority Flows</TabsTrigger>
          <TabsTrigger value="blocked"><ShieldOff className="w-3.5 h-3.5 mr-1" /> Bloqueados</TabsTrigger>
        </TabsList>

        <TabsContent value="overlinking">
          <Card>
            <CardHeader><CardTitle>Páginas com overlinking</CardTitle></CardHeader>
            <CardContent>
              {overlinking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum overlinking detectado.</p>
              ) : (
                <ul className="divide-y">
                  {overlinking.slice(0, 50).map((r) => (
                    <li key={r.path} className="py-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.verdict.risk === "high" ? "destructive" : "outline"}>{r.verdict.risk}</Badge>
                        <span className="font-medium text-sm">{r.label}</span>
                        <code className="text-xs text-muted-foreground">{r.path}</code>
                        <span className="ml-auto text-xs">score {r.verdict.score}</span>
                      </div>
                      {r.verdict.reasons.length > 0 && (
                        <div className="text-xs text-muted-foreground">{r.verdict.reasons.join(" · ")}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphans">
          <Card>
            <CardHeader><CardTitle>Entidades órfãs (&lt;3 links contextuais)</CardTitle></CardHeader>
            <CardContent>
              {orphans.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem órfãos.</p>
              ) : (
                <ul className="divide-y">
                  {orphans.slice(0, 80).map((r) => (
                    <li key={r.path} className="py-2 flex items-center gap-2 text-sm">
                      <Badge variant="outline">{r.kind}</Badge>
                      <span className="font-medium">{r.label}</span>
                      <code className="text-xs text-muted-foreground">{r.path}</code>
                      <span className="ml-auto text-xs text-muted-foreground">{r.links.length} links</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depth">
          <Card>
            <CardHeader><CardTitle>Páginas profundas (&gt;3 hops)</CardTitle></CardHeader>
            <CardContent>
              {deepPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Arquitetura plana — sem páginas profundas.</p>
              ) : (
                <ul className="divide-y">
                  {deepPages.slice(0, 50).map((r) => (
                    <li key={r.path} className="py-2 flex items-center gap-2 text-sm">
                      <Badge>depth {r.depth}</Badge>
                      <span className="font-medium">{r.label}</span>
                      <code className="text-xs text-muted-foreground">{r.path}</code>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flows">
          <Card>
            <CardHeader><CardTitle>Top Authority Flows</CardTitle></CardHeader>
            <CardContent>
              {topFlows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem fluxos qualificados ainda.</p>
              ) : (
                <ul className="divide-y">
                  {topFlows.map((r) => (
                    <li key={r.path} className="py-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600">authority {r.authority}</Badge>
                        <span className="font-medium text-sm">{r.label}</span>
                        <code className="text-xs text-muted-foreground">{r.path}</code>
                        <span className="ml-auto text-xs text-muted-foreground">{r.links.length} links</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card>
            <CardHeader><CardTitle>Destinos bloqueados pela governança</CardTitle></CardHeader>
            <CardContent>
              {blocked.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum destino bloqueado.</p>
              ) : (
                <ul className="divide-y">
                  {blocked.map((b, i) => (
                    <li key={`${b.target}-${i}`} className="py-2 flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">bloqueado</Badge>
                        <code className="text-xs">{b.target}</code>
                      </div>
                      <div className="text-xs text-muted-foreground">{b.reasons.join(" · ")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
