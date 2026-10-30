import { useState } from 'react';
import {
  ShieldCheck, RefreshCw, AlertTriangle, XCircle, CheckCircle2,
  ExternalLink, Rss, Loader2, Search, GitCompare,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import SeoSubmissionLogPanel from '@/components/admin/SeoSubmissionLogPanel';
import SeoTitleFixPanel from '@/components/admin/SeoTitleFixPanel';
import SeoCrawlerProbePanel from '@/components/admin/SeoCrawlerProbePanel';
import SeoJsonLdPanel from '@/components/admin/SeoJsonLdPanel';
import SeoHubJsonLdPanel from '@/components/admin/SeoHubJsonLdPanel';
import SeoWebVitalsPanel from '@/components/admin/SeoWebVitalsPanel';
import SeoDailyGuardPanel from '@/components/admin/SeoDailyGuardPanel';
import SeoIndexAuditPanel from '@/components/admin/SeoIndexAuditPanel';
import SeoImageQualityPanel from '@/components/admin/SeoImageQualityPanel';
import SeoGscCoveragePanel from '@/components/admin/SeoGscCoveragePanel';
import SeoForceActionsPanel from '@/components/admin/SeoForceActionsPanel';
import SeoGscTrendsPanel from '@/components/admin/SeoGscTrendsPanel';
import SeoBingPanel from '@/components/admin/SeoBingPanel';
import SeoAlertLogPanel from '@/components/admin/SeoAlertLogPanel';


interface SiteCheck { name: string; ok: boolean; detail: string; severity: 'info' | 'warn' | 'error' }
interface SiteResult {
  summary: { total: number; passed: number; errors: number; warnings: number };
  checks: SiteCheck[];
  ran_at: string;
}
interface ProductIssue { severity: 'error' | 'warn'; code: string; detail: string }
interface ProductReport { id: string; name: string; slug: string; url: string; issues: ProductIssue[] }
interface FeedIssue { severity: 'error' | 'warn'; code: string; detail: string }
interface FeedItem { id: string; title: string; link: string; issues: FeedIssue[] }
interface FeedDiff {
  previous_at: string | null;
  unchanged: boolean;
  added: string[];
  removed: string[];
  changed: { id: string; title: string; fields: string[] }[];
}
interface FeedResult {
  summary: {
    items: number; ok: number; errors: number; warnings: number;
    ready_to_upload: number; blocked: number; missing_images: number; feed_bytes: number;
  };
  items: FeedItem[];
  diff?: FeedDiff;
  upload_allowed?: boolean;
  feed_url: string;
  ran_at: string;
}
interface ProductResult {
  summary: { products: number; ok: number; errors: number; warnings: number; rich_results_ready: number };
  products: ProductReport[];
  ran_at: string;
}

const FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-feed`;

const CHECK_LABELS: Record<string, string> = {
  sitemap_reachable: 'Sitemap acessível',
  sitemap_canonical_domain: 'Sitemap no domínio canônico',
  sitemap_no_internal_leaks: 'Sitemap sem links internos vazados',
  robots_reachable: 'robots.txt acessível',
  robots_has_sitemap: 'robots.txt aponta o sitemap',
  robots_matches_origin: 'robots.txt sincronizado com a origem',
  home_canonical: 'Canonical da home',
  redirects_no_self_loops: 'Redirecionamentos sem loops',
  gsc_last_submission: 'Último envio ao Google',
};

const AdminSeoCheck = () => {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [site, setSite] = useState<SiteResult | null>(null);
  const [products, setProducts] = useState<ProductResult | null>(null);
  const [feed, setFeed] = useState<FeedResult | null>(null);
  const [pinging, setPinging] = useState(false);

  const runAudit = async () => {
    setRunning(true);
    try {
      const [siteRes, prodRes, feedRes] = await Promise.all([
        supabase.functions.invoke('seo-checks', { body: { source: 'admin-seo-check' } }),
        supabase.functions.invoke('seo-product-audit', { body: {} }),
        supabase.functions.invoke('merchant-feed-audit', { body: {} }),
      ]);
      if (siteRes.error) throw siteRes.error;
      if (prodRes.error) throw prodRes.error;
      setSite(siteRes.data as SiteResult);
      setProducts(prodRes.data as ProductResult);
      setFeed(feedRes.error ? null : (feedRes.data as FeedResult));
      toast({ title: 'Auditoria concluída', description: 'Resultados atualizados abaixo.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha na auditoria',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setRunning(false);
    }
  };

  const pingCrawlers = async () => {
    setPinging(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-sitemap-auto-resubmit', {
        body: { force: true, reason: 'admin-seo-check' },
      });
      if (error) throw error;
      const idx = (data as { indexnow?: { sent?: boolean; urls?: number } })?.indexnow;
      toast({
        title: 'Crawlers notificados',
        description: `Google (sitemap) + IndexNow ${idx?.sent ? `— ${idx.urls} URLs enviadas` : '— não enviado'}`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao notificar crawlers',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setPinging(false);
    }
  };

  const totalErrors = (site?.summary.errors ?? 0) + (products?.summary.errors ?? 0) + (feed?.summary.errors ?? 0);
  const totalWarnings = (site?.summary.warnings ?? 0) + (products?.summary.warnings ?? 0) + (feed?.summary.warnings ?? 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-6 w-6 text-primary" /> SEO Check
          </h1>
          <p className="text-sm text-muted-foreground">
            Validação automática de sitemap, robots.txt, canonical, Open Graph/Twitter e JSON-LD por produto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runAudit} disabled={running} className="min-h-11">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Rodar auditoria
          </Button>
          <Button variant="outline" onClick={pingCrawlers} disabled={pinging} className="min-h-11">
            {pinging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Notificar Google/Bing
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <a href={FEED_URL} target="_blank" rel="noreferrer">
              <Rss className="mr-2 h-4 w-4" /> Feed Merchant
            </a>
          </Button>
        </div>
      </div>

      {(site || products) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Erros" value={totalErrors} tone={totalErrors ? 'error' : 'ok'} />
          <SummaryCard label="Avisos" value={totalWarnings} tone={totalWarnings ? 'warn' : 'ok'} />
          <SummaryCard label="Checks do site OK" value={`${site?.summary.passed ?? 0}/${site?.summary.total ?? 0}`} tone="ok" />
          <SummaryCard
            label="Itens prontos p/ Merchant"
            value={`${feed?.summary.ready_to_upload ?? 0}/${feed?.summary.items ?? 0}`}
            tone={feed && feed.summary.errors > 0 ? 'error' : 'ok'}
          />
          <SummaryCard
            label="Produtos prontos p/ rich results"
            value={`${products?.summary.rich_results_ready ?? 0}/${products?.summary.products ?? 0}`}
            tone={products && products.summary.rich_results_ready < products.summary.products ? 'warn' : 'ok'}
          />
        </div>
      )}

      {running && !site && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {!site && !running && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nenhuma auditoria executada nesta sessão</AlertTitle>
          <AlertDescription>Clique em “Rodar auditoria” para validar o site e todos os produtos ativos.</AlertDescription>
        </Alert>
      )}

      {site && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Infraestrutura de indexação</CardTitle>
            <CardDescription>Sitemap, robots.txt, canonical e envio ao Google Search Console.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {site.checks.map((c) => (
              <div key={c.name} className="flex items-start gap-3 rounded-lg border p-3">
                {c.ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  : c.severity === 'error'
                    ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{CHECK_LABELS[c.name] ?? c.name}</p>
                  <p className="break-words text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {feed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feed do Google Merchant</CardTitle>
            <CardDescription>
              {feed.items.length === 0
                ? `Feed validado: ${feed.summary.items} itens sem pendências, pronto para enviar nos anúncios.`
                : `${feed.items.length} de ${feed.summary.items} itens do feed precisam de ajuste antes do envio.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Rss className="h-3.5 w-3.5" />
              <span className="break-all">{feed.feed_url}</span>
              <Button variant="ghost" size="sm" className="ml-auto h-8" asChild>
                <a href={feed.feed_url} target="_blank" rel="noreferrer">
                  Abrir feed <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
            {feed.upload_allowed === false && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Envio bloqueado</AlertTitle>
                <AlertDescription>
                  {feed.summary.blocked} item(ns) com erro — {feed.summary.missing_images} produto(s) têm menos de 2
                  imagens HTTPS. Corrija antes de enviar o feed ao Merchant Center.
                </AlertDescription>
              </Alert>
            )}
            {feed.upload_allowed === true && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Feed liberado para envio</AlertTitle>
                <AlertDescription>
                  {feed.summary.ready_to_upload} de {feed.summary.items} itens aprovados, todos com pelo menos 2 imagens HTTPS.
                </AlertDescription>
              </Alert>
            )}

            {feed.diff && (
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <GitCompare className="h-4 w-4 text-primary" /> Mudanças desde a última validação
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {feed.diff.previous_at
                    ? `Comparado com ${new Date(feed.diff.previous_at).toLocaleString('pt-BR')}`
                    : 'Primeira validação registrada — nada a comparar.'}
                </p>
                {feed.diff.previous_at && feed.diff.unchanged && (
                  <p className="mt-2 text-xs text-muted-foreground">Nenhuma alteração no feed.</p>
                )}
                {(feed.diff.added.length > 0 || feed.diff.removed.length > 0 || feed.diff.changed.length > 0) && (
                  <div className="mt-2 space-y-1 text-xs">
                    {feed.diff.added.map((t) => (
                      <p key={`a-${t}`} className="text-primary">+ novo item: {t}</p>
                    ))}
                    {feed.diff.removed.map((t) => (
                      <p key={`r-${t}`} className="text-destructive">− removido do feed: {t}</p>
                    ))}
                    {feed.diff.changed.map((c) => (
                      <p key={`c-${c.id}`} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{c.title}</span>: {c.fields.join(' · ')}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {feed.items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{item.title || item.id}</span>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      ver PDP <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.issues.map((i) => (
                    <Badge key={i.code} variant={i.severity === 'error' ? 'destructive' : 'secondary'} className="font-normal">
                      {i.detail}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <SeoForceActionsPanel />

      <SeoIndexAuditPanel />

      <SeoGscCoveragePanel />

      <SeoGscTrendsPanel />

      <SeoBingPanel />

      <SeoImageQualityPanel />

      <SeoTitleFixPanel />

      <SeoJsonLdPanel />

      <SeoHubJsonLdPanel />

      <SeoWebVitalsPanel />

      <SeoDailyGuardPanel />

      <SeoCrawlerProbePanel />

      <SeoSubmissionLogPanel onResend={pingCrawlers} resending={pinging} />

      <SeoAlertLogPanel />


      {products && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produtos com pendências</CardTitle>
            <CardDescription>
              {products.products.length === 0
                ? 'Todos os produtos ativos estão completos para rich results e Merchant Center.'
                : `${products.products.length} de ${products.summary.products} produtos precisam de ajuste.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {products.products.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    ver PDP <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.issues.map((i) => (
                    <Badge key={i.code} variant={i.severity === 'error' ? 'destructive' : 'secondary'} className="font-normal">
                      {i.detail}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, tone }: { label: string; value: number | string; tone: 'ok' | 'warn' | 'error' }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'error' ? 'text-2xl font-semibold text-destructive'
            : tone === 'warn' ? 'text-2xl font-semibold text-amber-500'
              : 'text-2xl font-semibold text-primary'
        }
      >
        {value}
      </p>
    </CardContent>
  </Card>
);

export default AdminSeoCheck;
