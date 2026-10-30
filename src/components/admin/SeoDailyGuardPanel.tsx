import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GuardCheck { name: string; ok: boolean; detail: string }
interface GuardRun {
  id: string;
  ran_at: string;
  total: number;
  passed: number;
  errors: number;
  checks: {
    checks?: GuardCheck[];
    sitemap_changed?: boolean;
    feed_changed?: boolean;
    resubmitted?: boolean;
    sitemap_urls?: number;
  } | null;
}

const LABELS: Record<string, string> = {
  sitemap_reachable: 'Sitemap acessível',
  merchant_feed: 'Feed do Merchant',
  jsonld_valid: 'JSON-LD renderizado',
  resubmission: 'Reenvio aos buscadores',
};

const SeoDailyGuardPanel = () => {
  const { toast } = useToast();
  const [runs, setRuns] = useState<GuardRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('seo_check_runs')
      .select('id, ran_at, total, passed, errors, checks')
      .eq('source', 'daily-guard')
      .order('ran_at', { ascending: false })
      .limit(10);
    setRuns((data ?? []) as unknown as GuardRun[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async (force: boolean) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-daily-guard', { body: { force } });
      if (error) throw error;
      const res = data as { resubmitted: boolean; sitemap_changed: boolean; feed_changed: boolean };
      toast({
        title: res.resubmitted ? 'Validação + reenvio concluídos' : 'Validação concluída',
        description: res.sitemap_changed || res.feed_changed
          ? 'Mudanças detectadas — buscadores notificados.'
          : 'Nenhuma mudança detectada; reenvio dispensado.',
      });
      await load();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha na validação diária',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" /> Validação diária (gate de diff)
          </CardTitle>
          <CardDescription>
            Roda 1x/dia e só reenvia sitemap/IndexNow quando o sitemap ou o feed do Merchant mudaram.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button onClick={() => runNow(false)} disabled={running} variant="outline" className="min-h-11">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Validar agora
          </Button>
          <Button onClick={() => runNow(true)} disabled={running} variant="ghost" className="min-h-11">
            Forçar reenvio
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        {!loading && runs.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
        )}
        {runs.map((run) => (
          <div key={run.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              {run.errors === 0
                ? <CheckCircle2 className="h-4 w-4 text-primary" />
                : <XCircle className="h-4 w-4 text-destructive" />}
              <span className="text-sm font-medium">
                {new Date(run.ran_at).toLocaleString('pt-BR')}
              </span>
              <Badge variant={run.errors ? 'destructive' : 'secondary'} className="text-[10px]">
                {run.passed}/{run.total} checks
              </Badge>
              {run.checks?.resubmitted && <Badge variant="outline" className="text-[10px]">reenviado</Badge>}
              {run.checks?.sitemap_changed && <Badge variant="outline" className="text-[10px]">sitemap alterado</Badge>}
              {run.checks?.feed_changed && <Badge variant="outline" className="text-[10px]">feed alterado</Badge>}
              {typeof run.checks?.sitemap_urls === 'number' && (
                <span className="ml-auto text-xs text-muted-foreground">{run.checks.sitemap_urls} URLs</span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {(run.checks?.checks ?? []).map((c) => (
                <p key={c.name} className={`text-xs ${c.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
                  <span className="font-medium">{LABELS[c.name] ?? c.name}</span>: {c.detail}
                </p>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SeoDailyGuardPanel;
