import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Save, RefreshCw, Loader2, Globe, FileText, Tag, Mail, CheckCircle, ExternalLink, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import SingleImageUpload from '@/components/admin/SingleImageUpload';

interface SEOSettings {
  site_title: string;
  site_description: string;
  site_keywords: string;
  og_image: string;
  twitter_handle: string;
  google_verification: string;
  bing_verification: string;
  facebook_app_id: string;
  canonical_url: string;
  robots_txt: string;
  additional_meta_tags: string;
  structured_data_business: string;
  sitemap_notification_email: string;
}

const defaultSEOSettings: SEOSettings = {
  site_title: 'Empório LeleCute | Lembrancinhas Artesanais Personalizadas',
  site_description: 'Ateliê criativo de lembrancinhas artesanais personalizadas. Sabonetes, velas perfumadas e presentes únicos para todas as ocasiões especiais.',
  site_keywords: 'lembrancinhas personalizadas, sabonetes artesanais, velas perfumadas, maternidade, chá de bebê, batizado, casamento',
  og_image: 'https://emporiolelecute.com.br/og-image.webp',
  twitter_handle: '@emporiolelecute',
  google_verification: '',
  bing_verification: '',
  facebook_app_id: '',
  canonical_url: 'https://emporiolelecute.com.br',
  robots_txt: 'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://emporiolelecute.com.br/sitemap.xml',
  additional_meta_tags: '',
  structured_data_business: '',
  sitemap_notification_email: '',
};

const AdminSEO = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingSitemap, setGeneratingSitemap] = useState(false);
  const [lastSitemapUpdate, setLastSitemapUpdate] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<SEOSettings>(defaultSEOSettings);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('key', 'seo_config')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        setSettings({ ...defaultSEOSettings, ...(data.value as unknown as SEOSettings) });
      }

      // Fetch last sitemap update
      const { data: sitemapData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'last_sitemap_update')
        .single();

      if (sitemapData && typeof sitemapData.value === 'string') {
        setLastSitemapUpdate(sitemapData.value);
      }
    } catch (error) {
      console.error('Error fetching SEO settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First try to get existing record
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('key', 'seo_config')
        .single();

      const settingsJson = JSON.parse(JSON.stringify(settings));

      if (existing) {
        const { error } = await supabase
          .from('store_settings')
          .update({ value: settingsJson, updated_at: new Date().toISOString() })
          .eq('key', 'seo_config');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert([{ key: 'seo_config', value: settingsJson }]);
        if (error) throw error;
      }

      toast({
        title: "Configurações SEO salvas!",
        description: "As alterações foram aplicadas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving SEO settings:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSitemap = async () => {
    setGeneratingSitemap(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sitemap', {
        body: { 
          sendNotification: !!settings.sitemap_notification_email,
          notificationEmail: settings.sitemap_notification_email 
        }
      });

      if (error) throw error;

      // Update last sitemap update time
      const now = new Date().toISOString();
      await supabase
        .from('store_settings')
        .upsert({
          key: 'last_sitemap_update',
          value: now,
          updated_at: now,
        }, {
          onConflict: 'key'
        });

      setLastSitemapUpdate(now);

      toast({
        title: "Sitemap gerado com sucesso!",
        description: settings.sitemap_notification_email 
          ? "O sitemap foi atualizado e uma notificação foi enviada por email."
          : "O sitemap foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error('Error generating sitemap:', error);
      toast({
        title: "Erro ao gerar sitemap",
        description: "Não foi possível gerar o sitemap.",
        variant: "destructive",
      });
    } finally {
      setGeneratingSitemap(false);
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
            <Search className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">SEO & Sitemap</span>
          </div>
          <h1 className="text-4xl font-display font-semibold text-foreground">Configurações SEO</h1>
          <p className="text-muted-foreground mt-2">Gerencie tags, metadados e sitemap para o Google</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => navigate('/admin/seo/relatorio')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Ver Relatório
          </Button>
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
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sitemap Control */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Sitemap
            </CardTitle>
            <CardDescription>Gere e gerencie o sitemap do site para indexação do Google</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Button 
                onClick={handleGenerateSitemap}
                disabled={generatingSitemap}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {generatingSitemap ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Gerar Sitemap Agora
              </Button>
              
              <a 
                href="/sitemap.xml" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Ver Sitemap Atual
              </a>

              {lastSitemapUpdate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Última atualização: {new Date(lastSitemapUpdate).toLocaleString('pt-BR')}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email para Notificação de Atualização
                </Label>
                <Input 
                  type="email"
                  value={settings.sitemap_notification_email}
                  onChange={(e) => setSettings({
                    ...settings,
                    sitemap_notification_email: e.target.value
                  })}
                  placeholder="seu@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  Receba uma notificação por email sempre que o sitemap for atualizado (manual ou automaticamente)
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Atualização automática:</strong> O sitemap é gerado automaticamente todos os dias às 3h da manhã (horário de Brasília).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Basic Meta Tags */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Meta Tags Básicas
            </CardTitle>
            <CardDescription>Título e descrição do site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título do Site</Label>
              <Input 
                value={settings.site_title}
                onChange={(e) => setSettings({
                  ...settings,
                  site_title: e.target.value
                })}
                placeholder="Nome do Site | Descrição Curta"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                {settings.site_title.length}/60 caracteres (recomendado)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descrição do Site</Label>
              <Textarea 
                value={settings.site_description}
                onChange={(e) => setSettings({
                  ...settings,
                  site_description: e.target.value
                })}
                placeholder="Descrição detalhada do site..."
                rows={3}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                {settings.site_description.length}/160 caracteres (recomendado)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Palavras-chave</Label>
              <Textarea 
                value={settings.site_keywords}
                onChange={(e) => setSettings({
                  ...settings,
                  site_keywords: e.target.value
                })}
                placeholder="palavra1, palavra2, palavra3..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Separe as palavras-chave por vírgula
              </p>
            </div>

            <div className="space-y-2">
              <Label>URL Canônica</Label>
              <Input 
                value={settings.canonical_url}
                onChange={(e) => setSettings({
                  ...settings,
                  canonical_url: e.target.value
                })}
                placeholder="https://seusite.com.br"
              />
            </div>
          </CardContent>
        </Card>

        {/* Open Graph & Social */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Open Graph & Redes Sociais
            </CardTitle>
            <CardDescription>Como o site aparece quando compartilhado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Imagem OG (Open Graph)</Label>
              <SingleImageUpload
                value={settings.og_image}
                onChange={(url) => setSettings({ ...settings, og_image: url })}
                folder="og"
                hint="1200x630 recomendado · PNG, JPG ou WEBP até 5MB"
                previewMaxWidth={360}
              />
            </div>

            <div className="space-y-2">
              <Label>Twitter/X Handle</Label>
              <Input 
                value={settings.twitter_handle}
                onChange={(e) => setSettings({
                  ...settings,
                  twitter_handle: e.target.value
                })}
                placeholder="@seuhandle"
              />
            </div>

            <div className="space-y-2">
              <Label>Facebook App ID</Label>
              <Input 
                value={settings.facebook_app_id}
                onChange={(e) => setSettings({
                  ...settings,
                  facebook_app_id: e.target.value
                })}
                placeholder="123456789"
              />
            </div>
          </CardContent>
        </Card>

        {/* Search Console Verification */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Verificação de Propriedade
            </CardTitle>
            <CardDescription>Códigos de verificação dos buscadores</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Google Search Console</Label>
              <Input 
                value={settings.google_verification}
                onChange={(e) => setSettings({
                  ...settings,
                  google_verification: e.target.value
                })}
                placeholder="código de verificação do Google"
              />
              <p className="text-xs text-muted-foreground">
                Adicione apenas o conteúdo do atributo "content"
              </p>
            </div>

            <div className="space-y-2">
              <Label>Bing Webmaster Tools</Label>
              <Input 
                value={settings.bing_verification}
                onChange={(e) => setSettings({
                  ...settings,
                  bing_verification: e.target.value
                })}
                placeholder="código de verificação do Bing"
              />
            </div>
          </CardContent>
        </Card>

        {/* Advanced */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Configurações Avançadas
            </CardTitle>
            <CardDescription>robots.txt e meta tags adicionais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>robots.txt</Label>
              <Textarea 
                value={settings.robots_txt}
                onChange={(e) => setSettings({
                  ...settings,
                  robots_txt: e.target.value
                })}
                placeholder="User-agent: *
Allow: /
Disallow: /admin/"
                rows={5}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Meta Tags Adicionais</Label>
              <Textarea 
                value={settings.additional_meta_tags}
                onChange={(e) => setSettings({
                  ...settings,
                  additional_meta_tags: e.target.value
                })}
                placeholder='<meta name="custom" content="value">'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Adicione tags HTML personalizadas (uma por linha)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSEO;
