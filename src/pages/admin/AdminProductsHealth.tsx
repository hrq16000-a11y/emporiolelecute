// Fase 7.1 — Healthcheck SEO operacional de produtos
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Pencil, RefreshCw } from 'lucide-react';
import { evaluateProductSeo } from '@/lib/productSeo';
import ProductSeoScoreBadge from '@/components/admin/ProductSeoScoreBadge';
import { PRODUCT_PATH_PREFIX } from '@/lib/urls';

interface Row {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  editorial_content: string | null;
  images: string[] | null;
  price: number | null;
  keywords: string[] | null;
  category_id: string | null;
  occasionsCount: number;
  segmentsCount: number;
  tagsCount: number;
  reviewsCount: number;
}

const AdminProductsHealth = () => {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['products-health'],
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, description, long_description, editorial_content, images, price, keywords, category_id, is_active')
        .eq('is_active', true)
        .limit(1000);
      if (error) throw error;

      const ids = (products ?? []).map((p: any) => p.id);
      if (!ids.length) return [];

      const [{ data: occ }, { data: seg }, { data: tg }, { data: rv }] = await Promise.all([
        supabase.from('product_occasions').select('product_id').in('product_id', ids),
        supabase.from('product_segments').select('product_id').in('product_id', ids),
        supabase.from('product_tags').select('product_id').in('product_id', ids),
        supabase.from('product_reviews').select('product_id').in('product_id', ids).eq('is_visible', true),
      ]);

      const count = (arr: any[] | null, id: string) =>
        (arr ?? []).filter((r: any) => r.product_id === id).length;

      return (products ?? []).map((p: any) => ({
        ...p,
        occasionsCount: count(occ, p.id),
        segmentsCount: count(seg, p.id),
        tagsCount: count(tg, p.id),
        reviewsCount: count(rv, p.id),
      }));
    },
  });

  const evaluated = useMemo(() => {
    const rows = (data ?? []).map((p) => ({
      product: p,
      seo: evaluateProductSeo(p),
    }));
    rows.sort((a, b) => a.seo.score - b.seo.score);
    return rows;
  }, [data]);

  const filtered = useMemo(() => {
    if (!search) return evaluated;
    const s = search.toLowerCase();
    return evaluated.filter(({ product }) => product.name.toLowerCase().includes(s) || product.slug.toLowerCase().includes(s));
  }, [evaluated, search]);

  const stats = useMemo(() => {
    const total = evaluated.length;
    const critical = evaluated.filter((r) => r.seo.score < 35).length;
    const weak = evaluated.filter((r) => r.seo.score >= 35 && r.seo.score < 55).length;
    const ok = evaluated.filter((r) => r.seo.score >= 75).length;
    const avg = total ? Math.round(evaluated.reduce((s, r) => s + r.seo.score, 0) / total) : 0;
    return { total, critical, weak, ok, avg };
  }, [evaluated]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-primary" /> Saúde SEO dos Produtos
          </h1>
          <p className="text-muted-foreground">Auditoria operacional: identifique rapidamente produtos com SEO fraco.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Produtos</p><p className="text-2xl font-semibold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Score médio</p><p className="text-2xl font-semibold">{stats.avg}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Críticos</p><p className="text-2xl font-semibold text-rose-600">{stats.critical}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fracos</p><p className="text-2xl font-semibold text-orange-600">{stats.weak}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bom/Excelente</p><p className="text-2xl font-semibold text-emerald-600">{stats.ok}</p></CardContent></Card>
      </div>

      <div className="mb-4">
        <Input placeholder="Buscar por nome ou slug..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ product, seo }) => {
            const criticals = seo.issues.filter((i) => i.level === 'error');
            const warnings = seo.issues.filter((i) => i.level === 'warning');
            return (
              <Card key={product.id}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <Link to={`/admin/produtos/${product.slug || product.id}`} className="font-medium hover:underline">{product.name}</Link>
                      <ProductSeoScoreBadge evaluation={seo} />
                      <span className="text-xs text-muted-foreground">{PRODUCT_PATH_PREFIX}/{product.slug}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {criticals.map((i, idx) => (
                        <span key={`e-${idx}`} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{i.message}</span>
                      ))}
                      {warnings.slice(0, 4).map((i, idx) => (
                        <span key={`w-${idx}`} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{i.message}</span>
                      ))}
                      {warnings.length > 4 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{warnings.length - 4}</span>
                      )}
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="icon">
                    <Link to={`/admin/produtos/${product.slug || product.id}`}><Pencil className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-center py-12">Nenhum produto.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminProductsHealth;
