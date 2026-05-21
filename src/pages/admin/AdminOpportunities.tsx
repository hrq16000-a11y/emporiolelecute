// Fase 8 — Oportunidades editoriais e comerciais.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';

interface Item { id: string; name: string; slug: string; reason: string; href: string; }

const AdminOpportunities = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-opportunities'],
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: products }, { data: occLinks }, { data: segLinks }, { data: tagLinks }, { data: reviews }, { data: occs }, { data: cats }] = await Promise.all([
        supabase.from('products').select('id, name, slug, category_id, editorial_content, images').eq('is_active', true).limit(1000),
        supabase.from('product_occasions').select('product_id, occasion_id'),
        supabase.from('product_segments').select('product_id, segment_id'),
        supabase.from('product_tags').select('product_id, tag_id'),
        supabase.from('product_reviews').select('product_id, is_featured').eq('is_visible', true),
        supabase.from('occasions').select('id, name, slug'),
        supabase.from('categories').select('id, name, slug'),
      ]);

      const byProd = <T extends { product_id: string }>(arr: T[] | null) => {
        const m = new Map<string, T[]>();
        for (const r of arr ?? []) {
          const list = m.get(r.product_id) ?? [];
          list.push(r);
          m.set(r.product_id, list);
        }
        return m;
      };
      const occMap = byProd(occLinks);
      const segMap = byProd(segLinks);
      const tagMap = byProd(tagLinks);
      const revMap = byProd(reviews);

      const productsWithoutSegment: Item[] = [];
      const productsWithoutEditorial: Item[] = [];
      const productsWithoutCrossLink: Item[] = []; // sem tags
      const productsWithoutFeaturedReview: Item[] = [];

      for (const p of products ?? []) {
        const href = `/admin/produtos/${p.slug || p.id}`;
        if (!(segMap.get(p.id) ?? []).length) productsWithoutSegment.push({ id: p.id, name: p.name, slug: p.slug, reason: 'Sem segmento', href });
        if (!(p.editorial_content || '').trim()) productsWithoutEditorial.push({ id: p.id, name: p.name, slug: p.slug, reason: 'Sem editorial', href });
        if (!(tagMap.get(p.id) ?? []).length) productsWithoutCrossLink.push({ id: p.id, name: p.name, slug: p.slug, reason: 'Sem tags (cross-linking)', href });
        const featured = (revMap.get(p.id) ?? []).some((r: any) => r.is_featured);
        if (!featured) productsWithoutFeaturedReview.push({ id: p.id, name: p.name, slug: p.slug, reason: 'Sem review em destaque', href });
      }

      // Ocasiões com poucos produtos
      const occCount = new Map<string, number>();
      for (const r of occLinks ?? []) occCount.set(r.occasion_id, (occCount.get(r.occasion_id) ?? 0) + 1);
      const lowOccasions = (occs ?? [])
        .map((o: any) => ({ ...o, count: occCount.get(o.id) ?? 0 }))
        .filter((o: any) => o.count < 4)
        .sort((a: any, b: any) => a.count - b.count);

      // Categorias com baixa cobertura
      const catCount = new Map<string, number>();
      for (const p of products ?? []) if (p.category_id) catCount.set(p.category_id, (catCount.get(p.category_id) ?? 0) + 1);
      const lowCategories = (cats ?? [])
        .map((c: any) => ({ ...c, count: catCount.get(c.id) ?? 0 }))
        .filter((c: any) => c.count < 4)
        .sort((a: any, b: any) => a.count - b.count);

      return {
        productsWithoutSegment,
        productsWithoutEditorial,
        productsWithoutCrossLink,
        productsWithoutFeaturedReview,
        lowOccasions,
        lowCategories,
      };
    },
  });

  const sections = useMemo(() => data ? [
    { title: 'Produtos sem editorial',        items: data.productsWithoutEditorial,        type: 'product' as const },
    { title: 'Produtos sem segmento',         items: data.productsWithoutSegment,           type: 'product' as const },
    { title: 'Produtos sem cross-linking',    items: data.productsWithoutCrossLink,         type: 'product' as const },
    { title: 'Produtos sem review destacada', items: data.productsWithoutFeaturedReview,    type: 'product' as const },
  ] : [], [data]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Oportunidades
        </h1>
        <p className="text-muted-foreground">Próximos passos para enriquecer o catálogo e ganhar cobertura SEO.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {sections.map((s) => (
            <Card key={s.title}>
              <CardHeader>
                <CardTitle className="text-base">{s.title} <span className="text-muted-foreground text-sm">({s.items.length})</span></CardTitle>
              </CardHeader>
              <CardContent>
                {s.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tudo certo por aqui ✨</p>
                ) : (
                  <ul className="divide-y">
                    {s.items.slice(0, 10).map((i) => (
                      <li key={`${s.title}-${i.id}`} className="py-2 flex items-center justify-between gap-3">
                        <Link to={i.href} className="text-sm truncate hover:underline">{i.name}</Link>
                        <span className="text-[11px] text-muted-foreground">{i.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.items.length > 10 && (
                  <p className="text-[11px] text-muted-foreground mt-2">+ {s.items.length - 10} produtos…</p>
                )}
              </CardContent>
            </Card>
          ))}

          {data && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ocasiões pouco exploradas</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.lowOccasions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Todas as ocasiões com boa cobertura.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.lowOccasions.map((o: any) => (
                        <li key={o.id} className="flex items-center justify-between text-sm">
                          <Link to={`/ocasiao/${o.slug}`} className="hover:underline truncate">{o.name}</Link>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            {o.count} produto(s) <ArrowRight className="h-3 w-3" />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Categorias com baixa cobertura</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.lowCategories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Todas as categorias bem cobertas.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.lowCategories.map((c: any) => (
                        <li key={c.id} className="flex items-center justify-between text-sm">
                          <Link to={`/categoria/${c.slug}`} className="hover:underline truncate">{c.name}</Link>
                          <span className="text-[11px] text-muted-foreground">{c.count} produto(s)</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminOpportunities;
