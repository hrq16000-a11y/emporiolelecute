import { useState } from 'react';
import { Loader2, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RobotsCheck { name: string; ok: boolean; severity: 'error' | 'warn' | 'info'; detail: string }
interface PageAudit {
  kind: 'theme_hub' | 'combination_page' | 'core';
  path: string;
  url: string;
  status: number;
  redirected_to: string | null;
  canonical: string | null;
  canonical_ok: boolean;
  breadcrumbs: number;
  breadcrumbs_ok: boolean;
  meta_robots: string | null;
  x_robots_tag: string | null;
  indexable: boolean;
  issues: string[];
  duration_ms: number;
}
interface Payload {
  ran_at: string;
  summary: {
    robots_checks: number; robots_failed: number; pages: number; pages_ok: number;
    canonical_failed: number; breadcrumbs_failed: number; redirected: number; noindex: number;
    theme_hubs: number; combination_pages: number; schema_drift: string[];
  };
  robots: RobotsCheck[];
  robots_txt: string;
  pages: PageAudit[];
}

const KIND_LABEL: Record<PageAudit['kind'], string> = {
  core: 'Rota principal',
  theme_hub: 'Theme hub',
  combination_page: 'Página de combinação',
};

const SeoIndexAuditPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Payload | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('seo-index-audit', { body: { limit: 12 } });
      if (error) throw error;
      setData(res as Payload);
      toast({ title: 'Indexabilidade auditada', description: 'robots.txt, canonical e breadcrumbs verificados.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha na auditoria de indexabilidade',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  const problems = data?.pages.filter((p) => p.issues.length > 0) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" /> Indexabilidade: robots, canonical e breadcrumbs
          </CardTitle>
          <CardDescription>
            Valida robots.txt, cabeçalhos X-Robots-Tag e o HTML renderizado de theme hubs e páginas de combinação.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={run} disabled={loading} className="min-h-11">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Validar indexabilidade
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !data && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}

        {data && (
          <>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Páginas OK" value={`${data.summary.pages_ok}/${data.summary.pages}`} bad={data.summary.pages_ok < data.summary.pages} />
              <Stat label="Canonical com falha" value={data.summary.canonical_failed} bad={data.summary.canonical_failed > 0} />
              <Stat label="Breadcrumbs faltando" value={data.summary.breadcrumbs_failed} bad={data.summary.breadcrumbs_failed > 0} />
              <Stat label="Redirects" value={data.summary.redirected} bad={data.summary.redirected > 0} />
              <Stat label="Noindex" value={data.summary.noindex} bad={data.summary.noindex > 0} />
            </div>

            <div className="space-y-2">
              {data.robots.map((c) => (
                <div key={c.name} className="flex items-start gap-3 rounded-lg border p-3">
                  {c.ok
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    : c.severity === 'error'
                      ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="break-words text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {problems.length === 0 ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Todas as {data.summary.pages} páginas auditadas ({data.summary.theme_hubs} hubs · {data.summary.combination_pages} combinações)
                estão indexáveis, com canonical correto e breadcrumbs válidos.
              </p>
            ) : (
              problems.map((p) => (
                <div key={p.url} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      <Badge variant="secondary" className="mr-2 font-normal">{KIND_LABEL[p.kind]}</Badge>
                      {p.path}
                    </span>
                    <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.issues.map((i) => (
                      <Badge key={i} variant="destructive" className="font-normal">{i}</Badge>
                    ))}
                  </div>
                </div>
              ))
            )}

            {data.summary.schema_drift.length > 0 && (
              <p className="text-xs text-amber-600">
                Colunas ausentes ignoradas: {data.summary.schema_drift.join(', ')}
              </p>
            )}

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">robots.txt servido</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{data.robots_txt || '—'}</pre>
            </details>
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

export default SeoIndexAuditPanel;
