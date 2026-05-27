import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Globe, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Loader2,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Search,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSEOConfig } from '@/hooks/useStoreSettings';
import { urls as urlBuilders } from '@/lib/urls';

interface SEOStats {
  totalProducts: number;
  activeProducts: number;
  totalOccasions: number;
  totalCategories: number;
  lastSitemapUpdate: string | null;
  sitemapUrlCount: number;
}

interface IndexationCheck {
  url: string;
  status: 'indexed' | 'not_indexed' | 'pending' | 'error';
  lastChecked?: string;
}

const AdminSEOReport = () => {
  const [loading, setLoading] = useState(true);
  const [submittingSitemap, setSubmittingSitemap] = useState(false);
  const [stats, setStats] = useState<SEOStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalOccasions: 0,
    totalCategories: 0,
    lastSitemapUpdate: null,
    sitemapUrlCount: 0,
  });
  const [sampleUrls, setSampleUrls] = useState<IndexationCheck[]>([]);
  const { toast } = useToast();
  const { data: seoConfig } = useSEOConfig();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch products count
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      const { count: activeProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch occasions count
      const { count: totalOccasions } = await supabase
        .from('occasions')
        .select('*', { count: 'exact', head: true });

      // Fetch categories count
      const { count: totalCategories } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });

      // Fetch last sitemap update
      const { data: sitemapData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'last_sitemap_update')
        .single();

      // Fetch sample products for indexation check
      const { data: sampleProducts } = await supabase
        .from('products')
        .select('slug, name')
        .eq('is_active', true)
        .limit(5);

      const siteUrl = seoConfig?.canonical_url || 'https://emporiolelecute.com.br';
      
      // Create sample URLs for display
      const urls: IndexationCheck[] = [
        { url: siteUrl, status: 'pending' },
        { url: `${siteUrl}/produtos`, status: 'pending' },
        ...(sampleProducts?.map(p => ({
          url: urlBuilders.productAbsolute(p.slug, siteUrl),
          status: 'pending' as const,
        })) || []),
      ];

      setSampleUrls(urls);
      setStats({
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        totalOccasions: totalOccasions || 0,
        totalCategories: totalCategories || 0,
        lastSitemapUpdate: sitemapData?.value as string || null,
        sitemapUrlCount: (activeProducts || 0) + (totalOccasions || 0) + 10,
      });
    } catch (error) {
      console.error('Error fetching SEO stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSitemap = async () => {
    setSubmittingSitemap(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-sitemap');

      if (error) throw error;

      toast({
        title: "Sitemap enviado!",
        description: "O sitemap foi submetido ao Google Search Console com sucesso.",
      });
    } catch (error) {
      console.error('Error submitting sitemap:', error);
      toast({
        title: "Erro ao enviar sitemap",
        description: "Configure as credenciais do Google Search Console nas configurações.",
        variant: "destructive",
      });
    } finally {
      setSubmittingSitemap(false);
    }
  };

  const seoScore = Math.round(
    ((seoConfig?.site_title ? 15 : 0) +
    (seoConfig?.site_description ? 15 : 0) +
    (seoConfig?.site_keywords ? 10 : 0) +
    (seoConfig?.og_image ? 15 : 0) +
    (seoConfig?.google_verification ? 15 : 0) +
    (seoConfig?.canonical_url ? 15 : 0) +
    (stats.lastSitemapUpdate ? 15 : 0))
  );

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
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Relatório SEO</span>
          </div>
          <h1 className="text-4xl font-display font-semibold text-foreground">Análise de SEO</h1>
          <p className="text-muted-foreground mt-2">Visão geral do status de SEO e indexação</p>
        </div>
        <Button 
          onClick={handleSubmitSitemap}
          disabled={submittingSitemap}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {submittingSitemap ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Globe className="w-4 h-4 mr-2" />
          )}
          Enviar Sitemap ao Google
        </Button>
      </div>

      {/* SEO Score */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">Pontuação SEO</h3>
              <p className="text-muted-foreground">Baseado nas configurações atuais</p>
            </div>
            <div className="text-right">
              <span className={`text-4xl font-bold ${seoScore >= 70 ? 'text-green-500' : seoScore >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                {seoScore}%
              </span>
            </div>
          </div>
          <Progress value={seoScore} className="h-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="flex items-center gap-2">
              {seoConfig?.site_title ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Título</span>
            </div>
            <div className="flex items-center gap-2">
              {seoConfig?.site_description ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Descrição</span>
            </div>
            <div className="flex items-center gap-2">
              {seoConfig?.google_verification ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Google Verificado</span>
            </div>
            <div className="flex items-center gap-2">
              {stats.lastSitemapUpdate ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">Sitemap</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Stats Cards */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Produtos Ativos</p>
                <p className="text-3xl font-bold">{stats.activeProducts}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              de {stats.totalProducts} total
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">URLs no Sitemap</p>
                <p className="text-3xl font-bold">{stats.sitemapUrlCount}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-full">
                <LinkIcon className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Páginas indexáveis
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ocasiões</p>
                <p className="text-3xl font-bold">{stats.totalOccasions}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Páginas de ocasião
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categorias</p>
                <p className="text-3xl font-bold">{stats.totalCategories}</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-full">
                <Search className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Páginas de categoria
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sitemap Status */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Status do Sitemap
            </CardTitle>
            <CardDescription>Informações sobre o sitemap atual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Última Atualização</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.lastSitemapUpdate 
                      ? new Date(stats.lastSitemapUpdate).toLocaleString('pt-BR')
                      : 'Nunca atualizado'}
                  </p>
                </div>
              </div>
              {stats.lastSitemapUpdate && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Total de URLs</p>
                  <p className="text-sm text-muted-foreground">{stats.sitemapUrlCount} páginas</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <a 
                href="https://xfqffqxqiuqauefrrcxn.supabase.co/functions/v1/generate-sitemap" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Sitemap
                </Button>
              </a>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/admin/seo'}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Gerar Novo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* URLs Sample */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" />
              URLs Principais
            </CardTitle>
            <CardDescription>Exemplo de URLs no sitemap</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sampleUrls.slice(0, 6).map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{item.url}</span>
                  </div>
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SEO Checklist */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Checklist de SEO
            </CardTitle>
            <CardDescription>Recomendações para melhorar seu SEO</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${seoConfig?.site_title ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}>
                <div className="flex items-start gap-3">
                  {seoConfig?.site_title ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">Título do Site</p>
                    <p className="text-sm text-muted-foreground">
                      {seoConfig?.site_title 
                        ? `${seoConfig.site_title.length}/60 caracteres`
                        : 'Configure um título para o site'}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${seoConfig?.site_description ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}>
                <div className="flex items-start gap-3">
                  {seoConfig?.site_description ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">Meta Description</p>
                    <p className="text-sm text-muted-foreground">
                      {seoConfig?.site_description 
                        ? `${seoConfig.site_description.length}/160 caracteres`
                        : 'Adicione uma descrição para buscadores'}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${seoConfig?.google_verification ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'}`}>
                <div className="flex items-start gap-3">
                  {seoConfig?.google_verification ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">Google Search Console</p>
                    <p className="text-sm text-muted-foreground">
                      {seoConfig?.google_verification 
                        ? 'Verificação configurada'
                        : 'Recomendado para indexação'}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${stats.lastSitemapUpdate ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}>
                <div className="flex items-start gap-3">
                  {stats.lastSitemapUpdate ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">Sitemap Atualizado</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.lastSitemapUpdate 
                        ? 'Sitemap gerado recentemente'
                        : 'Gere o sitemap para indexação'}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${seoConfig?.og_image ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'}`}>
                <div className="flex items-start gap-3">
                  {seoConfig?.og_image ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">Imagem Open Graph</p>
                    <p className="text-sm text-muted-foreground">
                      {seoConfig?.og_image 
                        ? 'Imagem configurada para redes sociais'
                        : 'Adicione uma imagem para compartilhamento'}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${seoConfig?.canonical_url ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}>
                <div className="flex items-start gap-3">
                  {seoConfig?.canonical_url ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">URL Canônica</p>
                    <p className="text-sm text-muted-foreground">
                      {seoConfig?.canonical_url 
                        ? seoConfig.canonical_url
                        : 'Configure a URL principal do site'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Keywords Analysis */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Análise de Palavras-chave
            </CardTitle>
            <CardDescription>Sugestões de otimização baseadas nos seus produtos</CardDescription>
          </CardHeader>
          <CardContent>
            <KeywordsAnalysis />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Keywords Analysis Component
const KeywordsAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState<{ keyword: string; count: number; products: string[] }[]>([]);

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    try {
      const { data: products } = await supabase
        .from('products')
        .select('name, keywords, description')
        .eq('is_active', true);

      if (products) {
        // Extract and count keywords
        const keywordMap = new Map<string, { count: number; products: string[] }>();
        
        products.forEach(product => {
          // Get keywords from product keywords array
          const productKeywords = product.keywords || [];
          
          // Also extract keywords from product name
          const nameWords = product.name.toLowerCase().split(' ').filter(w => w.length > 3);
          
          [...productKeywords, ...nameWords].forEach(keyword => {
            const normalizedKeyword = keyword.toLowerCase().trim();
            if (normalizedKeyword.length > 2) {
              const existing = keywordMap.get(normalizedKeyword);
              if (existing) {
                existing.count++;
                if (!existing.products.includes(product.name)) {
                  existing.products.push(product.name);
                }
              } else {
                keywordMap.set(normalizedKeyword, { count: 1, products: [product.name] });
              }
            }
          });
        });

        // Convert to array and sort by count
        const sortedKeywords = Array.from(keywordMap.entries())
          .map(([keyword, data]) => ({ keyword, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);

        setKeywords(sortedKeywords);
      }
    } catch (error) {
      console.error('Error fetching keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const topKeywords = keywords.slice(0, 10);
  const suggestedKeywords = [
    'lembrancinha personalizada',
    'sabonete artesanal',
    'vela perfumada',
    'chá de bebê',
    'maternidade',
    'batizado',
    'casamento',
    'aniversário',
    'presente personalizado',
    'lembrancinha maternidade',
  ];

  const missingKeywords = suggestedKeywords.filter(
    sk => !keywords.some(k => k.keyword.includes(sk) || sk.includes(k.keyword))
  );

  return (
    <div className="space-y-6">
      {/* Current Top Keywords */}
      <div>
        <h4 className="font-medium mb-3">Palavras-chave mais usadas nos produtos</h4>
        <div className="flex flex-wrap gap-2">
          {topKeywords.map((kw, index) => (
            <span 
              key={index}
              className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
            >
              {kw.keyword}
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {kw.count}
              </span>
            </span>
          ))}
          {topKeywords.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma palavra-chave encontrada nos produtos</p>
          )}
        </div>
      </div>

      {/* Suggested Keywords */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          Palavras-chave sugeridas para adicionar
        </h4>
        <div className="flex flex-wrap gap-2">
          {missingKeywords.map((kw, index) => (
            <span 
              key={index}
              className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 rounded-full text-sm"
            >
              + {kw}
            </span>
          ))}
          {missingKeywords.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Todas as palavras-chave sugeridas estão sendo usadas!
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Dicas de SEO</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• Adicione palavras-chave relevantes ao nome e descrição dos produtos</li>
          <li>• Use variações das palavras-chave principais (ex: "sabonete artesanal", "sabonetes artesanais")</li>
          <li>• Inclua termos de busca locais (ex: "São José dos Pinhais", "Curitiba")</li>
          <li>• Mantenha o sitemap atualizado após adicionar novos produtos</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminSEOReport;
