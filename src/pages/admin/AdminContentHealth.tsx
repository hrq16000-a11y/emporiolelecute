// Fase 8 — Dashboard operacional SEO/editorial.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, ChevronRight } from 'lucide-react';
import { detectThinContent } from '@/lib/thinContent';
import CoveragePanel from '@/components/admin/CoveragePanel';
import TagGovernancePanel from '@/components/admin/TagGovernancePanel';

interface ProdRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  editorial_content: string | null;
  images: string[] | null;
  keywords: string[] | null;
  category_id: string | null;
  is_active: boolean | null;
  seo_noindex: boolean | null;
  occasionsCount: number;
  segmentsCount: number;
  tagsCount: number;
  reviewsCount: number;
}

const AdminContentHealth = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['content-health-products'],
    staleTime: 60_000,
    queryFn: async (): Promise<ProdRow[]> => {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, description, long_description, editorial_content, images, keywords, category_id, is_active, seo_noindex')
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

  const { data: taxonomies } = useQuery({
    queryKey: ['content-health-taxonomies'],
    staleTime: 60_000,
    queryFn: async () => {
      const [cats, occs, segs] = await Promise.all([
        supabase.from('categories').select('id, name, slug, description, image_url, faqs'),
        supabase.from('occasions').select('id, name, slug, description, image_url, faqs'),
        supabase.from('segments').select('id, name, slug, description, image_url, faqs'),
      ]);
      const enrich = (rows: any[] | null, kind: string) => (rows ?? []).map((r) => ({ ...r, kind }));
      return [
        ...enrich(cats.data, 'categoria'),
        ...enrich(occs.data, 'ocasiao'),
        ...enrich(segs.data, 'segmento'),
      ];
    },
  });

  const blocks = useMemo(() => {
    const rows = (data ?? []).map((p) => ({ p, t: detectThinContent(p) }));
    const productsWithoutEditorial = rows.filter((r) => !(r.p.editorial_content || '').trim());
    const productsWithoutReviews = rows.filter((r) => (r.p.reviewsCount ?? 0) === 0);
    const productsWithoutTags = rows.filter((r) => (r.p.tagsCount ?? 0) === 0);
    const productsCritical = rows.filter((r) => r.t.level === 'critico');
    const productsThin = rows.filter((r) => r.t.level === 'fraco' || r.t.level === 'critico');
    const productsWithoutOccasion = rows.filter((r) => (r.p.occasionsCount ?? 0) === 0);
    const productsWithoutSegment = rows.filter((r) => (r.p.segmentsCount ?? 0) === 0);
    const productsLowImages = rows.filter((r) => (r.p.images || []).filter(Boolean).length < 2);

    const taxRows = taxonomies ?? [];
    const taxWithoutDesc = taxRows.filter((t: any) => !(t.description || '').trim());
    const taxWithoutFaq = taxRows.filter((t: any) => !Array.isArray(t.faqs) || t.faqs.length === 0);
    const taxWithoutImage = taxRows.filter((t: any) => !t.image_url);

    return [
      { label: 'Produtos sem editorial',     count: productsWithoutEditorial.length, link: '/admin/produtos/health', tone: 'amber' },
      { label: 'Produtos sem avaliação',     count: productsWithoutReviews.length,   link: '/admin/reviews',          tone: 'amber' },
      { label: 'Produtos sem tags',          count: productsWithoutTags.length,      link: '/admin/produtos/health', tone: 'amber' },
      { label: 'Produtos thin-content',      count: productsThin.length,             link: '/admin/produtos/health', tone: 'rose'  },
      { label: 'Produtos críticos (SEO)',    count: productsCritical.length,         link: '/admin/produtos/health', tone: 'rose'  },
      { label: 'Produtos sem ocasião',       count: productsWithoutOccasion.length,  link: '/admin/produtos/health', tone: 'amber' },
      { label: 'Produtos sem segmento',      count: productsWithoutSegment.length,   link: '/admin/produtos/health', tone: 'amber' },
      { label: 'Produtos com <2 imagens',    count: productsLowImages.length,        link: '/admin/produtos/health', tone: 'rose'  },
      { label: 'Taxonomias sem descrição',   count: taxWithoutDesc.length,           link: '/admin/taxonomias/health', tone: 'amber' },
      { label: 'Taxonomias sem FAQ',         count: taxWithoutFaq.length,            link: '/admin/taxonomias/health', tone: 'amber' },
      { label: 'Taxonomias sem imagem',      count: taxWithoutImage.length,          link: '/admin/taxonomias/health', tone: 'amber' },
    ];
  }, [data, taxonomies]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> Saúde do Conteúdo
        </h1>
        <p className="text-muted-foreground">Visão consolidada de qualidade editorial e SEO do catálogo.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {blocks.map((b) => (
            <Link key={b.label} to={b.link} className="group">
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                  <div className="flex items-end justify-between mt-1">
                    <p className={`text-3xl font-semibold ${b.count === 0 ? 'text-emerald-600' : b.tone === 'rose' ? 'text-rose-600' : 'text-amber-600'}`}>
                      {b.count}
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <CoveragePanel />
        <TagGovernancePanel />
      </div>
    </div>
  );
};

export default AdminContentHealth;
