import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const WORKER_CODE = `// worker.js — Cloudflare Worker
const ROBOTS_ORIGIN = "https://xfqffqxqiuqauefrrcxn.supabase.co/functions/v1/robots-txt";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/robots.txt") {
      const upstream = await fetch(ROBOTS_ORIGIN, {
        cf: { cacheTtl: 300, cacheEverything: true },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=300",
          "x-robots-source": "lovable-edge-function",
        },
      });
    }
    // Todo o resto segue para o site (SPA Lovable)
    return fetch(request);
  },
};`;

const ROUTES = ['emporiolelecute.com.br/robots.txt', 'www.emporiolelecute.com.br/robots.txt'];

export default function AdminCloudflareGuide() {
  const [copied, setCopied] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; status: number; source?: string; body?: string } | null>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(WORKER_CODE);
    setCopied(true);
    toast.success('Worker copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const validate = async () => {
    setValidating(true);
    setResult(null);
    try {
      const r = await fetch('https://emporiolelecute.com.br/robots.txt', { cache: 'no-store' });
      const body = await r.text();
      setResult({ ok: r.ok, status: r.status, source: r.headers.get('x-robots-source') ?? undefined, body });
    } catch (e) {
      setResult({ ok: false, status: 0, body: String(e) });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display">Cloudflare Worker — robots.txt</h1>
        <p className="text-muted-foreground mt-1">Guia passo a passo para servir o robots.txt dinâmico no domínio raiz sem quebrar a SPA.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Confirmar Cloudflare como proxy</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>No DNS Cloudflare, os registros A de <code>emporiolelecute.com.br</code> e <code>www</code> precisam estar com a <strong>nuvem laranja</strong> (proxied).</p>
          <p>No painel Lovable de domínio, marque <em>"Domain uses Cloudflare or a similar proxy"</em>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">2. Cole este Worker
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </CardTitle>
          <CardDescription>Em Cloudflare → Workers & Pages → Create → Hello world. Substitua o conteúdo e Deploy.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto"><code>{WORKER_CODE}</code></pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Adicionar Routes</CardTitle>
          <CardDescription>Workers & Pages → seu Worker → Triggers → Add Route. Adicione cada uma:</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1">
            {ROUTES.map(r => <li key={r}><code className="bg-muted px-2 py-1 rounded">{r}</code></li>)}
          </ul>
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Importante: a rota é apenas <code>/robots.txt</code>. O resto do tráfego segue para o Lovable normalmente — a SPA não quebra.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">4. Validar
            <Button size="sm" onClick={validate} disabled={validating}>{validating ? 'Validando...' : 'Validar agora'}</Button>
          </CardTitle>
          <CardDescription>Faz fetch de <code>https://emporiolelecute.com.br/robots.txt</code> e confere o header <code>x-robots-source</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result && (
            <>
              <div className="flex gap-2 items-center">
                <Badge variant={result.ok ? 'default' : 'destructive'}>HTTP {result.status}</Badge>
                {result.source === 'lovable-edge-function' ? (
                  <Badge variant="default">✓ Worker ativo (x-robots-source: {result.source})</Badge>
                ) : (
                  <Badge variant="secondary">x-robots-source: {result.source ?? '(ausente — Worker ainda não está em rota)'}</Badge>
                )}
              </div>
              {result.body && (
                <pre className="bg-muted p-3 rounded text-xs max-h-64 overflow-auto"><code>{result.body}</code></pre>
              )}
            </>
          )}
          <a href="https://dash.cloudflare.com/?to=/:account/workers" target="_blank" rel="noreferrer"
             className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
            Abrir Cloudflare Workers <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
