// Fase 7.1 — Formulário reutilizável para criar/editar avaliações
import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { AdminReview } from '@/hooks/useAdminProductReviews';
import ImageUploader from '@/components/admin/ImageUploader';

const SOURCES = ['manual', 'whatsapp', 'instagram', 'google', 'site', 'outros'];

export interface ProductReviewFormProps {
  initial?: Partial<AdminReview>;
  productOptions?: Array<{ id: string; name: string }>;
  lockProduct?: boolean;
  onCancel?: () => void;
  onSubmit: (values: Partial<AdminReview>) => Promise<void> | void;
  submitting?: boolean;
}

const empty: Partial<AdminReview> = {
  product_id: '',
  author_name: '',
  rating: 5,
  comment: '',
  source: 'manual',
  source_url: '',
  external_review_id: '',
  is_verified: false,
  is_featured: false,
  is_visible: true,
  review_date: '',
  images: [],
  position: 0,
};

const ProductReviewForm = ({
  initial, productOptions, lockProduct, onCancel, onSubmit, submitting,
}: ProductReviewFormProps) => {
  const [form, setForm] = useState<Partial<AdminReview>>({ ...empty, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { setForm({ ...empty, ...initial }); }, [initial?.id]);

  const set = (k: keyof AdminReview, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.product_id) e.product_id = 'Produto obrigatório';
    if (!form.author_name?.trim()) e.author_name = 'Autor obrigatório';
    if (!form.rating || form.rating < 1 || form.rating > 5) e.rating = 'Nota entre 1 e 5';
    if (!form.comment || form.comment.trim().length < 20) e.comment = 'Mínimo 20 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    await onSubmit({
      ...form,
      author_name: form.author_name?.trim(),
      comment: form.comment?.trim() || null,
      source_url: form.source_url || null,
      external_review_id: form.external_review_id || null,
      review_date: form.review_date || null,
      images: Array.isArray(form.images) ? form.images : [],
      position: Number(form.position ?? 0) || 0,
    });
  };

  const commentLen = (form.comment || '').length;

  return (
    <div className="space-y-4">
      {!lockProduct && productOptions && (
        <div>
          <Label>Produto *</Label>
          <Select value={form.product_id || ''} onValueChange={(v) => set('product_id', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
            <SelectContent>
              {productOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.product_id && <p className="text-xs text-destructive mt-1">{errors.product_id}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Autor *</Label>
          <Input value={form.author_name || ''} onChange={(e) => set('author_name', e.target.value)} maxLength={120} />
          {errors.author_name && <p className="text-xs text-destructive mt-1">{errors.author_name}</p>}
        </div>
        <div>
          <Label>Nota *</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set('rating', n)}
                className="p-1"
                aria-label={`${n} estrelas`}
              >
                <Star className={`h-5 w-5 ${n <= (form.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
              </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">{form.rating || 0}/5</span>
          </div>
          {errors.rating && <p className="text-xs text-destructive mt-1">{errors.rating}</p>}
        </div>
      </div>

      <div>
        <Label>Comentário *</Label>
        <Textarea
          rows={5}
          value={form.comment || ''}
          maxLength={2000}
          onChange={(e) => set('comment', e.target.value)}
          placeholder="O que o cliente achou? Mín. 20 caracteres."
        />
        <div className="flex justify-between text-xs mt-1">
          {errors.comment ? (
            <span className="text-destructive">{errors.comment}</span>
          ) : (
            <span className="text-muted-foreground">Mínimo 20 caracteres</span>
          )}
          <span className={`${commentLen < 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{commentLen} / 2000</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Origem</Label>
          <Select value={form.source || 'manual'} onValueChange={(v) => set('source', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>URL da origem</Label>
          <Input value={form.source_url || ''} onChange={(e) => set('source_url', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <Label>Data da avaliação</Label>
          <Input
            type="date"
            value={form.review_date ? String(form.review_date).slice(0, 10) : ''}
            onChange={(e) => set('review_date', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>ID externo (opcional)</Label>
          <Input value={form.external_review_id || ''} onChange={(e) => set('external_review_id', e.target.value)} />
        </div>
        <div>
          <Label>Ordem manual (menor = primeiro)</Label>
          <Input
            type="number"
            value={form.position ?? 0}
            onChange={(e) => set('position', Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div>
        <Label>Fotos da avaliação (clientes reais, eventos)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Arraste para reordenar. A primeira foto aparece em destaque.
        </p>
        <ImageUploader
          images={Array.isArray(form.images) ? form.images : []}
          onImagesChange={(imgs) => set('images', imgs)}
          maxImages={6}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        <label className="flex items-center gap-2">
          <Switch checked={!!form.is_verified} onCheckedChange={(v) => set('is_verified', v)} />
          <span className="text-sm">Verificada</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={!!form.is_featured} onCheckedChange={(v) => set('is_featured', v)} />
          <span className="text-sm">Destaque</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={!!form.is_visible} onCheckedChange={(v) => set('is_visible', v)} />
          <span className="text-sm">Visível</span>
        </label>
      </div>

      {/* Preview card */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pré-visualização</p>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{form.author_name || 'Cliente'}</span>
          <span className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-3.5 w-3.5 ${n <= (form.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
            ))}
          </span>
          {form.is_verified && <span className="text-xs text-emerald-600">✓ Verificada</span>}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">{form.comment || '—'}</p>
        <p className="text-xs text-muted-foreground mt-2">Origem: {form.source}</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button variant="outline" onClick={onCancel} type="button">Cancelar</Button>}
        <Button onClick={submit} disabled={submitting} type="button">
          {submitting ? 'Salvando...' : 'Salvar avaliação'}
        </Button>
      </div>
    </div>
  );
};

export default ProductReviewForm;
