import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, History, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

export interface SubmissionLogRow {
  id: string;
  channel: 'gsc' | 'indexnow';
  status: string;
  ok: boolean;
  url_count: number;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  gsc: 'Google Search Console',
  indexnow: 'IndexNow (Bing/Yandex)',
};

interface Props {
  onResend: () => void;
  resending: boolean;
}

const SeoSubmissionLogPanel = ({ onResend, resending }: Props) => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['seo-submission-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_submission_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as SubmissionLogRow[];
    },
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" /> Envios aos buscadores
            </CardTitle>
            <CardDescription>
              Últimos avisos enviados ao Google Search Console e ao IndexNow, por data e quantidade de URLs.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
            <Button
              size="sm"
              className="min-h-10"
              onClick={async () => { await onResend(); refetch(); }}
              disabled={resending}
            >
              {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reenviar agora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum envio registrado ainda. Use “Reenviar agora” para notificar os buscadores.
          </p>
        )}
        {data?.map((row) => (
          <div key={row.id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
            {row.ok
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{CHANNEL_LABEL[row.channel] ?? row.channel}</span>
                <Badge variant={row.ok ? 'secondary' : 'destructive'} className="font-normal">{row.status}</Badge>
                <span className="text-xs text-muted-foreground">{row.url_count} URLs</span>
              </div>
              <p className="break-all text-xs text-muted-foreground">
                {row.target} ·{' '}
                {new Date(row.created_at).toLocaleString('pt-BR')} (
                {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ptBR })})
              </p>
              {typeof row.detail?.error === 'string' && (
                <p className="mt-1 break-words text-xs text-destructive">{row.detail.error as string}</p>
              )}
              {typeof row.detail?.gsc_error === 'string' && (
                <p className="mt-1 break-words text-xs text-destructive">{row.detail.gsc_error as string}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SeoSubmissionLogPanel;
