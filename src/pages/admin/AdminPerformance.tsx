import { useMemo, useRef, useState } from 'react';
import { Gauge, Upload, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  useWebVitalsReports, useSaveWebVitalsReport, useDeleteWebVitalsReport,
  type WebVitalsPage,
} from '@/hooks/useWebVitalsReports';
import SeoWebVitalsPanel from '@/components/admin/SeoWebVitalsPanel';

type MetricKey = 'score' | 'lcp' | 'cls' | 'tbt' | 'fcp';

const METRICS: Array<{ key: MetricKey; label: string; unit: string; higherIsBetter: boolean }> = [
  { key: 'score', label: 'Performance', unit: 'pts', higherIsBetter: true },
  { key: 'lcp', label: 'LCP', unit: 'ms', higherIsBetter: false },
  { key: 'cls', label: 'CLS', unit: '', higherIsBetter: false },
  { key: 'tbt', label: 'TBT', unit: 'ms', higherIsBetter: false },
  { key: 'fcp', label: 'FCP', unit: 'ms', higherIsBetter: false },
];

const fmt = (key: MetricKey, v?: number | null) => {
  if (v === null || v === undefined) return '—';
  if (key === 'cls') return v.toFixed(3);
  if (key === 'score') return String(Math.round(v));
  return `${Math.round(v)} ms`;
};

const delta = (key: MetricKey, before?: number | null, after?: number | null) => {
  if (before == null || after == null) return null;
  const diff = after - before;
  const metric = METRICS.find((m) => m.key === key)!;
  const better = metric.higherIsBetter ? diff > 0 : diff < 0;
  return { diff, better: Math.abs(diff) < 1e-6 ? null : better };
};

/**
 * Dashboard de performance: histórico dos relatórios Lighthouse
 * (`npm run audit:vitals`) com comparação antes × depois, e o painel de
 * Core Web Vitals reais (RUM) coletados dos visitantes.
 */
const AdminPerformance = () => {
  const { toast } = useToast();
  const { data: reports, isLoading } = useWebVitalsReports();
  const save = useSaveWebVitalsReport();
  const remove = useDeleteWebVitalsReport();
  const fileRef = useRef<HTMLInputElement>(null);

  const [beforeId, setBeforeId] = useState<string>('');
  const [afterId, setAfterId] = useState<string>('');
  const [pageFilter, setPageFilter] = useState<string>('todas');
  const [metricFilter, setMetricFilter] = useState<'todas' | MetricKey>('todas');

  const list = reports ?? [];
  const before = list.find((r) => r.id === beforeId) ?? list[1];
  const after = list.find((r) => r.id === afterId) ?? list[0];

  const pageNames = useMemo(() => {
    const set = new Set<string>();
    [before, after].forEach((r) => r?.pages?.forEach((p) => set.add(p.name)));
    return [...set];
  }, [before, after]);

  const visiblePages = pageNames.filter((n) => pageFilter === 'todas' || n === pageFilter);
  const visibleMetrics = METRICS.filter((m) => metricFilter === 'todas' || m.key === metricFilter);
  const pageOf = (pages: WebVitalsPage[] | undefined, name: string) =>
    pages?.find((p) => p.name === name);

  const handleFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      await save.mutateAsync({ raw });
      toast({ title: 'Relatório importado', description: file.name });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao importar relatório',
        description: e instanceof Error ? e.message : 'JSON inválido',
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Gauge className="h-6 w-6 text-primary" /> Desempenho
        </h1>
        <p className="text-sm text-muted-foreground">
          Histórico de auditorias Lighthouse (antes × depois) e Core Web Vitals de usuários reais.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Relatórios Lighthouse</CardTitle>
            <CardDescription>
              Rode <code>npm run audit:vitals -- --label depois</code> e importe o JSON gerado em{' '}
              <code>reports/web-vitals/</code>.
            </CardDescription>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              className="min-h-11"
              disabled={save.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {save.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Importar relatório
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading && (
            <div className="space-y-2" aria-busy>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!isLoading && list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum relatório salvo ainda. Importe o primeiro JSON para começar o histórico.
            </p>
          )}

          {list.length > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Referência (antes)</Label>
                  <Select value={before?.id ?? ''} onValueChange={setBeforeId}>
                    <SelectTrigger className="min-h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {list.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label} · {new Date(r.created_at).toLocaleDateString('pt-BR')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comparar com (depois)</Label>
                  <Select value={after?.id ?? ''} onValueChange={setAfterId}>
                    <SelectTrigger className="min-h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {list.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label} · {new Date(r.created_at).toLocaleDateString('pt-BR')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Página</Label>
                  <Select value={pageFilter} onValueChange={setPageFilter}>
                    <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {pageNames.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Métrica</Label>
                  <Select value={metricFilter} onValueChange={(v) => setMetricFilter(v as MetricKey | 'todas')}>
                    <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {METRICS.map((m) => (
                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="-mx-2 overflow-x-auto px-2">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Página</th>
                      <th className="py-2 pr-3 font-medium">Métrica</th>
                      <th className="py-2 pr-3 font-medium">{before?.label ?? 'antes'}</th>
                      <th className="py-2 pr-3 font-medium">{after?.label ?? 'depois'}</th>
                      <th className="py-2 pr-3 font-medium">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePages.flatMap((name) =>
                      visibleMetrics.map((m) => {
                        const b = pageOf(before?.pages, name)?.[m.key] as number | null | undefined;
                        const a = pageOf(after?.pages, name)?.[m.key] as number | null | undefined;
                        const d = delta(m.key, b, a);
                        return (
                          <tr key={`${name}-${m.key}`} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                            <td className="py-2 pr-3">{name}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{m.label}</td>
                            <td className="py-2 pr-3 tabular-nums">{fmt(m.key, b)}</td>
                            <td className="py-2 pr-3 tabular-nums">{fmt(m.key, a)}</td>
                            <td className="py-2 pr-3">
                              {!d || d.better === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`border-0 ${d.better ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}
                                >
                                  {d.diff > 0 ? '+' : ''}{fmt(m.key, d.diff)}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Histórico</p>
                <ul className="space-y-1">
                  {list.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs transition-colors hover:bg-muted/40"
                    >
                      <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                      <span className="font-medium">{r.label}</span>
                      <span className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('pt-BR')} · {r.pages?.length ?? 0} página(s)
                        {r.base_url ? ` · ${r.base_url}` : ''}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto min-h-9 text-destructive"
                        onClick={() => remove.mutate(r.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="sr-only">Apagar relatório {r.label}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SeoWebVitalsPanel />
    </div>
  );
};

export default AdminPerformance;
