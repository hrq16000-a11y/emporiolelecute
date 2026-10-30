import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSEOConfig } from '@/hooks/useStoreSettings';
import { toast } from 'sonner';

interface Check { id: string; label: string; ok: boolean; detail: string }

/**
 * Bing Webmaster Tools + IndexNow.
 * Permite colar o token de verificação (`msvalidate.01`) e roda uma validação
 * server-side simulando o bingbot: meta tag, chave do IndexNow, sitemap e robots.
 */
const SeoBingPanel = () => {
  const { data: seoConfig } = useSEOConfig();
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);

  useEffect(() => {
    if (seoConfig?.bing_verification) setToken(seoConfig.bing_verification);
  }, [seoConfig?.bing_verification]);

  const saveToken = async () => {
    const clean = token.trim();
    if (clean && !/^[A-Za-z0-9_-]{8,120}$/.test(clean)) {
      toast.error('Token inválido. Cole apenas o valor do atributo content da meta tag do Bing.');
      return;
    }
    setSaving(true);
    try {
      const { data: current } = await supabase
        .from('store_settings').select('value').eq('key', 'seo_config').maybeSingle();
      const value = { ...((current?.value as Record<string, unknown>) ?? {}), bing_verification: clean };
      const { error } = await supabase
        .from('store_settings')
        .upsert({ key: 'seo_config', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['seo_config'] });
      toast.success('Token do Bing salvo. Publique o site para que a meta tag apareça no HTML.');
    } catch (e) {
      toast.error('Não foi possível salvar o token.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const validate = async () => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-bing-verify', { body: {} });
      if (error) throw error;
      const result = data as { all_ok: boolean; checks: Check[] };
      setChecks(result.checks ?? []);
      if (result.all_ok) toast.success('Bing e IndexNow validados com sucesso.');
      else toast.warning('A validação encontrou pendências. Veja os detalhes abaixo.');
    } catch (e) {
      toast.error('Falha ao validar a integração com o Bing.', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" /> Bing Webmaster & IndexNow
        </CardTitle>
        <CardDescription>
          Cole aqui o token de verificação do Bing Webmaster Tools e valide, em um clique, se o
          bingbot enxerga a meta tag, a chave do IndexNow, o sitemap e o robots.txt.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="bing-token">Token de verificação (msvalidate.01)</Label>
            <Input
              id="bing-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Ex.: 1A2B3C4D5E6F7G8H9I0J"
              className="min-h-11 font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveToken} disabled={saving} className="min-h-11">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={validate} disabled={validating} className="min-h-11">
              {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Validar
            </Button>
          </div>
        </div>

        {checks && (
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                {c.ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <div>
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SeoBingPanel;
