import { useState, useEffect } from 'react';
import { 
  Rss, Save, Loader2, RefreshCw, ExternalLink, CheckCircle2, 
  AlertCircle, Globe, Truck, Tag, FileText, Copy, Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import StickySaveBar from '@/components/admin/StickySaveBar';

interface MerchantFeedConfig {
  google_product_category: string;
  google_product_category_id: string;
  shipping_country: string;
  shipping_price: number;
  shipping_service: string;
  currency: string;
  language: string;
  tax_included: boolean;
}

interface SitemapSubmission {
  submitted_at: string;
  google_status: string;
  bing_status: string;
  yandex_status?: string;
  sitemap_url: string;
}

const defaultFeedConfig: MerchantFeedConfig = {
  google_product_category: 'Arts & Entertainment > Party & Celebration > Gift Giving > Party Favors',
  google_product_category_id: '5709',
  shipping_country: 'BR',
  shipping_price: 0,
  shipping_service: 'Standard',
  currency: 'BRL',
  language: 'pt-BR',
  tax_included: true,
};

const GOOGLE_CATEGORIES = [
  { id: '5709', name: 'Arts & Entertainment > Party & Celebration > Gift Giving > Party Favors' },
  { id: '5710', name: 'Arts & Entertainment > Party & Celebration > Party Supplies' },
  { id: '531', name: 'Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Craft Supplies' },
  { id: '988', name: 'Home & Garden > Decor > Home Fragrances > Candles' },
  { id: '2719', name: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Bar Soap' },
];

const FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-feed`;

const AdminMerchantFeed = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingSitemap, setSubmittingSitemap] = useState(false);
  const [feedConfig, setFeedConfig] = useState<MerchantFeedConfig>(defaultFeedConfig);
  const [lastSubmission, setLastSubmission] = useState<SitemapSubmission | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [copiedUrl, setCopiedUrl] = useState<'xml' | 'json' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch feed config
      const { data: configData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'merchant_feed_config')
        .single();

      if (configData?.value) {
        setFeedConfig({ ...defaultFeedConfig, ...(configData.value as Partial<MerchantFeedConfig>) });
      }

      // Fetch last sitemap submission
      const { data: submissionData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'last_sitemap_submission')
        .single();

      if (submissionData?.value) {
        setLastSubmission(submissionData.value as unknown as SitemapSubmission);
      }

      // Count active products
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('price', 0);

      setProductCount(count || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('store_settings')
        .upsert([{
          key: 'merchant_feed_config',
          value: feedConfig as any,
          updated_at: new Date().toISOString(),
        }], {
          onConflict: 'key'
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: "As configurações do feed foram atualizadas.",
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitSitemap = async () => {
    setSubmittingSitemap(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-sitemap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setLastSubmission(result.results);
        toast({
          title: "Sitemap submetido!",
          description: "O sitemap foi enviado para Google, Bing e Yandex.",
        });
      } else {
        throw new Error(result.error || 'Falha ao submeter sitemap');
      }
    } catch (error) {
      console.error('Error submitting sitemap:', error);
      toast({
        title: "Erro ao submeter",
        description: "Não foi possível submeter o sitemap.",
        variant: "destructive",
      });
    } finally {
      setSubmittingSitemap(false);
    }
  };

  const copyToClipboard = async (url: string, type: 'xml' | 'json') => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(type);
    setTimeout(() => setCopiedUrl(null), 2000);
    toast({
      title: "URL copiada!",
      description: "A URL do feed foi copiada para a área de transferência.",
    });
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = GOOGLE_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      setFeedConfig({
        ...feedConfig,
        google_product_category_id: categoryId,
        google_product_category: category.name,
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Rss className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Google Merchant</span>
          </div>
          <h1 className="text-4xl font-display font-semibold text-foreground">Feed de Produtos</h1>
          <p className="text-muted-foreground mt-2">
            Configure o feed para Google Merchant Center e Google Ads
          </p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary-dark text-primary-foreground"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>

      {/* Feed Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produtos no Feed</p>
                <p className="text-3xl font-bold text-foreground">{productCount}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Tag className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status do Feed</p>
                <p className="text-lg font-semibold text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Ativo
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <Rss className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Última Submissão</p>
                <p className="text-sm font-medium text-foreground">
                  {lastSubmission?.submitted_at 
                    ? new Date(lastSubmission.submitted_at).toLocaleString('pt-BR')
                    : 'Nunca'}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feed URLs */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            URLs do Feed
          </CardTitle>
          <CardDescription>
            Use estas URLs para configurar o feed no Google Merchant Center
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Como usar</AlertTitle>
            <AlertDescription>
              No Google Merchant Center, vá em "Produtos" → "Feeds" → "Adicionar feed" → "Buscar arquivo do URL"
              e cole a URL XML abaixo.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">Feed XML (Recomendado)</Label>
              <div className="flex gap-2">
                <Input 
                  value={FEED_URL}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(FEED_URL, 'xml')}
                >
                  {copiedUrl === 'xml' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => window.open(FEED_URL, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Feed JSON (Alternativo)</Label>
              <div className="flex gap-2">
                <Input 
                  value={`${FEED_URL}?format=json`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(`${FEED_URL}?format=json`, 'json')}
                >
                  {copiedUrl === 'json' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => window.open(`${FEED_URL}?format=json`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Google Category Config */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Categoria Google
            </CardTitle>
            <CardDescription>
              Categoria padrão para todos os produtos no Google Merchant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria Padrão</Label>
              <Select 
                value={feedConfig.google_product_category_id}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_CATEGORIES.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ID da Categoria: {feedConfig.google_product_category_id}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select 
                value={feedConfig.currency}
                onValueChange={(value) => setFeedConfig({ ...feedConfig, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL - Real Brasileiro</SelectItem>
                  <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select 
                value={feedConfig.language}
                onValueChange={(value) => setFeedConfig({ ...feedConfig, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Config */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Configurações de Frete
            </CardTitle>
            <CardDescription>
              Configurações de envio para o feed do Merchant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>País de Destino</Label>
              <Select 
                value={feedConfig.shipping_country}
                onValueChange={(value) => setFeedConfig({ ...feedConfig, shipping_country: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BR">Brasil</SelectItem>
                  <SelectItem value="PT">Portugal</SelectItem>
                  <SelectItem value="US">Estados Unidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor Padrão do Frete (R$)</Label>
              <Input 
                type="number"
                min="0"
                step="0.01"
                value={feedConfig.shipping_price}
                onChange={(e) => setFeedConfig({ 
                  ...feedConfig, 
                  shipping_price: parseFloat(e.target.value) || 0 
                })}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Use 0 para indicar que o frete é calculado separadamente
              </p>
            </div>

            <div className="space-y-2">
              <Label>Serviço de Envio</Label>
              <Input 
                value={feedConfig.shipping_service}
                onChange={(e) => setFeedConfig({ ...feedConfig, shipping_service: e.target.value })}
                placeholder="Standard"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Impostos Incluídos no Preço</Label>
                <p className="text-xs text-muted-foreground">Padrão para Brasil</p>
              </div>
              <Switch 
                checked={feedConfig.tax_included}
                onCheckedChange={(checked) => setFeedConfig({ ...feedConfig, tax_included: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sitemap Submission */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Submissão do Sitemap
          </CardTitle>
          <CardDescription>
            Envie o sitemap para os mecanismos de busca automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleSubmitSitemap}
              disabled={submittingSitemap}
              variant="outline"
            >
              {submittingSitemap ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Submeter Sitemap Agora
            </Button>
            <span className="text-sm text-muted-foreground">
              O sitemap é enviado automaticamente toda semana
            </span>
          </div>

          {lastSubmission && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Última Submissão</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">
                    {new Date(lastSubmission.submitted_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Google:</span>
                  <p className={`font-medium ${lastSubmission.google_status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {lastSubmission.google_status === 'success' ? '✅ Sucesso' : '❌ ' + lastSubmission.google_status}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bing:</span>
                  <p className={`font-medium ${lastSubmission.bing_status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {lastSubmission.bing_status === 'success' ? '✅ Sucesso' : '❌ ' + lastSubmission.bing_status}
                  </p>
                </div>
                {lastSubmission.yandex_status && (
                  <div>
                    <span className="text-muted-foreground">Yandex:</span>
                    <p className={`font-medium ${lastSubmission.yandex_status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {lastSubmission.yandex_status === 'success' ? '✅ Sucesso' : '❌ ' + lastSubmission.yandex_status}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <StickySaveBar saving={saving} onSave={handleSave} label="Salvar Configurações" />
    </div>

  );
};

export default AdminMerchantFeed;
