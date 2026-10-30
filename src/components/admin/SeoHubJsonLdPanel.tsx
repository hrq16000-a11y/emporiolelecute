import { useState } from 'react';
import {
  Network, Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  Code2, Copy, Download, Wand2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { exportCsv, exportJson, copyToClipboard } from '@/lib/seoExport';

interface Check { field: string; ok: boolean; detail: string; severity: 'error' | 'warn' }
interface PageReport {
  kind: 'theme_hub' | 'combination_page';
  path: string;
  url: string;
  ok: boolean;
  source: 'prerender' | 'live';
  types: string[];
  checks: Check[];
  duration_ms: number;
  ld_raw?: string[];
  html_head?: string;
}
interface Payload {
  ran_at: string;
  ok: boolean;
  summary: { pages: number; valid: number; invalid: number; theme_hubs: number; combination_pages: number };
  pages: PageReport[];
}
interface FixRow {
  kind: string;
  path: string;
  changed: boolean;
  before: Record<string, string>;
  after: Record<string, string>;
  error?: string;
}
interface FixPayload {
  dry_run: boolean;
  summary: { evaluated: number; applied: number; failed: number };
  rows: FixRow[];
}

const KIND_LABEL: Record<PageReport['kind'], string> = {
  theme_hub: 'Hub temático',
  combination_page: 'Página combinatória',
};

/**
 * Valida o JSON-LD (Organization, BreadcrumbList, CollectionPage/ItemList e
 * Product) renderizado para robôs em cada theme_hub e combination_page,
 * permite inspecionar/copiar o JSON-LD e o HTML lado a lado, exportar o
 * relatório e aplicar correção automática em lote com antes/depois.
 */
const SeoHubJsonLdPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [fixes, setFixes] = useState<FixPayload | null>(null);
  const [inspect, setInspect] = useState<PageReport | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('seo-jsonld-hubs', {
        body: { limit: 12 },
      });
      if (error) throw error;
      const payload = res as Payload;
      setData(payload);
      toast({
        title: payload.ok ? 'JSON-LD dos hubs íntegro' : 'Inconsistências no JSON-LD dos hubs',
        description: `${payload.summary.valid}/${payload.summary.pages} URLs válidas`,
        variant: payload.ok ? 'default' : 'destructive',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao auditar hubs',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  const autofix = async (dryRun: boolean) => {
    setFixing(true);
    try {
      const invalidPaths = (data?.pages ?? []).filter((p) => !p.ok).map((p) => p.path);
      const { data: res, error } = await supabase.functions.invoke('seo-jsonld-autofix', {
        body: { dry_run: dryRun, paths: invalidPaths.length ? invalidPaths : undefined },
      });
      if (error) throw error;
      const payload = res as FixPayload;
      setFixes(payload);
      toast({
        title: dryRun ? 'Simulação concluída' : 'Correção aplicada',
        description: `${payload.summary.applied} de ${payload.summary.evaluated} URL(s) ${dryRun ? 'seriam corrigidas' : 'corrigidas'}.`,
      });
      if (!dryRun && payload.summary.applied > 0) await run();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha na correção automática',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setFixing(false);
    }
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast({
      title: ok ? `${label} copiado` : 'Não foi possível copiar',
      variant: ok ? 'default' : 'destructive',
    });
  };

  const exportRows = () =>
    (data?.pages ?? []).map((p) => ({
      url: p.url,
      path: p.path,
      tipo: KIND_LABEL[p.kind],
      valido: p.ok ? 'sim' : 'não',
      origem: p.source,
      tipos_jsonld: p.types.join(' | '),
      erros: p.checks.filter((c) => !c.ok && c.severity === 'error').map((c) => `${c.field}: ${c.detail}`).join(' | '),
      alertas: p.checks.filter((c) => !c.ok && c.severity === 'warn').map((c) => `${c.field}: ${c.detail}`).join(' | '),
      duracao_ms: p.duration_ms,
      antes: fixes?.rows.find((r) => r.path === p.path)?.before ?? '',
      depois: fixes?.rows.find((r) => r.path === p.path)?.after ?? '',
    }));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Network className="h-5 w-5 text-primary" /> JSON-LD de hubs e combinações
          </CardTitle>
          <CardDescription>
            Confere Organization, BreadcrumbList, CollectionPage/ItemList e Product no HTML servido
            a robôs de cada <code>/tema/:slug</code> e página combinatória.
          </CardDescription>
        </div>
        <Button onClick={run} disabled={loading} variant="outline" className="min-h-11 shrink-0">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Network className="mr-2 h-4 w-4" />}
          Auditar hubs
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data && !loading && (
          <p className="text-sm text-muted-foreground">Nenhuma auditoria executada nesta sessão.</p>
        )}
        {loading && <p className="text-sm text-muted-foreground">Lendo o HTML renderizado de cada URL…</p>}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={data.ok ? 'secondary' : 'destructive'}>
                {data.summary.valid}/{data.summary.pages} URLs válidas
              </Badge>
              <Badge variant="outline">{data.summary.theme_hubs} hubs</Badge>
              <Badge variant="outline">{data.summary.combination_pages} combinações</Badge>

              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" className="min-h-9"
                  onClick={() => exportCsv('seo-jsonld-hubs', exportRows())}>
                  <Download className="mr-1 h-3.5 w-3.5" /> CSV
                </Button>
                <Button size="sm" variant="ghost" className="min-h-9"
                  onClick={() => exportJson('seo-jsonld-hubs', { report: data, autofix: fixes })}>
                  <Download className="mr-1 h-3.5 w-3.5" /> JSON
                </Button>
                <Button size="sm" variant="outline" className="min-h-9" disabled={fixing}
                  onClick={() => autofix(true)}>
                  {fixing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
                  Simular correção
                </Button>
                <Button size="sm" className="min-h-9" disabled={fixing || data.ok}
                  onClick={() => autofix(false)}>
                  <Wand2 className="mr-1 h-3.5 w-3.5" /> Corrigir em lote
                </Button>
              </div>
            </div>

            {data.ok ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Schema consistente</AlertTitle>
                <AlertDescription>
                  Todas as URLs auditadas expõem Organization e BreadcrumbList válidos.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>{data.summary.invalid} URL(s) com JSON-LD incompleto</AlertTitle>
                <AlertDescription>
                  Corrija os campos abaixo antes de reenviar sitemap ou IndexNow.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              {data.pages.map((p) => {
                const fix = fixes?.rows.find((r) => r.path === p.path);
                return (
                  <div key={p.path} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-sm font-medium break-all">{p.path}</span>
                      <Badge variant="outline" className="text-[10px]">{KIND_LABEL[p.kind]}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{p.source}</Badge>
                      <div className="ml-auto flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-8"
                          onClick={() => setInspect(p)}>
                          <Code2 className="mr-1 h-3.5 w-3.5" /> Ver JSON-LD
                        </Button>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {p.checks.filter((c) => !c.ok).map((c) => (
                        <p
                          key={c.field}
                          className={`flex items-start gap-1 text-xs ${
                            c.severity === 'error' ? 'text-destructive' : 'text-muted-foreground'
                          }`}
                        >
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            <span className="font-medium">{c.field}</span>: {c.detail}
                          </span>
                        </p>
                      ))}
                      {p.ok && (
                        <p className="text-xs text-muted-foreground">
                          {p.types.join(' · ') || 'sem tipos'} — {p.duration_ms}ms
                        </p>
                      )}
                      {fix?.changed && (
                        <div className="mt-2 rounded-md bg-muted/50 p-2 text-[11px]">
                          <p className="font-medium">Correção automática</p>
                          {Object.keys(fix.after).map((k) => (
                            <p key={k} className="break-all">
                              <span className="text-muted-foreground">{k}:</span>{' '}
                              <span className="line-through opacity-60">{fix.before[k] || '(vazio)'}</span>{' → '}
                              <span className="text-primary">{fix.after[k]}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {fix?.error && (
                        <p className="text-xs text-destructive">Falha ao corrigir: {fix.error}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Dialog open={!!inspect} onOpenChange={(o) => !o && setInspect(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="break-all text-base">{inspect?.path}</DialogTitle>
              <DialogDescription>
                JSON-LD renderizado e HTML servido ao robô, lado a lado. Origem: {inspect?.source}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">JSON-LD ({inspect?.ld_raw?.length ?? 0} bloco(s))</p>
                  <Button size="sm" variant="ghost" className="h-8"
                    onClick={() => copy((inspect?.ld_raw ?? []).join('\n\n'), 'JSON-LD')}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
                <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                  {(inspect?.ld_raw ?? []).join('\n\n') || 'Nenhum bloco JSON-LD encontrado.'}
                </pre>
                <div className="space-y-1">
                  {(inspect?.checks ?? []).map((c) => (
                    <p key={c.field} className={`text-xs ${c.ok ? 'text-muted-foreground' : c.severity === 'error' ? 'text-destructive' : 'text-amber-600'}`}>
                      {c.ok ? '✓' : c.severity === 'error' ? '✕' : '!'} <span className="font-medium">{c.field}</span>: {c.detail}
                    </p>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">HTML (&lt;head&gt;)</p>
                  <Button size="sm" variant="ghost" className="h-8"
                    onClick={() => copy(inspect?.html_head ?? '', 'HTML')}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
                <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                  {inspect?.html_head || 'HTML indisponível — reexecute a auditoria.'}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SeoHubJsonLdPanel;
