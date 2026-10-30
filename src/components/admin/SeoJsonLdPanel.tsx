import { useState } from 'react';
import { Braces, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FieldCheck { field: string; ok: boolean; expected: string; found: string }
interface PageReport { slug: string; name: string; url: string; ok: boolean; has_product_ld: boolean; checks: FieldCheck[] }
interface JsonLdPayload {
  ran_at: string;
  summary: { pages: number; valid: number; invalid: number; fields_checked: number };
  upload_allowed: boolean;
  pages: PageReport[];
}

interface Props {
  onResult?: (uploadAllowed: boolean) => void;
}

const SeoJsonLdPanel = ({ onResult }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<JsonLdPayload | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('seo-jsonld-audit', { body: { limit: 24 } });
      if (error) throw error;
      const payload = res as JsonLdPayload;
      setData(payload);
      onResult?.(payload.upload_allowed);
      toast({
        title: payload.upload_allowed ? 'JSON-LD íntegro' : 'Inconsistências no JSON-LD',
        description: `${payload.summary.valid}/${payload.summary.pages} páginas válidas`,
        variant: payload.upload_allowed ? 'default' : 'destructive',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Falha ao validar JSON-LD',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Braces className="h-5 w-5 text-primary" /> Validação de JSON-LD (schema.org)
          </CardTitle>
          <CardDescription>
            Lê o HTML renderizado para o Googlebot e confere name, description, image, price, availability e URL da oferta.
          </CardDescription>
        </div>
        <Button onClick={run} disabled={loading} variant="outline" className="min-h-11 shrink-0">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Braces className="mr-2 h-4 w-4" />}
          Validar schema
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data && !loading && (
          <p className="text-sm text-muted-foreground">Nenhuma validação executada nesta sessão.</p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={data.upload_allowed ? 'secondary' : 'destructive'}>
                {data.summary.valid}/{data.summary.pages} páginas válidas
              </Badge>
              <Badge variant="outline">{data.summary.fields_checked} campos verificados</Badge>
            </div>

            {!data.upload_allowed && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Envio bloqueado</AlertTitle>
                <AlertDescription>
                  {data.summary.invalid} página(s) com JSON-LD inconsistente. Corrija antes de enviar o feed
                  ou notificar os buscadores.
                </AlertDescription>
              </Alert>
            )}
            {data.upload_allowed && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Schema consistente</AlertTitle>
                <AlertDescription>Todos os campos conferem com os dados do catálogo.</AlertDescription>
              </Alert>
            )}

            {data.pages.map((p) => (
              <div key={p.slug} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {p.ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="text-sm font-medium">{p.name}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    ver PDP <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-2 space-y-1">
                  {p.checks.filter((c) => !c.ok).map((c) => (
                    <p key={c.field} className="text-xs text-destructive">
                      <span className="font-medium">{c.field}</span>: esperado “{c.expected}” · encontrado “{c.found}”
                    </p>
                  ))}
                  {p.ok && <p className="text-xs text-muted-foreground">Todos os campos corretos.</p>}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SeoJsonLdPanel;
