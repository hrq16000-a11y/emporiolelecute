import { useState } from 'react';
import { Loader2, LineChart, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Row { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
interface CoverageRow {
  url: string; verdict: string; indexing_state: string; coverage_state: string;
  last_crawl: string | null; canonical: string | null; canonical_ok: boolean;
}
interface Failure { id: string; channel: string; status: string; ok: boolean; url_count: number | null; created_at: string }
interface Payload {
  status?: 'selection_required' | 'no_property';
  candidates?: string[];
  message?: string;
  ran_at?: string;
  site_url?: string;
  period?: { start: string; end: string; days: number };
  summary?: {
    sitemap_urls: number; inspected: number; indexed: number; excluded: number;
    canonical_mismatch: number; clicks: number; impressions: number; submission_failures: number;
  };
  queries?: Row[];
  pages?: Row[];
  analytics_errors?: string[];
  coverage?: CoverageRow[];
  submission_failures?: Failure[];
}

const SeoGscCoveragePanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Payload | null>(null);

  const run = async (siteUrl?: string) => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('seo-gsc-coverage', {
        body: { inspect: 8, days: 28, ...(siteUrl ? { site_url: siteUrl } : {}) },
      });
      if (error) throw error;
      setData(res as Payload);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao consultar o Search Console',
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
            <LineChart className="h-5 w-5 text-primary" /> Google Search Console — cobertura e consultas
          </CardTitle>
          <CardDescription>
            Estado de indexação das URLs do sitemap, páginas excluídas e principais consultas, correlacionados com falhas de envio.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => run()} disabled={loading} className="min-h-11">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LineChart className="mr-2 h-4 w-4" />}
          Carregar dados
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !data && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}

        {data?.status === 'no_property' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Nenhuma propriedade verificada</AlertTitle>
            <AlertDescription>{data.message}</AlertDescription>
          </Alert>
        )}

        {data?.status === 'selection_required' && (
          <div className="space-y-2">
            <p className="text-sm">Escolha a propriedade do Search Console a consultar:</p>
            {data.candidates?.map((c) => (
              <Button key={c} variant="outline" size="sm" className="mr-2" onClick={() => run(c)}>{c}</Button>
            ))}
          </div>
        )}

        {data?.summary && (
          <>
            <p className="text-xs text-muted-foreground">
              Propriedade <span className="font-mono">{data.site_url}</span> · período {data.period?.start} → {data.period?.end}
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="URLs no sitemap" value={data.summary.sitemap_urls} bad={false} />
              <Stat label="Inspecionadas" value={data.summary.inspected} bad={false} />
              <Stat label="Indexadas" value={data.summary.indexed} bad={false} />
              <Stat label="Excluídas" value={data.summary.excluded} bad={data.summary.excluded > 0} />
              <Stat label="Cliques (28d)" value={data.summary.clicks} bad={false} />
              <Stat label="Falhas de envio" value={data.summary.submission_failures} bad={data.summary.submission_failures > 0} />
            </div>

            {data.analytics_errors && data.analytics_errors.length > 0 && (
              <p className="text-xs text-amber-600">{data.analytics_errors.join(' · ')}</p>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Estado de indexação (amostra do sitemap)</p>
                <div className="max-h-64 space-y-1 overflow-auto text-xs">
                  {(data.coverage ?? []).map((c) => (
                    <div key={c.url} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                      <span className="truncate font-mono">{c.url.replace(/^https?:\/\/[^/]+/, '')}</span>
                      <Badge variant={c.verdict === 'PASS' ? 'default' : 'destructive'} className="shrink-0 font-normal">
                        {c.coverage_state !== '—' ? c.coverage_state : c.verdict}
                      </Badge>
                    </div>
                  ))}
                  {(data.coverage ?? []).length === 0 && <p className="text-muted-foreground">Nenhuma URL inspecionada.</p>}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Principais consultas</p>
                <div className="max-h-64 space-y-1 overflow-auto text-xs">
                  {(data.queries ?? []).slice(0, 20).map((r) => (
                    <div key={r.keys[0]} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                      <span className="truncate">{r.keys[0]}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {r.clicks} cliques · {r.impressions} impr. · pos. {r.position.toFixed(1)}
                      </span>
                    </div>
                  ))}
                  {(data.queries ?? []).length === 0 && <p className="text-muted-foreground">Sem dados reportados no período.</p>}
                </div>
              </div>
            </div>

            {(data.pages ?? []).length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Páginas com mais impressões</p>
                <div className="max-h-56 space-y-1 overflow-auto text-xs">
                  {(data.pages ?? []).slice(0, 15).map((r) => (
                    <div key={r.keys[0]} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                      <a href={r.keys[0]} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate font-mono hover:text-primary">
                        {r.keys[0].replace(/^https?:\/\/[^/]+/, '')} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <span className="shrink-0 text-muted-foreground">{r.clicks} / {r.impressions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(data.submission_failures ?? []).length > 0 && (
              <div className="rounded-lg border border-destructive/40 p-3">
                <p className="mb-2 text-sm font-medium text-destructive">Falhas recentes de sitemap / IndexNow / merchant-feed</p>
                <div className="space-y-1 text-xs">
                  {(data.submission_failures ?? []).map((f) => (
                    <p key={f.id}>
                      <span className="font-medium">{f.channel}</span> — {f.status} ·{' '}
                      {new Date(f.created_at).toLocaleString('pt-BR')}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value, bad }: { label: string; value: number | string; bad: boolean }) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={bad ? 'text-xl font-semibold text-destructive' : 'text-xl font-semibold text-primary'}>{value}</p>
  </div>
);

export default SeoGscCoveragePanel;
