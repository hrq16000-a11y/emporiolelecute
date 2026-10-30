import { useState } from 'react';
import { Type, Wand2, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Candidate {
  id: string;
  name: string;
  slug: string;
  current: string;
  current_length: number;
  suggestion: string;
  suggestion_length: number;
}

const SeoTitleFixPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-title-optimizer', {
        body: { action: 'suggest' },
      });
      if (error) throw error;
      const list = (data as { candidates: Candidate[] }).candidates ?? [];
      setCandidates(list);
      setSelected(new Set(list.map((c) => c.id)));
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao gerar sugestões',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyBatch = async () => {
    if (!selected.size) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-title-optimizer', {
        body: { action: 'apply', ids: [...selected] },
      });
      if (error) throw error;
      const res = data as { applied_count: number; failed_count: number };
      toast({
        title: 'Correção aplicada',
        description: `${res.applied_count} título(s) ajustado(s)${res.failed_count ? `, ${res.failed_count} falha(s)` : ''}.`,
      });
      await load();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao aplicar correção',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setApplying(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Type className="h-5 w-5 text-primary" /> Títulos longos
            </CardTitle>
            <CardDescription>
              Sugestões automáticas de título SEO com até 60 caracteres. O nome do produto na loja não muda —
              só o título exibido no Google.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="min-h-10" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Gerar sugestões
            </Button>
            {!!candidates?.length && (
              <Button size="sm" className="min-h-10" onClick={applyBatch} disabled={applying || !selected.size}>
                {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Aplicar em lote ({selected.size})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        {candidates && candidates.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">
            Nenhum título acima de 60 caracteres. Nada a corrigir.
          </p>
        )}
        {candidates?.map((c) => (
          <div key={c.id} className="flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
            <Checkbox
              checked={selected.has(c.id)}
              onCheckedChange={() => toggle(c.id)}
              className="mt-1"
              aria-label={`Selecionar ${c.name}`}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="break-words text-sm text-muted-foreground line-through">
                {c.current} <Badge variant="destructive" className="ml-1 font-normal">{c.current_length}</Badge>
              </p>
              <p className="break-words text-sm font-medium">
                {c.suggestion} <Badge variant="secondary" className="ml-1 font-normal">{c.suggestion_length}</Badge>
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SeoTitleFixPanel;
