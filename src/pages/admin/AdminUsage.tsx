import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Activity, Download, RotateCcw, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  getUsageAggregates,
  exportUsageEvents,
  resetUsage,
  type UsageAggregates,
} from '@/lib/adminUsage';

function fmtMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function sortDesc<T>(obj: Record<string, T>, valueFn: (v: T) => number): Array<[string, T]> {
  return Object.entries(obj).sort((a, b) => valueFn(b[1]) - valueFn(a[1]));
}

const AdminUsage = () => {
  const [data, setData] = useState<UsageAggregates>(() => getUsageAggregates());

  const refresh = () => setData(getUsageAggregates());

  useEffect(() => {
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, []);

  const handleExport = () => {
    const events = exportUsageEvents();
    const blob = new Blob([JSON.stringify({ aggregates: data, events }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-usage-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Eventos exportados');
  };

  const handleReset = () => {
    resetUsage();
    refresh();
    toast.success('Eventos limpos');
  };

  const startedAgo = fmtMs(Date.now() - data.startedAt);
  const topPages = sortDesc(data.pageViews, (v) => v).slice(0, 15);
  const leastPages = sortDesc(data.pageViews, (v) => -v).slice(0, 10);
  const dwell = sortDesc(data.avgDwellMs, (v) => v).slice(0, 10);
  const navs = sortDesc(data.navClicks, (v) => v).slice(0, 15);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold flex items-center gap-3">
            <Activity className="w-7 h-7 text-primary" aria-hidden />
            Uso do Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Telemetria local (apenas neste navegador) · {data.totalEvents} eventos · coletando há {startedAgo}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data.totalEvents}>
            <Download className="w-4 h-4 mr-2" /> Exportar JSON
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Limpar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar todos os eventos coletados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Toda a telemetria local deste navegador será apagada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={handleReset}
                >
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Páginas mais acessadas</CardTitle>
            <CardDescription>Top 15 por número de visitas internas</CardDescription>
          </CardHeader>
          <CardContent>
            {topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {topPages.map(([route, count]) => (
                  <li key={route} className="flex items-center justify-between text-sm">
                    <code className="text-xs font-mono truncate max-w-[70%]" title={route}>
                      {route}
                    </code>
                    <Badge variant="secondary">{count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Páginas menos acessadas</CardTitle>
            <CardDescription>Candidatas a ocultação ou simplificação</CardDescription>
          </CardHeader>
          <CardContent>
            {leastPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {leastPages.map(([route, count]) => (
                  <li key={route} className="flex items-center justify-between text-sm">
                    <code className="text-xs font-mono truncate max-w-[70%]" title={route}>
                      {route}
                    </code>
                    <Badge variant="outline">{count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Tempo médio por seção</CardTitle>
            <CardDescription>Dwell time aproximado</CardDescription>
          </CardHeader>
          <CardContent>
            {dwell.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {dwell.map(([route, ms]) => (
                  <li key={route} className="flex items-center justify-between text-sm">
                    <code className="text-xs font-mono truncate max-w-[70%]" title={route}>
                      {route}
                    </code>
                    <Badge variant="secondary">{fmtMs(ms)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Cliques na navegação lateral</CardTitle>
            <CardDescription>Itens de menu mais usados</CardDescription>
          </CardHeader>
          <CardContent>
            {navs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {navs.map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[70%]" title={label}>
                      {label}
                    </span>
                    <Badge variant="secondary">{count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-display">Formulários — abertura, submissão e abandono</CardTitle>
            <CardDescription>Taxa de conclusão = submits ÷ aberturas</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(data.forms).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Formulário</th>
                      <th className="py-2 pr-4 text-right">Abertos</th>
                      <th className="py-2 pr-4 text-right">Enviados</th>
                      <th className="py-2 pr-4 text-right">Abandonados</th>
                      <th className="py-2 pr-4 text-right">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortDesc(data.forms, (v) => v.opened).map(([name, stats]) => (
                      <tr key={name} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-mono text-xs">{name}</td>
                        <td className="py-2 pr-4 text-right">{stats.opened}</td>
                        <td className="py-2 pr-4 text-right">{stats.submitted}</td>
                        <td className="py-2 pr-4 text-right">{stats.abandoned}</td>
                        <td className="py-2 pr-4 text-right">
                          <Badge
                            variant={stats.submitRate >= 60 ? 'secondary' : 'outline'}
                            className={stats.submitRate < 30 ? 'text-destructive' : ''}
                          >
                            {stats.submitRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Buscas em listas</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(data.listSearches).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {sortDesc(data.listSearches, (v) => v).map(([name, count]) => (
                  <li key={name} className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Slugs com tentativa inválida</CardTitle>
            <CardDescription>Conta apenas — nenhum valor é armazenado</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(data.slugInvalidAttempts).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tentativa inválida registrada.</p>
            ) : (
              <ul className="space-y-1.5">
                {sortDesc(data.slugInvalidAttempts, (v) => v).map(([entity, count]) => (
                  <li key={entity} className="flex items-center justify-between text-sm">
                    <span>{entity}</span>
                    <Badge variant="outline">{count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Dados armazenados apenas em <code>localStorage</code> deste navegador. Nenhum conteúdo de
        formulário, produto ou cliente é coletado. Limite de 2000 eventos (rotacionados).
      </p>
    </div>
  );
};

export default AdminUsage;
