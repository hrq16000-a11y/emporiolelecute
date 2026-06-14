// Fase 7.1 — Admin de avaliações
import { useMemo, useState } from 'react';
import { useAdminReviews, useUpsertReview, useDeleteReview, type AdminReview } from '@/hooks/useAdminProductReviews';
import { useDbProducts } from '@/hooks/useProducts';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ProductReviewForm from '@/components/admin/ProductReviewForm';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { urls } from '@/lib/urls';

const SOURCES = ['manual', 'whatsapp', 'instagram', 'google', 'site', 'outros'];

const AdminProductReviews = () => {
  const { toast } = useToast();
  const [productId, setProductId] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [rating, setRating] = useState<number | undefined>();
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data, isLoading } = useAdminReviews({ productId, source, rating, featuredOnly, hiddenOnly, page, pageSize });
  const { data: products } = useDbProducts();
  const upsert = useUpsertReview();
  const remove = useDeleteReview();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<AdminReview> | undefined>();

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (!search) return data.rows;
    const s = search.toLowerCase();
    return data.rows.filter((r: any) =>
      r.author_name?.toLowerCase().includes(s) ||
      r.comment?.toLowerCase().includes(s) ||
      r.products?.name?.toLowerCase().includes(s)
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / pageSize));

  const startNew = () => {
    setEditing({ source: 'manual', rating: 5, is_visible: true, product_id: productId });
    setOpen(true);
  };
  const startEdit = (r: AdminReview) => { setEditing(r); setOpen(true); };

  const handleSubmit = async (values: Partial<AdminReview>) => {
    try {
      await upsert.mutateAsync(values);
      toast({ title: editing?.id ? 'Avaliação atualizada' : 'Avaliação criada' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    }
  };

  const toggleField = (r: AdminReview, field: 'is_visible' | 'is_featured') => {
    upsert.mutate({ id: r.id, [field]: !r[field] });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Avaliações
          </h1>
          <p className="text-muted-foreground">Gestão centralizada de avaliações de produto (reviews) — base do rich snippet.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> Nova avaliação</Button>
      </div>

      <ReviewStrategicGaps />

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="autor, comentário, produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Produto</Label>
            <Select value={productId || 'all'} onValueChange={(v) => { setProductId(v === 'all' ? undefined : v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos</SelectItem>
                {products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={source || 'all'} onValueChange={(v) => { setSource(v === 'all' ? undefined : v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nota</Label>
            <Select value={rating ? String(rating) : 'all'} onValueChange={(v) => { setRating(v === 'all' ? undefined : Number(v)); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={featuredOnly} onCheckedChange={setFeaturedOnly} /> Destaque
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={hiddenOnly} onCheckedChange={setHiddenOnly} /> Ocultas
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {filteredRows.map((r: any) => (
            <Card key={r.id} className={!r.is_visible ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium">{r.author_name}</span>
                    <span className="flex">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
                      ))}
                    </span>
                    {r.is_featured && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Destaque</span>}
                    {r.is_verified && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">Verificada</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{r.source}</span>
                    {r.products?.name && (
                      <a href={urls.product(r.products.slug)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[260px]">
                        {r.products.name}
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.comment}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {r.review_date ? new Date(r.review_date).toLocaleDateString('pt-BR') : new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => toggleField(r, 'is_featured')} title="Destaque">
                    <Star className={`h-4 w-4 ${r.is_featured ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleField(r, 'is_visible')} title={r.is_visible ? 'Ocultar' : 'Exibir'}>
                    {r.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(r)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className={buttonVariants({ variant: "destructive" })}
                          onClick={() => remove.mutate(r.id)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredRows.length === 0 && (
            <p className="text-muted-foreground text-center py-12">Nenhuma avaliação encontrada.</p>
          )}
        </div>
      )}

      {/* Paginação */}
      {(data?.count ?? 0) > pageSize && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">{data?.count} avaliações</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="px-2 py-1">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar avaliação' : 'Nova avaliação'}</DialogTitle></DialogHeader>
          <ProductReviewForm
            initial={editing}
            productOptions={products?.map((p: any) => ({ id: p.id, name: p.name })) || []}
            onCancel={() => setOpen(false)}
            onSubmit={handleSubmit}
            submitting={upsert.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProductReviews;

// Fase 11 — Strategic gaps for review acquisition (manual).

function ReviewStrategicGaps() {
  const { data } = useQuery({
    queryKey: ['admin', 'review-gaps'],
    queryFn: async () => {
      const [productsRes, reviewsRes, occRes] = await Promise.all([
        supabase.from('products').select('id, name, slug, price, images, category_id').eq('is_active', true),
        supabase.from('product_reviews').select('product_id, rating').eq('is_visible', true),
        supabase.from('product_occasions').select('product_id, occasion_id'),
      ]);
      const products = productsRes.data || [];
      const reviews = reviewsRes.data || [];
      const occ = occRes.data || [];
      const byProduct = new Map<string, number>();
      reviews.forEach((r: any) => byProduct.set(r.product_id, (byProduct.get(r.product_id) || 0) + 1));
      const occByProduct = new Map<string, number>();
      occ.forEach((o: any) => occByProduct.set(o.product_id, (occByProduct.get(o.product_id) || 0) + 1));

      const strategicNoReviews = products
        .filter((p: any) => !byProduct.has(p.id) && (occByProduct.get(p.id) || 0) >= 2)
        .slice(0, 12);
      const premiumNoSocial = products
        .filter((p: any) => (p.price || 0) >= 50 && (byProduct.get(p.id) || 0) < 2)
        .slice(0, 12);
      // taxonomias fortes (proxy: muitos produtos) com poucas reviews
      const byCategory = new Map<string, { products: number; reviews: number }>();
      products.forEach((p: any) => {
        if (!p.category_id) return;
        const e = byCategory.get(p.category_id) || { products: 0, reviews: 0 };
        e.products += 1;
        e.reviews += byProduct.get(p.id) || 0;
        byCategory.set(p.category_id, e);
      });
      const weakTaxonomies = Array.from(byCategory.entries())
        .filter(([, e]) => e.products >= 5 && e.reviews < e.products * 0.3)
        .map(([id, e]) => ({ id, ...e }));

      return { strategicNoReviews, premiumNoSocial, weakTaxonomies };
    },
  });
  if (!data) return null;
  const blocks = [
    { title: 'Produtos estratégicos sem reviews', items: data.strategicNoReviews.map((p: any) => p.name) },
    { title: 'Produtos premium sem social proof', items: data.premiumNoSocial.map((p: any) => p.name) },
    { title: 'Taxonomias fortes com poucas reviews', items: data.weakTaxonomies.map((t) => `cat ${t.id.slice(0, 6)} · ${t.reviews}/${t.products}`) },
  ];
  return (
    <Card className="mb-4 border-primary/30">
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {blocks.map((b) => (
          <div key={b.title}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{b.title}</p>
            <p className="text-2xl font-bold">{b.items.length}</p>
            <div className="text-xs text-muted-foreground mt-2 max-h-28 overflow-y-auto space-y-0.5">
              {b.items.slice(0, 6).map((n, i) => <div key={i} className="truncate">• {n}</div>)}
              {b.items.length === 0 && <span>— nenhum gap detectado</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

