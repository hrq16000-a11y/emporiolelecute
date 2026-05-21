import { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDbCategories } from '@/hooks/useProducts';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onDone: () => void;
}

type PriceMode = 'set' | 'percent';

const BulkEditProductsDialog = ({ open, onOpenChange, selectedIds, onDone }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories } = useDbCategories();

  // Toggles — só campos marcados são aplicados
  const [useCategory, setUseCategory] = useState(false);
  const [categoryId, setCategoryId] = useState<string>('');

  const [useProductionDays, setUseProductionDays] = useState(false);
  const [productionDays, setProductionDays] = useState('5');

  const [useMinQuantity, setUseMinQuantity] = useState(false);
  const [minQuantity, setMinQuantity] = useState('1');

  const [usePixDiscount, setUsePixDiscount] = useState(false);
  const [pixDiscount, setPixDiscount] = useState('7');

  const [useBadge, setUseBadge] = useState(false);
  const [badge, setBadge] = useState('');

  const [usePrice, setUsePrice] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode>('set');
  const [priceValue, setPriceValue] = useState('');

  const [useKeywords, setUseKeywords] = useState(false);
  const [keywords, setKeywords] = useState('');

  const [busy, setBusy] = useState(false);

  const reset = () => {
    setUseCategory(false); setUseProductionDays(false); setUseMinQuantity(false);
    setUsePixDiscount(false); setUseBadge(false); setUsePrice(false); setUseKeywords(false);
  };

  const anyChecked =
    useCategory || useProductionDays || useMinQuantity || usePixDiscount ||
    useBadge || usePrice || useKeywords;

  const handleApply = async () => {
    if (!anyChecked || selectedIds.length === 0) return;

    // Patch comum (não envolve preço % nem keywords merge)
    const patch: Record<string, unknown> = {};
    if (useCategory) patch.category_id = categoryId || null;
    if (useProductionDays) patch.production_days = parseInt(productionDays, 10) || 0;
    if (useMinQuantity) patch.min_quantity = Math.max(1, parseInt(minQuantity, 10) || 1);
    if (usePixDiscount) patch.pix_discount = Math.max(0, parseFloat(pixDiscount.replace(',', '.')) || 0);
    if (useBadge) patch.badge = badge.trim() || null;
    if (usePrice && priceMode === 'set') {
      const v = parseFloat(priceValue.replace(',', '.'));
      if (!isNaN(v) && v >= 0) patch.price = v;
    }

    setBusy(true);
    let ok = 0;
    let fail = 0;

    try {
      // 1) Update em lote para campos uniformes
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from('products').update(patch).in('id', selectedIds);
        if (error) {
          fail = selectedIds.length;
          toast({ title: 'Erro ao aplicar', description: error.message, variant: 'destructive' });
        } else {
          ok = selectedIds.length;
        }
      } else {
        ok = selectedIds.length;
      }

      // 2) Preço por percentual — precisa ler atual
      if (usePrice && priceMode === 'percent') {
        const pct = parseFloat(priceValue.replace(',', '.'));
        if (!isNaN(pct)) {
          const { data: rows, error: e1 } = await supabase
            .from('products').select('id, price').in('id', selectedIds);
          if (e1 || !rows) {
            toast({ title: 'Erro ao ler preços', variant: 'destructive' });
          } else {
            const results = await Promise.allSettled(
              rows.map((r: any) => {
                const newPrice = Math.max(0, Number(((r.price ?? 0) * (1 + pct / 100)).toFixed(2)));
                return supabase.from('products').update({ price: newPrice }).eq('id', r.id);
              })
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            fail += failed;
          }
        }
      }

      // 3) Keywords: merge único por produto
      if (useKeywords) {
        const newKw = keywords.split(',').map((k) => k.trim()).filter(Boolean);
        if (newKw.length > 0) {
          const { data: rows, error: e2 } = await supabase
            .from('products').select('id, keywords').in('id', selectedIds);
          if (e2 || !rows) {
            toast({ title: 'Erro ao ler keywords', variant: 'destructive' });
          } else {
            const results = await Promise.allSettled(
              rows.map((r: any) => {
                const merged = Array.from(new Set([...(r.keywords ?? []), ...newKw]));
                return supabase.from('products').update({ keywords: merged }).eq('id', r.id);
              })
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            fail += failed;
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] });

      if (fail === 0) {
        toast({ title: 'Edição em massa aplicada', description: `${selectedIds.length} produto(s) atualizado(s).` });
      } else {
        toast({ title: 'Concluído com erros', description: `${fail} falha(s).`, variant: 'destructive' });
      }
      reset();
      onOpenChange(false);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" /> Edição em massa
          </DialogTitle>
          <DialogDescription>
            Marque os campos que deseja alterar. Só os marcados serão aplicados aos{' '}
            <strong>{selectedIds.length}</strong> produto(s) selecionado(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Categoria */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bk-cat" checked={useCategory} onCheckedChange={(v) => setUseCategory(!!v)} />
              <Label htmlFor="bk-cat" className="font-medium cursor-pointer">Categoria</Label>
            </div>
            {useCategory && (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(Sem categoria)</SelectItem>
                  {(categories ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preço */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bk-price" checked={usePrice} onCheckedChange={(v) => setUsePrice(!!v)} />
              <Label htmlFor="bk-price" className="font-medium cursor-pointer">Preço</Label>
            </div>
            {usePrice && (
              <div className="flex gap-2">
                <Select value={priceMode} onValueChange={(v) => setPriceMode(v as PriceMode)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">Definir valor (R$)</SelectItem>
                    <SelectItem value="percent">Ajustar % (+/-)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={priceMode === 'set' ? '49.90' : '10 ou -5'}
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Dias produção */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bk-pd" checked={useProductionDays} onCheckedChange={(v) => setUseProductionDays(!!v)} />
              <Label htmlFor="bk-pd" className="font-medium cursor-pointer">Dias de produção</Label>
            </div>
            {useProductionDays && (
              <Input type="number" min="0" value={productionDays} onChange={(e) => setProductionDays(e.target.value)} />
            )}
          </div>

          {/* Quantidade mínima */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bk-mq" checked={useMinQuantity} onCheckedChange={(v) => setUseMinQuantity(!!v)} />
              <Label htmlFor="bk-mq" className="font-medium cursor-pointer">Quantidade mínima</Label>
            </div>
            {useMinQuantity && (
              <Input type="number" min="1" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
            )}
          </div>

          {/* PIX */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bk-pix" checked={usePixDiscount} onCheckedChange={(v) => setUsePixDiscount(!!v)} />
              <Label htmlFor="bk-pix" className="font-medium cursor-pointer">Desconto PIX (%)</Label>
            </div>
            {usePixDiscount && (
              <Input type="number" step="0.1" min="0" value={pixDiscount} onChange={(e) => setPixDiscount(e.target.value)} />
            )}
          </div>

          {/* Badge */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bk-badge" checked={useBadge} onCheckedChange={(v) => setUseBadge(!!v)} />
              <Label htmlFor="bk-badge" className="font-medium cursor-pointer">Badge (deixe vazio para remover)</Label>
            </div>
            {useBadge && (
              <Input placeholder='Ex: "Novo", "Mais vendido"' value={badge} onChange={(e) => setBadge(e.target.value)} />
            )}
          </div>

          {/* Keywords (append) */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bk-kw" checked={useKeywords} onCheckedChange={(v) => setUseKeywords(!!v)} />
              <Label htmlFor="bk-kw" className="font-medium cursor-pointer">Adicionar palavras-chave</Label>
            </div>
            {useKeywords && (
              <>
                <Input
                  placeholder="separadas por vírgula: lembrança, batizado, menina"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">As palavras serão somadas às existentes (sem duplicar).</p>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleApply} disabled={busy || !anyChecked}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aplicando…</> : `Aplicar a ${selectedIds.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkEditProductsDialog;
