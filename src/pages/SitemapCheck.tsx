import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react";

const ALLOWED_HOSTS = [
  "emporiolelecute.com.br",
  "www.emporiolelecute.com.br",
];
const FORBIDDEN_HOST_PATTERNS = [
  "supabase.co",
  "supabase.in",
  "lovable.app",
  "lovable.dev",
];

interface CheckResult {
  total: number;
  allowed: number;
  forbiddenLocs: string[];
  externalLocs: string[];
  fetchedAt: string;
  sitemapUrl: string;
  rawSize: number;
}

const SitemapCheck = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  const sitemapUrl = `${window.location.origin}/sitemap.xml`;

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(sitemapUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`Falha ao buscar sitemap (${res.status})`);
      const xml = await res.text();
      const matches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());

      const forbiddenLocs: string[] = [];
      const externalLocs: string[] = [];
      let allowed = 0;
      for (const loc of matches) {
        try {
          const u = new URL(loc);
          const host = u.host.toLowerCase();
          if (FORBIDDEN_HOST_PATTERNS.some((p) => host.includes(p))) {
            forbiddenLocs.push(loc);
          } else if (ALLOWED_HOSTS.includes(host)) {
            allowed += 1;
          } else {
            externalLocs.push(loc);
          }
        } catch {
          forbiddenLocs.push(loc);
        }
      }

      setResult({
        total: matches.length,
        allowed,
        forbiddenLocs,
        externalLocs,
        fetchedAt: new Date().toLocaleString("pt-BR"),
        sitemapUrl,
        rawSize: xml.length,
      });
    } catch (e: any) {
      setError(e.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passed = result && result.forbiddenLocs.length === 0 && result.allowed > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <section className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl text-foreground mb-2">
            Verificação pública do sitemap.xml
          </h1>
          <p className="text-muted-foreground mb-8">
            Esta página inspeciona <code className="text-xs bg-muted px-1 py-0.5 rounded">{sitemapUrl}</code> e
            valida se todas as URLs apontam para o domínio oficial — sem links para Supabase,
            Lovable ou outros hosts.
          </p>

          {loading && (
            <Card className="p-4 sm:p-6 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Carregando sitemap…</span>
            </Card>
          )}

          {error && (
            <Card className="p-4 sm:p-6 border-destructive/40">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <XCircle className="h-5 w-5" /> Falha
              </div>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              <Card className={`p-6 ${passed ? "border-green-500/40" : "border-destructive/40"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {passed ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <h2 className="font-display text-xl m-0">Sitemap aprovado</h2>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-destructive" />
                      <h2 className="font-display text-xl m-0">Sitemap com problemas</h2>
                    </>
                  )}
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>URLs totais: <strong className="text-foreground">{result.total}</strong></li>
                  <li>URLs do domínio oficial: <strong className="text-foreground">{result.allowed}</strong></li>
                  <li>URLs proibidas (Supabase/Lovable): <strong className={result.forbiddenLocs.length ? "text-destructive" : "text-foreground"}>{result.forbiddenLocs.length}</strong></li>
                  <li>URLs externas (outros hosts): <strong className={result.externalLocs.length ? "text-amber-600" : "text-foreground"}>{result.externalLocs.length}</strong></li>
                  <li>Tamanho: {(result.rawSize / 1024).toFixed(1)} KB · verificado em {result.fetchedAt}</li>
                </ul>
              </Card>

              {result.forbiddenLocs.length > 0 && (
                <Card className="p-4 sm:p-6 border-destructive/40">
                  <h3 className="font-medium mb-2 text-destructive">URLs proibidas encontradas</h3>
                  <ul className="text-xs space-y-1 max-h-48 overflow-auto">
                    {result.forbiddenLocs.map((loc) => (
                      <li key={loc} className="font-mono break-all">{loc}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {result.externalLocs.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-medium mb-2">Hosts externos (não bloqueantes)</h3>
                  <ul className="text-xs space-y-1 max-h-48 overflow-auto">
                    {result.externalLocs.slice(0, 50).map((loc) => (
                      <li key={loc} className="font-mono break-all">{loc}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={run} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Reverificar
                </Button>
                <a href={sitemapUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" /> Abrir sitemap.xml
                  </Button>
                </a>
                <a
                  href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(window.location.origin + "/")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" /> Rich Results Test
                  </Button>
                </a>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default SitemapCheck;
