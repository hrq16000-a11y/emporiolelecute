import { useEffect, useState } from 'react';
import { useAdminTestimonials, useUpsertTestimonial, useDeleteTestimonial, type Testimonial } from '@/hooks/useTestimonials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Eye, EyeOff, Star } from 'lucide-react';
import DraftStatusBadge from '@/components/admin/DraftStatusBadge';
import { useFormDraft } from '@/hooks/useFormDraft';

const empty: Partial<Testimonial> = {
  customer_name: '', customer_text: '', product_name: '', occasion: '', rating: 5, testimonial_date: '', position: 0, is_visible: true,
};

const AdminTestimonials = () => {
  const { data, isLoading } = useAdminTestimonials();
  const upsert = useUpsertTestimonial();
  const remove = useDeleteTestimonial();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Testimonial>>(empty);
  const [hydrated, setHydrated] = useState(false);

  // Rascunho persistente por item (novo OU id em edição)
  const scopeKey = open ? `testimonial:${form.id ?? 'new'}` : undefined;
  const { hydrate, clear } = useFormDraft(form, open && hydrated, 1000, scopeKey);

  // Hidrata ao abrir o dialog
  useEffect(() => {
    if (!open) { setHydrated(false); return; }
    const saved = hydrate<Partial<Testimonial>>();
    if (saved) setForm(saved);
    setHydrated(true);
  }, [open, form.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startNew = () => { setForm({ ...empty, position: (data?.length || 0) }); setOpen(true); };
  const startEdit = (t: Testimonial) => { setForm({ ...t, testimonial_date: t.testimonial_date || '' }); setOpen(true); };

  const save = async () => {
    if (!form.customer_name || !form.customer_text) return;
    const payload: Partial<Testimonial> = { ...form, testimonial_date: form.testimonial_date || null };
    await upsert.mutateAsync(payload);
    clear();
    setOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display">Depoimentos</h1>
          <p className="text-muted-foreground">Gerencie as avaliações exibidas na Home.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> Novo depoimento</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {(data || []).map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{t.customer_name}</p>
                    <span className="flex items-center gap-0.5">
                      {[...Array(t.rating)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">"{t.customer_text}"</p>
                  {(t.product_name || t.occasion) && (
                    <p className="text-xs text-primary mt-1">{[t.product_name, t.occasion].filter(Boolean).join(' • ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => upsert.mutate({ id: t.id, is_visible: !t.is_visible })}>
                    {t.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir?')) remove.mutate(t.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(data || []).length === 0 && (
            <p className="text-muted-foreground text-center py-12">Nenhum depoimento.</p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? 'Editar depoimento' : 'Novo depoimento'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do cliente *</Label>
              <Input value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <Label>Depoimento *</Label>
              <Textarea rows={4} value={form.customer_text || ''} onChange={(e) => setForm({ ...form, customer_text: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Produto comprado</Label>
                <Input value={form.product_name || ''} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
              </div>
              <div>
                <Label>Ocasião</Label>
                <Input value={form.occasion || ''} onChange={(e) => setForm({ ...form, occasion: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nota (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.rating ?? 5} onChange={(e) => setForm({ ...form, rating: Math.min(5, Math.max(1, parseInt(e.target.value) || 5)) })} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.testimonial_date || ''} onChange={(e) => setForm({ ...form, testimonial_date: e.target.value })} />
              </div>
              <div>
                <Label>Posição</Label>
                <Input type="number" value={form.position ?? 0} onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_visible ?? true} onCheckedChange={(v) => setForm({ ...form, is_visible: v })} />
              <Label>Visível na Home</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTestimonials;
