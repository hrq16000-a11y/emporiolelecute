import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, RefreshCw, Download, Loader2, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { exportCsv, exportJson } from '@/lib/seoExport';
import { toast } from 'sonner';

interface SnapshotRow {
  snapshot_date: string;
  site_url: string;
  page_type: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  indexed_count: number;
  excluded_count: number;
  top_queries: { query: string; clicks: number; impressions: number; position: number }[];
}

const PAGE_TYPE_LABEL: Record<string, string> = {
  all: 'Todas as páginas',
  home: 'Home',
  produto: 'Páginas de produto',
  catalogo: 'Catálogo / loja',
  colecao: 'Coleções',
  kit: 'Kits',
  ocasiao: 'Ocasiões',
  theme_hub: 'Hubs temáticos',
  combination_page: 'Páginas combinatórias',
  blog: 'Blog',
  busca: 'Busca interna',
  institucional: 'Institucionais',
};

const METRICS = [
  { key: 'impressions', label: 'Impressões', color: 'hsl(var(--primary))' },
  { key: 'clicks', label: 'Cliques', color: 'hsl(24 90% 55%)' },
  { key: 'ctr', label: 'CTR (%)', color: 'hsl(150 55% 42%)' },
  { key: 'position', label: 'Posição média', color: 'hsl(280 45% 55%)' },
] as const;

type MetricKey = typeof METRICS[number]['key'];

const Delta = ({ value, invert }: { value: number; invert?: boolean }) => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.5) {
    return <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="h-3 w-3" />estável</span>;
  }
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 ${good ? 'text-emerald-600' : 'text-destructive'}`}>
      <Icon className="h-3 w-3" />{Math.abs(value).toFixed(1)}%
    </span>
  );
};

/**
 * Painel de tendências do Google Search Console: séries históricas de
 * impressões, cliques, CTR, posição e cobertura — segmentadas por tipo de página.
 * Lê exclusivamente os snapshots persistidos (nenhuma chamada ao GSC no render).
 */
const SeoGscTrendsPanel = () => {
  const [pageType, setPageType] = useState('all');
  const [metric, setMetric] = useState<MetricKey>('impressions');
  const [days, setDays] = useState('30');
  const [capturing, setCapturing] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['seo-gsc-snapshots', days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - Number(days));
      const { data, error } = await supabase
        .from('seo_gsc_snapshots' as never)
        .select('*')
        .gte('snapshot_date', since.toISOString().slice(0, 10))
        .order('snapshot_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SnapshotRow[];
    },
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const pageTypes = useMemo(
    () => [...new Set(rows.map((r) => r.page_type))].sort((a, b) => (a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b))),
    [rows],
  );

  const series = useMemo(
    () =>
      rows
        .filter((r) => r.page_type === pageType)
        .map((r) => ({
          date: format(parseISO(r.snapshot_date), 'dd/MM', { locale: ptBR }),
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: Number(r.ctr),
          position: Number(r.position),
        })),
    [rows, pageType],
  );

  const latestByType = useMemo(() => {
    const map = new Map<string, SnapshotRow>();
    for (const r of rows) map.set(r.page_type, r); // ordenado asc → fica o mais recente
    return map;
  }, [rows]);

  const trendFor = (type: string, key: MetricKey) => {
    const s = rows.filter((r) => r.page_type === type);
    if (s.length < 2) return 0;
    const half = Math.floor(s.length / 2);
    const avg = (arr: SnapshotRow[]) => arr.reduce((a, r) => a + Number(r[key] ?? 0), 0) / (arr.length || 1);
    const before = avg(s.slice(0, half));
    const after = avg(s.slice(half));
    if (!before) return after ? 100 : 0;
    return ((after - before) / before) * 100;
  };

  const captureNow = async () => {
    setCapturing(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-gsc-snapshot', { body: { days: 1 } });
      if (error) throw error;
      const result = data as { ok?: boolean; status?: string; page_types?: number; candidates?: string[] };
      if (result?.status === 'selection_required') {
        toast.error('Há mais de uma propriedade verificada no Search Console. Escolha uma para continuar.', {
          description: (result.candidates ?? []).join(' • '),
        });
      } else if (result?.status === 'no_property') {
        toast.error('Nenhuma propriedade verificada do Search Console cobre este site.');
      } else {
        toast.success(`Snapshot capturado: ${result?.page_types ?? 0} tipos de página.`);
        refetch();
      }
    } catch (e) {
      toast.error('Não foi possível capturar o snapshot agora.', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setCapturing(false);
    }
  };

  const activeMetric = METRICS.find((m) => m.key === metric)!;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" /> Tendências do Search Console
            </CardTitle>
            <CardDescription>
              Série histórica diária de desempenho e indexação por tipo de página. Os snapshots são
              capturados automaticamente todos os dias.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="min-h-10" onClick={captureNow} disabled={capturing}>
              {capturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Capturar agora
            </Button>
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button
              variant="outline" size="sm" className="min-h-10" disabled={rows.length === 0}
              onClick={() => exportCsv('gsc-tendencias', rows.map(({ top_queries, ...r }) => r))}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline" size="sm" className="min-h-10" disabled={rows.length === 0}
              onClick={() => exportJson('gsc-tendencias', rows)}
            >
              <Download className="mr-2 h-4 w-4" /> JSON
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={pageType} onValueChange={setPageType}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Tipo de página" /></SelectTrigger>
            <SelectContent>
              {(pageTypes.length ? pageTypes : ['all']).map((t) => (
                <SelectItem key={t} value={t}>{PAGE_TYPE_LABEL[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Métrica" /></SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : series.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Ainda não há snapshots para este período. Clique em <strong>Capturar agora</strong> para
            criar o primeiro ponto da série histórica.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  reversed={metric === 'position'}
                  allowDecimals={metric === 'ctr' || metric === 'position'}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone" dataKey={metric} name={activeMetric.label}
                  stroke={activeMetric.color} strokeWidth={2} dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Resumo por tipo de página */}
        {pageTypes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Tipo de página</th>
                  <th className="py-2 pr-3 font-medium">Impressões</th>
                  <th className="py-2 pr-3 font-medium">Cliques</th>
                  <th className="py-2 pr-3 font-medium">CTR</th>
                  <th className="py-2 pr-3 font-medium">Posição</th>
                  <th className="py-2 pr-3 font-medium">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {pageTypes.map((t) => {
                  const latest = latestByType.get(t);
                  if (!latest) return null;
                  const total = latest.indexed_count + latest.excluded_count;
                  return (
                    <tr key={t} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{PAGE_TYPE_LABEL[t] ?? t}</td>
                      <td className="py-2 pr-3">
                        {latest.impressions.toLocaleString('pt-BR')}
                        <span className="ml-2 text-xs"><Delta value={trendFor(t, 'impressions')} /></span>
                      </td>
                      <td className="py-2 pr-3">
                        {latest.clicks.toLocaleString('pt-BR')}
                        <span className="ml-2 text-xs"><Delta value={trendFor(t, 'clicks')} /></span>
                      </td>
                      <td className="py-2 pr-3">{Number(latest.ctr).toFixed(2)}%</td>
                      <td className="py-2 pr-3">
                        {Number(latest.position).toFixed(1)}
                        <span className="ml-2 text-xs"><Delta value={trendFor(t, 'position')} invert /></span>
                      </td>
                      <td className="py-2 pr-3">
                        {total > 0 ? (
                          <Badge variant={latest.excluded_count === 0 ? 'default' : 'secondary'}>
                            {latest.indexed_count}/{total} com tráfego
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SeoGscTrendsPanel;
