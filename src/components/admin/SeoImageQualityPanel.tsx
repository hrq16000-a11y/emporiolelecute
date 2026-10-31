import { useState } from 'react';
import { Loader2, ImageIcon, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ImageIssue { severity: 'error' | 'warn'; code: string; detail: string }
interface ImageReport {
  product_id: string; product_name: string; slug: string; image_url: string;
  status: number; content_type: string | null; bytes: number;
  modern_format: boolean; responsive: boolean; issues: ImageIssue[];
}
interface AltCheck { slug: string; url: string; images: number; with_alt: number; ok: boolean }
interface Payload {
  ran_at: string;
  summary: {
    products: number; images_checked: number; images_with_issues: number;
    errors: number; warnings: number; pdp_alt_ok: number; pdp_alt_total: number;
  };
  reports: ImageReport[];
  alt_checks: AltCheck[];
}

const SeoImageQualityPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Payload | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('seo-image-audit', { body: { limit: 15 } });
      if (error) throw error;
      setData(res as Payload);
      toast({ title: 'Qualidade de imagens auditada', description: 'WebP/AVIF, peso, HTTPS e alt verificados.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha na auditoria de imagens',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  const altProblems = data?.alt_checks.filter((a) => !a.ok) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5 text-primary" /> Qualidade de imagens (WebP/AVIF, peso e alt)
          </CardTitle>
          <CardDescription>
            Confere imagens reais em HTTPS, formato moderno servido pelo pipeline responsivo, compressão e alt preenchido nas PDPs.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={run} disabled={loading} className="min-h-11">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
          Testar imagens
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !data && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}

        {data && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Imagens verificadas" value={data.summary.images_checked} bad={false} />
              <Stat label="Com erro" value={data.summary.errors} bad={data.summary.errors > 0} />
              <Stat label="Com aviso" value={data.summary.warnings} bad={data.summary.warnings > 0} />
              <Stat
                label="PDPs com alt completo"
                value={`${data.summary.pdp_alt_ok}/${data.summary.pdp_alt_total}`}
                bad={data.summary.pdp_alt_ok < data.summary.pdp_alt_total}
              />
            </div>

            {data.reports.length === 0 && altProblems.length === 0 && (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Todas as imagens auditadas estão em HTTPS, servidas em formato moderno, dentro do limite de peso e com alt preenchido.
              </p>
            )}

            {data.reports.map((r) => (
              <div key={`${r.product_id}-${r.image_url}`} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.product_name}</span>
                  <a href={r.image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    ver imagem <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.content_type ?? 'sem content-type'} · {Math.round(r.bytes / 1024)} KB · {r.responsive ? 'pipeline responsivo' : 'fora do Storage'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.issues.map((i) => (
                    <Badge key={i.code} variant={i.severity === 'error' ? 'destructive' : 'secondary'} className="font-normal">
                      {i.detail}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            {altProblems.map((a) => (
              <div key={a.slug} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">/produtos/{a.slug}</span>
                  <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    ver PDP <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Badge variant="secondary" className="mt-2 font-normal">
                  alt preenchido em {a.with_alt} de {a.images} imagens
                </Badge>
              </div>
            ))}
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

export default SeoImageQualityPanel;
