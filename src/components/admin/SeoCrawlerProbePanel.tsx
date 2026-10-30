import { useState } from 'react';
import { Bot, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProbeResult {
  target: string;
  url: string;
  agent: string;
  status: number;
  ok: boolean;
  content_type: string | null;
  bytes: number;
  content_matches: boolean;
  headers: Record<string, string>;
  error: string | null;
  duration_ms: number;
}

interface ProbePayload {
  ran_at: string;
  summary: { probes: number; ok: number; blocked: number; bing_indexnow_status: number; bing_indexnow_ok: boolean };
  results: ProbeResult[];
  bing_indexnow: { status: number; ok: boolean; body: string };
}

const SeoCrawlerProbePanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProbePayload | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('seo-crawler-probe', {
        body: { agents: ['bingbot', 'googlebot'] },
      });
      if (error) throw error;
      setData(res as ProbePayload);
      toast({ title: 'Simulação concluída', description: 'Status e cabeçalhos registrados abaixo.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha na simulação',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" /> Simulação de crawler (Bingbot/Googlebot)
          </CardTitle>
          <CardDescription>
            Acessa a chave IndexNow, o sitemap e o robots.txt com o User-Agent dos robôs e registra status e cabeçalhos.
          </CardDescription>
        </div>
        <Button onClick={run} disabled={loading} variant="outline" className="min-h-11 shrink-0">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
          Simular acesso
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data && !loading && (
          <p className="text-sm text-muted-foreground">Nenhuma simulação executada nesta sessão.</p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={data.summary.blocked ? 'destructive' : 'secondary'}>
                {data.summary.ok}/{data.summary.probes} acessos OK
              </Badge>
              <Badge variant={data.bing_indexnow.ok ? 'secondary' : 'destructive'}>
                Bing IndexNow: {data.bing_indexnow.status || 'sem resposta'}
              </Badge>
            </div>

            {data.results.map((r) => (
              <div key={`${r.agent}-${r.target}`} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {r.ok && r.content_matches
                    ? <CheckCircle2 className="h-4 w-4 text-primary" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="text-sm font-medium">{r.target}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{r.agent}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    HTTP {r.status} · {r.duration_ms}ms · {r.bytes}B
                  </span>
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">{r.url}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(r.headers).map(([k, v]) => (
                    <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {k}: {v.slice(0, 60)}
                    </span>
                  ))}
                </div>
                {!r.content_matches && (
                  <p className="mt-2 text-xs text-destructive">
                    Conteúdo esperado não encontrado{r.error ? ` — ${r.error}` : ''}
                  </p>
                )}
              </div>
            ))}

            {!data.bing_indexnow.ok && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <p className="font-medium text-destructive">Bing recusou o ping IndexNow ({data.bing_indexnow.status})</p>
                <p className="mt-1 break-words text-muted-foreground">{data.bing_indexnow.body || 'sem corpo de resposta'}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SeoCrawlerProbePanel;
