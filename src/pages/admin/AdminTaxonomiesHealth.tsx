import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, EyeOff, ImageOff, FileQuestion, Link2Off, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDbCategories, useDbOccasions } from '@/hooks/useProducts';
import { useSegments } from '@/hooks/useSegments';
import { useTags } from '@/hooks/useTags';
import { evaluateSeo, hasAnyIssue, scoreSeo, TAXONOMY_LABELS, TaxonomyEntity, TaxonomyKind } from '@/lib/taxonomy';

interface ConsolidationRow {
  route_slug: string;
  occasion_slug: string;
  is_published: boolean;
  has_redirect: boolean;
  occasion_exists: boolean;
  occasion_has_seo: boolean;
}

type CountMap = Record<string, number>;

const AdminTaxonomiesHealth = () => {
  const cats = useDbCategories();
  const occs = useDbOccasions();
  const segs = useSegments();
  const tagsQ = useTags();

  const [productCounts, setProductCounts] = useState<{
    categoria: CountMap; ocasiao: CountMap; segmento: CountMap; tag: CountMap;
  }>({ categoria: {}, ocasiao: {}, segmento: {}, tag: {} });

  const [consolidation, setConsolidation] = useState<ConsolidationRow[]>([]);

  useEffect(() => {
    (async () => {
      const [pc, po, ps, pt, landings, redirects, occs2] = await Promise.all([
        supabase.from('products').select('category_id').eq('is_active', true),
        supabase.from('product_occasions').select('occasion_id'),
        supabase.from('product_segments').select('segment_id'),
        supabase.from('product_tags').select('tag_id'),
        supabase.from('occasion_landings').select('route_slug, occasion_slug, is_published'),
        supabase.from('redirects').select('from_path, is_active').like('from_path', '/lembrancinhas-%'),
        supabase.from('occasions').select('slug, meta_title, meta_description, h1_override, description_seo'),
      ]);
      const reduce = <T extends string>(rows: { [k in T]: string | null }[] | null, key: T): CountMap => {
        const m: CountMap = {};
        (rows ?? []).forEach((r) => {
          const k = r[key];
          if (k) m[k] = (m[k] ?? 0) + 1;
        });
        return m;
      };
      setProductCounts({
        categoria: reduce(pc.data as { category_id: string | null }[] | null, 'category_id'),
        ocasiao:   reduce(po.data as { occasion_id: string | null }[] | null, 'occasion_id'),
        segmento:  reduce(ps.data as { segment_id: string | null }[] | null, 'segment_id'),
        tag:       reduce(pt.data as { tag_id: string | null }[] | null, 'tag_id'),
      });

      const redirectSet = new Set((redirects.data ?? []).filter((r) => r.is_active).map((r) => r.from_path));
      const occBySlug = new Map((occs2.data ?? []).map((o) => [o.slug, o]));
      const rows: ConsolidationRow[] = (landings.data ?? []).map((l) => {
        const occ = occBySlug.get(l.occasion_slug);
        return {
          route_slug: l.route_slug,
          occasion_slug: l.occasion_slug,
          is_published: !!l.is_published,
          has_redirect: redirectSet.has(`/lembrancinhas-${l.route_slug}`),
          occasion_exists: !!occ,
          occasion_has_seo: !!(occ && (occ.meta_title || occ.meta_description || occ.h1_override || occ.description_seo)),
        };
      });
      setConsolidation(rows);
    })();
  }, []);

  const summary = useMemo(() => {
    const build = (kind: TaxonomyKind, items: TaxonomyEntity[], hasSeo: boolean) => {
      const counts = productCounts[kind];
      let noSeo = 0, noImage = 0, noDesc = 0, notIndexed = 0, orphans = 0, noFaq = 0, noDescSeo = 0;
      items.forEach((i) => {
        if (hasSeo) {
          const e = evaluateSeo(i);
          if (hasAnyIssue(e)) noSeo++;
          if (e.noImage) noImage++;
          if (e.noDescription) noDesc++;
          if (e.notIndexed) notIndexed++;
          if (e.noFaq) noFaq++;
          if (e.noDescriptionSeo) noDescSeo++;
        }
        if ((counts[i.id] ?? 0) === 0) orphans++;
      });
      return { total: items.length, noSeo, noImage, noDesc, notIndexed, orphans, noFaq, noDescSeo };
    };
    return {
      categoria: build('categoria', (cats.data ?? []) as TaxonomyEntity[], true),
      ocasiao:   build('ocasiao',   (occs.data ?? []) as TaxonomyEntity[], true),
      segmento:  build('segmento',  (segs.data ?? []) as TaxonomyEntity[], true),
      tag:       build('tag',       (tagsQ.data ?? []) as TaxonomyEntity[], false),
    };
  }, [cats.data, occs.data, segs.data, tagsQ.data, productCounts]);

  const allKinds: TaxonomyKind[] = ['categoria', 'ocasiao', 'segmento', 'tag'];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Healthcheck de Taxonomias</h1>
          <p className="text-muted-foreground mt-1">Auditoria operacional rápida do estado SEO e vínculos.</p>
        </div>
        <Link to="/admin/taxonomias">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {allKinds.map((k) => {
          const s = summary[k];
          return (
            <Card key={k}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{TAXONOMY_LABELS[k].plural}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl sm:text-3xl font-display">{s.total}</p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {k !== 'tag' && s.noSeo > 0 && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 gap-1">
                      <AlertTriangle className="w-3 h-3" /> SEO: {s.noSeo}
                    </Badge>
                  )}
                  {k !== 'tag' && s.noImage > 0 && (
                    <Badge variant="outline" className="gap-1"><ImageOff className="w-3 h-3" /> sem img: {s.noImage}</Badge>
                  )}
                  {k !== 'tag' && s.noDesc > 0 && (
                    <Badge variant="outline" className="gap-1"><FileQuestion className="w-3 h-3" /> sem desc: {s.noDesc}</Badge>
                  )}
                  {k !== 'tag' && s.notIndexed > 0 && (
                    <Badge variant="outline" className="gap-1"><EyeOff className="w-3 h-3" /> noindex: {s.notIndexed}</Badge>
                  )}
                  {k !== 'tag' && s.noDescSeo > 0 && (
                    <Badge variant="outline" className="gap-1">sem texto SEO: {s.noDescSeo}</Badge>
                  )}
                  {k !== 'tag' && s.noFaq > 0 && (
                    <Badge variant="outline" className="gap-1">sem FAQ: {s.noFaq}</Badge>
                  )}
                  {s.orphans > 0 && (
                    <Badge variant="outline" className="gap-1"><Link2Off className="w-3 h-3" /> órfãos: {s.orphans}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Fase 3.3 — Consolidação SEO do legado /lembrancinhas-* */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Consolidação SEO — landings legadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consolidation.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma landing legada encontrada.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {consolidation.map((r) => {
                const ok = r.has_redirect && r.occasion_exists && r.occasion_has_seo;
                return (
                  <li key={r.route_slug} className="py-2 flex flex-wrap items-center gap-2">
                    {ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="font-mono text-xs">/lembrancinhas-{r.route_slug}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-xs">/ocasiao/{r.occasion_slug}</span>
                    {!r.occasion_exists && <Badge variant="destructive" className="text-xs">ocasião ausente</Badge>}
                    {!r.has_redirect && <Badge variant="outline" className="text-xs">sem redirect</Badge>}
                    {!r.occasion_has_seo && <Badge variant="outline" className="text-xs">SEO não migrado</Badge>}
                    {!r.is_published && <Badge variant="outline" className="text-xs">não publicada</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            URLs legadas marcadas como <strong>DEPRECATED</strong>. Conteúdo SEO consolidado em <code>/ocasiao/:slug</code>;
            redirects 301 ativos via tabela <code>redirects</code>. As tabelas <code>occasion_landings</code> e o arquivo
            <code> src/data/lembrancinhasLandings.ts</code> são mantidos apenas como backup reversível.
          </p>
        </CardContent>
      </Card>

      {/* Fase 6 — Alertas de canibalização SEO */}
      {(() => {
        const all: { kind: TaxonomyKind; name: string; slug: string; title: string }[] = [];
        const push = (kind: TaxonomyKind, items: TaxonomyEntity[] | undefined) => {
          (items ?? []).forEach((i) => all.push({
            kind, name: i.name, slug: i.slug,
            title: (i.meta_title || i.name || '').trim().toLowerCase(),
          }));
        };
        push('categoria', cats.data as TaxonomyEntity[] | undefined);
        push('ocasiao',   occs.data as TaxonomyEntity[] | undefined);
        push('segmento',  segs.data as TaxonomyEntity[] | undefined);
        push('tag',       tagsQ.data as TaxonomyEntity[] | undefined);

        const alerts: string[] = [];
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j];
            if (a.kind === b.kind) continue;
            if (a.slug && b.slug && a.slug === b.slug) {
              alerts.push(`Slug "${a.slug}" usado em ${TAXONOMY_LABELS[a.kind].singular} e ${TAXONOMY_LABELS[b.kind].singular}`);
            } else if (a.title && b.title && a.title === b.title) {
              alerts.push(`Título idêntico "${a.title}" em ${TAXONOMY_LABELS[a.kind].singular} e ${TAXONOMY_LABELS[b.kind].singular}`);
            }
          }
        }
        const unique = Array.from(new Set(alerts));
        if (unique.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Possíveis canibalizações SEO ({unique.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {unique.map((m) => (
                  <li key={m} className="py-2 text-amber-900 dark:text-amber-200">⚠️ {m}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Novos cadastros com slug duplicado entre taxonomias são bloqueados pelo banco.
                Conflitos antigos permanecem visíveis aqui para revisão manual.
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {allKinds.map((k) => {
        const items = (
          k === 'categoria' ? cats.data : k === 'ocasiao' ? occs.data : k === 'segmento' ? segs.data : tagsQ.data
        ) as TaxonomyEntity[] | undefined;
        const counts = productCounts[k];
        type Row = { item: TaxonomyEntity; orphan: boolean; score?: number; grade?: string };
        const rows: Row[] = (items ?? [])
          .map<Row>((i) => {
            const orphan = (counts[i.id] ?? 0) === 0;
            if (k === 'tag') return { item: i, orphan };
            const s = scoreSeo(i, { productCount: counts[i.id] ?? 0 });
            return { item: i, orphan, score: s.score, grade: s.grade };
          })
          .filter((r) => r.orphan || (k !== 'tag' && hasAnyIssue(evaluateSeo(r.item))));
        if (rows.length === 0) return null;
        // Pior score primeiro
        rows.sort((a, b) => (a.score ?? -1) - (b.score ?? -1));
        const problems = rows;
        return (
          <Card key={k}>
            <CardHeader>
              <CardTitle className="text-base">
                {TAXONOMY_LABELS[k].plural} — itens com pendências ({problems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {problems.map(({ item: i, orphan, score, grade }) => {
                  const seo = k !== 'tag' ? evaluateSeo(i) : null;
                  const scoreColor = score === undefined ? '' :
                    score >= 75 ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300' :
                    score >= 55 ? 'border-amber-400 text-amber-700 dark:text-amber-300' :
                    'border-rose-400 text-rose-700 dark:text-rose-300';
                  return (
                    <li key={i.id} className="py-2 flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-xs text-muted-foreground">{TAXONOMY_LABELS[k].urlPrefix}{i.slug}</span>
                      <span className="text-xs text-muted-foreground">· {counts[i.id] ?? 0} produto(s)</span>
                      {score !== undefined && (
                        <Badge variant="outline" className={`text-xs gap-1 ${scoreColor}`}>
                          SEO {score}/100 · {grade}
                        </Badge>
                      )}
                      {orphan && <Badge variant="outline" className="text-xs">órfão</Badge>}
                      {seo?.notIndexed && <Badge variant="outline" className="text-xs">noindex</Badge>}
                      {seo?.noMetaTitle && <Badge variant="outline" className="text-xs">sem meta_title</Badge>}
                      {seo?.longMetaTitle && <Badge variant="outline" className="text-xs">title &gt;60</Badge>}
                      {seo?.noMetaDescription && <Badge variant="outline" className="text-xs">sem meta_description</Badge>}
                      {seo?.longMetaDescription && <Badge variant="outline" className="text-xs">desc &gt;160</Badge>}
                      {seo?.noImage && <Badge variant="outline" className="text-xs">sem imagem</Badge>}
                      {seo?.noDescription && <Badge variant="outline" className="text-xs">sem descrição</Badge>}
                      {seo?.noDescriptionSeo && <Badge variant="outline" className="text-xs">sem texto SEO</Badge>}
                      {seo?.shortDescriptionSeo && <Badge variant="outline" className="text-xs">texto SEO curto</Badge>}
                      {seo?.noFaq && <Badge variant="outline" className="text-xs">sem FAQ</Badge>}
                      {seo?.genericSlug && <Badge variant="outline" className="text-xs">slug genérico</Badge>}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminTaxonomiesHealth;
