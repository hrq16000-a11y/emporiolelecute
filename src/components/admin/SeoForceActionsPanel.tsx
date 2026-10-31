import { useState } from 'react';
import { Loader2, Zap, RefreshCw, Rss, Send, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type ActionKey = 'sitemap' | 'merchant' | 'indexnow';

interface RunEntry {
  key: ActionKey;
  label: string;
  ok: boolean;
  duration_ms: number;
  ran_at: string;
  summary: string;
  diff: string[];
}

const ACTIONS: Record<ActionKey, { label: string; fn: string; body: Record<string, unknown> }> = {
  sitemap: { label: 'Regerar sitemap', fn: 'generate-sitemap', body: { force: true, source: 'admin-seo-check' } },
  merchant: { label: 'Revalidar + reenviar Merchant feed', fn: 'merchant-feed-audit', body: { force: true } },
  indexnow: { label: 'Reenviar IndexNow / Google / Bing', fn: 'seo-sitemap-auto-resubmit', body: { force: true, reason: 'admin-manual' } },
};

function describe(key: ActionKey, data: unknown): { summary: string; diff: string[] } {
  const d = (data ?? {}) as Record<string, any>;
  if (key === 'sitemap') {
    const counts = d.counts ?? d.summary ?? {};
    const total = d.urls ?? d.total_urls ?? counts.total ?? '—';
    return {
      summary: `${total} URLs no sitemap`,
      diff: Object.entries(counts).map(([k, v]) => `${k}: ${v}`),
    };
  }
  if (key === 'merchant') {
    const s = d.summary ?? {};
    const diff = d.diff ?? {};
    const lines: string[] = [];
    (diff.added ?? []).forEach((t: string) => lines.push(`+ ${t}`));
    (diff.removed ?? []).forEach((t: string) => lines.push(`− ${t}`));
    (diff.changed ?? []).forEach((c: { title: string; fields: string[] }) => lines.push(`~ ${c.title}: ${c.fields.join(', ')}`));
    if (diff.unchanged) lines.push('Nenhuma alteração desde a última validação');
    return { summary: `${s.ready_to_upload ?? 0}/${s.items ?? 0} itens liberados · ${s.errors ?? 0} erro(s)`, diff: lines };
  }
  const idx = d.indexnow ?? {};
  const lines: string[] = [];
  if (d.google) lines.push(`Google: ${d.google.status ?? d.google.ok}`);
  if (d.bing) lines.push(`Bing: ${d.bing.status ?? d.bing.ok}`);
  if (idx.status) lines.push(`IndexNow: HTTP ${idx.status}`);
  return { summary: idx.sent ? `${idx.urls ?? 0} URLs enviadas ao IndexNow` : 'IndexNow não enviado', diff: lines };
}

const SeoForceActionsPanel = () => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [runs, setRuns] = useState<RunEntry[]>([]);

  const run = async (key: ActionKey) => {
    const action = ACTIONS[key];
    setBusy(key);
    const started = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke(action.fn, { body: action.body });
      if (error) throw error;
      const { summary, diff } = describe(key, data);
      const entry: RunEntry = {
        key, label: action.label, ok: true,
        duration_ms: Math.round(performance.now() - started),
        ran_at: new Date().toISOString(), summary, diff,
      };
      setRuns((prev) => [entry, ...prev].slice(0, 12));
      toast({ title: action.label, description: `${summary} — ${entry.duration_ms} ms` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setRuns((prev) => [{
        key, label: action.label, ok: false,
        duration_ms: Math.round(performance.now() - started),
        ran_at: new Date().toISOString(), summary: msg, diff: [],
      }, ...prev].slice(0, 12));
      toast({ variant: 'destructive', title: `Falha: ${action.label}`, description: msg });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-primary" /> Ações sob demanda
        </CardTitle>
        <CardDescription>
          Força a regeneração do sitemap e o reenvio do Merchant feed e do IndexNow, registrando diff e tempo de execução.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => run('sitemap')} disabled={busy !== null}>
            {busy === 'sitemap' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Regerar sitemap
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => run('merchant')} disabled={busy !== null}>
            {busy === 'merchant' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rss className="mr-2 h-4 w-4" />}
            Reenviar Merchant feed
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => run('indexnow')} disabled={busy !== null}>
            {busy === 'indexnow' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Reenviar IndexNow
          </Button>
        </div>

        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma execução manual nesta sessão.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((r, i) => (
              <div key={`${r.ran_at}-${i}`} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {r.ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    {r.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">{r.duration_ms} ms</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.ran_at).toLocaleTimeString('pt-BR')}</span>
                  </div>
                </div>
                <p className="mt-1 break-words text-xs text-muted-foreground">{r.summary}</p>
                {r.diff.length > 0 && (
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {r.diff.map((d) => <p key={d} className="font-mono">{d}</p>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SeoForceActionsPanel;
