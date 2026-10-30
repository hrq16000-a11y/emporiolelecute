import { useState } from 'react';
import { ShieldAlert, RefreshCw, Loader2, ExternalLink, MailCheck, MailX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useSecurityScans, useRunSecurityScan, type ScanSeverity,
} from '@/hooks/useSecurityScans';

const SEV_CLASS: Record<ScanSeverity, string> = {
  critical: 'bg-destructive/15 text-destructive',
  high: 'bg-destructive/10 text-destructive',
  moderate: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground',
};

/**
 * Scan de vulnerabilidades pós-deploy: histórico das execuções (cron + manual),
 * achados por severidade e status do alerta automático por e-mail.
 */
const AdminSecurityScan = () => {
  const { toast } = useToast();
  const { data: runs, isLoading } = useSecurityScans();
  const run = useRunSecurityScan();
  const [openId, setOpenId] = useState<string | null>(null);

  const latest = runs?.[0];

  const handleRun = async () => {
    try {
      await run.mutateAsync();
      toast({ title: 'Scan concluído', description: 'Resultados atualizados abaixo.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao executar o scan',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <ShieldAlert className="h-6 w-6 text-primary" /> Scan de vulnerabilidades
          </h1>
          <p className="text-sm text-muted-foreground">
            Varredura diária das dependências na base pública OSV.dev, com alerta por e-mail em
            achados críticos/altos ou regressão.
          </p>
        </div>
        <Button onClick={handleRun} disabled={run.isPending} className="min-h-11">
          {run.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Rodar agora
        </Button>
      </header>

      {isLoading && (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!isLoading && !runs?.length && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma execução registrada ainda. Rode o primeiro scan para criar a linha de base.
          </CardContent>
        </Card>
      )}

      {latest && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg">Última execução</CardTitle>
            <CardDescription>
              {new Date(latest.created_at).toLocaleString('pt-BR')} · gatilho {latest.trigger} ·{' '}
              {latest.packages_scanned} pacotes analisados
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {([
              ['Críticas', latest.critical_count, 'critical'],
              ['Altas', latest.high_count, 'high'],
              ['Médias', latest.moderate_count, 'moderate'],
              ['Baixas', latest.low_count, 'low'],
            ] as Array<[string, number, ScanSeverity]>).map(([label, value, sev]) => (
              <div key={label} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-1 inline-block rounded px-2 py-0.5 text-lg font-semibold ${SEV_CLASS[sev]}`}>
                  {value}
                </p>
              </div>
            ))}
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Alerta</p>
              <p className="mt-1 flex items-center gap-1 text-sm">
                {latest.alert_sent ? (
                  <><MailCheck className="h-4 w-4 text-primary" /> enviado</>
                ) : (
                  <><MailX className="h-4 w-4 text-muted-foreground" /> {latest.alert_reason ?? 'não enviado'}</>
                )}
              </p>
              {latest.regression && (
                <Badge variant="outline" className="mt-2 border-0 bg-destructive/10 text-destructive">
                  Regressão detectada
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!!runs?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico</CardTitle>
            <CardDescription>Clique em uma execução para ver os achados detalhados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="rounded-lg border transition-colors hover:bg-muted/30">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className="flex w-full flex-wrap items-center gap-2 p-3 text-left text-sm"
                  aria-expanded={openId === r.id}
                >
                  <span className="font-medium">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                  <Badge variant="outline">{r.trigger}</Badge>
                  {r.status === 'error' ? (
                    <Badge variant="outline" className="border-0 bg-destructive/10 text-destructive">
                      erro: {r.error}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      {r.total_findings} achado(s) · {r.critical_count} crítico(s) · {r.high_count} alto(s)
                    </span>
                  )}
                </button>
                {openId === r.id && (
                  <ul className="animate-fade-in space-y-2 border-t p-3 text-xs">
                    {r.findings?.length ? (
                      r.findings.map((f) => (
                        <li key={`${r.id}-${f.id}`} className="rounded-md border bg-muted/30 p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`border-0 ${SEV_CLASS[f.severity]}`}>
                              {f.severity}
                            </Badge>
                            <span className="font-medium">{f.package}@{f.version}</span>
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {f.id} <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <p className="mt-1 text-muted-foreground">{f.summary}</p>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">Nenhuma vulnerabilidade nesta execução.</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminSecurityScan;
