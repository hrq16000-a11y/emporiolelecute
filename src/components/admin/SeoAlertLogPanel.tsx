import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, MailCheck, MailX, Clock, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { exportCsv, exportJson } from '@/lib/seoExport';

export interface SeoAlertLogRow {
  id: string;
  channel: string;
  target: string;
  reason: string;
  urls: string[];
  extra: Record<string, unknown>;
  email_to: string | null;
  sent: boolean;
  outcome: string;
  created_at: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  indexnow: 'IndexNow',
  gsc: 'Google Search Console',
  merchant: 'Merchant feed',
  sitemap: 'Sitemap',
  vitals: 'Core Web Vitals',
};

const PERIODS = [
  { value: '1', label: 'Últimas 24h' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

/**
 * Tela de logs de alerta: lista cada tentativa de e-mail (IndexNow,
 * Merchant feed, Core Web Vitals, sitemap, GSC) com URL, motivo e horário.
 */
const SeoAlertLogPanel = () => {
  const [channel, setChannel] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [days, setDays] = useState('30');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['seo-alert-log', days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - Number(days));
      const { data, error } = await supabase
        .from('seo_alert_log' as never)
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SeoAlertLogRow[];
    },
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (channel !== 'all' && r.channel !== channel) return false;
      if (outcome === 'sent' && !r.sent) return false;
      if (outcome === 'failed' && (r.sent || r.outcome === 'throttled')) return false;
      if (outcome === 'throttled' && r.outcome !== 'throttled') return false;
      if (term && !(`${r.target} ${r.reason} ${r.urls?.join(' ') ?? ''}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [data, channel, outcome, search]);

  const exportRows = () =>
    rows.map((r) => ({
      horario: r.created_at,
      canal: CHANNEL_LABEL[r.channel] ?? r.channel,
      alvo: r.target,
      motivo: r.reason,
      urls: (r.urls ?? []).join(' | '),
      destinatario: r.email_to ?? '',
      enviado: r.sent ? 'sim' : 'não',
      resultado: r.outcome,
    }));

  const sentCount = rows.filter((r) => r.sent).length;
  const throttled = rows.filter((r) => r.outcome === 'throttled').length;
  const failed = rows.length - sentCount - throttled;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-primary" /> Logs de alerta por e-mail
            </CardTitle>
            <CardDescription>
              Todo disparo (e toda falha de disparo) de alerta de IndexNow, Merchant feed, sitemap e
              Core Web Vitals — com URL afetada, motivo e horário.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button
              variant="outline" size="sm" className="min-h-10"
              disabled={rows.length === 0}
              onClick={() => exportCsv('seo-alert-log', exportRows())}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline" size="sm" className="min-h-10"
              disabled={rows.length === 0}
              onClick={() => exportJson('seo-alert-log', rows)}
            >
              <Download className="mr-2 h-4 w-4" /> JSON
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Resultado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os resultados</SelectItem>
              <SelectItem value="sent">E-mail enviado</SelectItem>
              <SelectItem value="failed">Falha no envio</SelectItem>
              <SelectItem value="throttled">Contido (anti-spam 6h)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por URL ou motivo…"
            className="min-h-11"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="gap-1"><MailCheck className="h-3 w-3" /> {sentCount} enviados</Badge>
          <Badge variant="outline" className="gap-1"><MailX className="h-3 w-3" /> {failed} falhas</Badge>
          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {throttled} contidos</Badge>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum alerta registrado no período — sinal de que os canais de indexação estão saudáveis.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.sent ? 'default' : r.outcome === 'throttled' ? 'secondary' : 'destructive'}>
                    {r.sent ? 'enviado' : r.outcome === 'throttled' ? 'contido' : 'falhou'}
                  </Badge>
                  <span className="font-medium">{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">{r.target}</p>
                <p className="mt-1 text-xs">{r.reason}</p>
                {r.urls?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-primary">
                      {r.urls.length} URL(s) afetada(s)
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {r.urls.slice(0, 20).map((u) => <li key={u} className="break-all">{u}</li>)}
                    </ul>
                  </details>
                )}
                {r.email_to && (
                  <p className="mt-1 text-[11px] text-muted-foreground">destinatário: {r.email_to}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SeoAlertLogPanel;
