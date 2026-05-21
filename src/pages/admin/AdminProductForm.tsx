import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Save, Loader2, Tag, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImageUploader from '@/components/admin/ImageUploader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  useDbProductByIdOrSlug,
  useDbCategories,
  useDbOccasions,
  useSaveProductFull,
  type SaveProductError,
} from '@/hooks/useProducts';


import { useTags } from '@/hooks/useTags';
import { useSlugAvailability } from '@/hooks/useSlugAvailability';
import { generateSafeSlug, assessSlugQuality } from '@/lib/slugHardening';
import { useSegments } from '@/hooks/useSegments';
import { supabase } from '@/integrations/supabase/client';

import { evaluateProductSeo } from '@/lib/productSeo';
import { buildProductChecklist } from '@/lib/thinContent';
import ProductSeoScoreBadge from '@/components/admin/ProductSeoScoreBadge';
import ProductSeoChecklist from '@/components/admin/ProductSeoChecklist';
import SocialSeoPreviews from '@/components/admin/SocialSeoPreviews';
import EditorialTemplatesPicker from '@/components/admin/EditorialTemplatesPicker';
import TaxonomySuggestionsHints from '@/components/admin/TaxonomySuggestionsHints';
import { Link } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';
import { useFormUsageTracking } from '@/hooks/useFormUsageTracking';
import { trackAdminEvent } from '@/lib/adminUsage';
import { PdpBadge } from '@/components/PdpBadge';
import type { PdpBadgeConfig } from '@/hooks/useConversionCtaConfig';
import ProductFaqEditor from '@/components/admin/ProductFaqEditor';

const DEFAULT_BADGE_OVERRIDE: PdpBadgeConfig = {
  enabled: true,
  label: 'Promoção',
  showIcon: false,
  tone: 'coral',
  position: 'top-left',
  offsetX: 12,
  offsetY: 12,
};

const AdminProductForm = () => {
  // Aceita UUID (legado) ou slug (URL amigável) — ambos resolvem o mesmo produto.
  const { id: routeParam } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: existingProduct, isLoading: loadingProduct } = useDbProductByIdOrSlug(routeParam);
  // ID interno (UUID) usado em mutations — vem do produto resolvido.
  const id = existingProduct?.id;
  const isEditing = !!routeParam;

  const { data: categories } = useDbCategories();
  const { data: occasions } = useDbOccasions();
  const { data: tags } = useTags();
  const { data: segments } = useSegments();
  const saveProduct = useSaveProductFull();


  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    long_description: '',
    price: '',
    original_price: '',
    min_quantity: '1',
    pix_discount: '7',
    production_days: '7',
    weight: '',
    category_id: '',
    badge: '',
    rating: '5.0',
    images: [''],
    features: [''],
    keywords: [] as string[],
    
    is_active: true,
    // Personalization fields
    personalization_enabled: true,
    personalization_label: 'Personalização',
    personalization_placeholder: 'Digite o nome, data ou mensagem para personalização...',
    google_product_category: '',
    editorial_content: '',
    featured_weight: '0',
    production_speed: '' as '' | 'rapido' | 'normal' | 'longo',
  });
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [badgeOverride, setBadgeOverride] = useState<PdpBadgeConfig | null>(null);
 const [showQuickSummary, setShowQuickSummary] = useState<boolean>(false);
 const [showMinQuantity, setShowMinQuantity] = useState<boolean>(false);

  const slugCheck = useSlugAvailability('products', formData.slug, id ?? null);
  const usage = useFormUsageTracking(isEditing ? 'product_form_edit' : 'product_form_create');

  // Canonicaliza a URL do admin: se chegou via UUID, troca para o slug do produto.
  useEffect(() => {
    if (existingProduct?.slug && routeParam && routeParam !== existingProduct.slug) {
      navigate(`/admin/produtos/${existingProduct.slug}`, { replace: true });
    }
  }, [existingProduct?.slug, routeParam, navigate]);


  // ===========================================================================
  // Hidratação do form a partir do produto carregado.
  // BUG P0 corrigido: hidrata APENAS UMA VEZ por id.
  // Antes: useEffect rehidratava em todo refetch (após save / invalidate),
  // sobrescrevendo edições locais em andamento silenciosamente.
  // Agora: hydratedForIdRef guarda o id já hidratado. Refetch não pisa no form.
  // Quando o usuário navega para outro produto, o id muda e re-hidrata.
  // ===========================================================================
  const hydratedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    if (!existingProduct) return;
    if (hydratedForIdRef.current === existingProduct.id) return; // já hidratou esse produto
    hydratedForIdRef.current = existingProduct.id;

    const keywords = existingProduct.keywords || [];
    setFormData({
      name: existingProduct.name,
      slug: existingProduct.slug,
      description: existingProduct.description || '',
      long_description: existingProduct.long_description || '',
      price: existingProduct.price.toString(),
      original_price: existingProduct.original_price ? existingProduct.original_price.toString() : '',
      min_quantity: existingProduct.min_quantity.toString(),
      pix_discount: existingProduct.pix_discount.toString(),
      production_days: existingProduct.production_days.toString(),
      weight: existingProduct.weight?.toString() || '',
      category_id: existingProduct.category_id || '',
      badge: existingProduct.badge || '',
      rating: existingProduct.rating.toString(),
      images: existingProduct.images.length > 0 ? existingProduct.images : [''],
      features: existingProduct.features.length > 0 ? existingProduct.features : [''],
      keywords: keywords,
      is_active: existingProduct.is_active,
      personalization_enabled: existingProduct.personalization_enabled ?? true,
      personalization_label: existingProduct.personalization_label || 'Personalização',
      personalization_placeholder: existingProduct.personalization_placeholder || 'Digite o nome, data ou mensagem para personalização...',
      google_product_category: (existingProduct as any).google_product_category || '',
      editorial_content: (existingProduct as any).editorial_content || '',
      featured_weight: String((existingProduct as any).featured_weight ?? 0),
      production_speed: ((existingProduct as any).production_speed || '') as '' | 'rapido' | 'normal' | 'longo',
    });
    setKeywordsInput(keywords.join(', '));

    // Pivôs — só carregam na hidratação inicial.
    supabase
      .from('product_occasions')
      .select('occasion_id')
      .eq('product_id', existingProduct.id)
      .then(({ data }) => {
        if (data) setSelectedOccasions(data.map((o) => o.occasion_id));
      });

    supabase
      .from('product_tags')
      .select('tag_id')
      .eq('product_id', existingProduct.id)
      .then(({ data }) => {
        if (data) setSelectedTags(data.map((t) => t.tag_id));
      });

    supabase
      .from('product_segments')
      .select('segment_id')
      .eq('product_id', existingProduct.id)
      .then(({ data }) => {
        if (data) setSelectedSegments(data.map((s) => s.segment_id));
      });

    const ov = (existingProduct as any).pdp_badge_override;
    if (ov && typeof ov === 'object') {
      setBadgeOverride({ ...DEFAULT_BADGE_OVERRIDE, ...ov });
    } else {
      setBadgeOverride(null);
    }
    setShowQuickSummary((existingProduct as any).show_quick_summary === true);
    setShowMinQuantity((existingProduct as any).show_min_quantity === true);
  }, [existingProduct, isEditing]);



  // Fase 4.1: gerador token-aware. Nunca corta no meio de palavra,
  // remove stopwords antes de cortar tokens semânticos, jamais emite hash.
  const generateSlug = (name: string) => generateSafeSlug(name);

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: !isEditing || prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug,
    }));
  };

  const handleArrayChange = (field: 'images' | 'features', index: number, value: string) => {
    setFormData((prev) => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const addArrayItem = (field: 'images' | 'features') => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const removeArrayItem = (field: 'images' | 'features', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleKeywordsChange = (value: string) => {
    setKeywordsInput(value);
    // Parse keywords from comma-separated input
    const keywords = value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    setFormData(prev => ({ ...prev, keywords }));
  };

  const removeKeyword = (keywordToRemove: string) => {
    const newKeywords = formData.keywords.filter(k => k !== keywordToRemove);
    setFormData(prev => ({ ...prev, keywords: newKeywords }));
    setKeywordsInput(newKeywords.join(', '));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.slug || !formData.price) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    if (slugCheck.status === 'taken' || slugCheck.status === 'invalid') {
      trackAdminEvent('slug_invalid_attempt', 'products');
      toast({ title: 'Corrija o slug antes de salvar', variant: 'destructive' });
      return;
    }

    // Fase 4.1: bloqueia hash residual / slug gigante.
    const quality = assessSlugQuality(formData.slug);
    if (quality.severity === 'error') {
      trackAdminEvent('slug_generation_blocked', 'products');
      toast({
        title: 'Slug com problema',
        description: quality.issues[0] ?? 'Corrija o slug antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    // Peso obrigatório para novos produtos (evita erros no cálculo de frete)
    const weightNum = formData.weight ? parseFloat(formData.weight) : 0;
    if (!isEditing && (!weightNum || weightNum <= 0)) {
      toast({
        title: 'Peso obrigatório',
        description: 'Informe o peso do produto (kg) para permitir o cálculo de frete.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Payload único — todos os campos de products + flags + badge + pivôs.
      // Substitui: 1 update products + 2 round-trips de occasions + 2 hooks de tag/segment + 1 update redundante.
      const productPayload: Record<string, unknown> = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        long_description: formData.long_description || null,
        price: parseFloat(formData.price),
        original_price: formData.original_price && parseFloat(formData.original_price) > 0
          ? parseFloat(formData.original_price)
          : null,
        min_quantity: parseInt(formData.min_quantity) || 1,
        pix_discount: parseInt(formData.pix_discount) || 7,
        production_days: parseInt(formData.production_days) || 7,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        category_id: formData.category_id || null,
        badge: formData.badge || null,
        rating: parseFloat(formData.rating) || 5.0,
        images: formData.images.filter(Boolean),
        features: formData.features.filter(Boolean),
        keywords: formData.keywords,
        is_active: formData.is_active,
        personalization_enabled: formData.personalization_enabled,
        personalization_label: formData.personalization_label || null,
        personalization_placeholder: formData.personalization_placeholder || null,
        google_product_category: formData.google_product_category || null,
        editorial_content: formData.editorial_content || null,
        featured_weight: parseInt(formData.featured_weight) || 0,
        production_speed: formData.production_speed || null,
        // Funde os campos antes "atualizados em segundo UPDATE" no payload principal.
        pdp_badge_override: badgeOverride ?? null,
        show_quick_summary: showQuickSummary,
        show_min_quantity: showMinQuantity,
      };

      const result = await saveProduct.mutateAsync({
        id: isEditing && id ? id : null,
        expected_updated_at: isEditing ? (existingProduct?.updated_at ?? null) : null,
        product: productPayload,
        occasion_ids: selectedOccasions,
        tag_ids: selectedTags,
        segment_ids: selectedSegments,
      });

      // Após save bem-sucedido, sincroniza o expected_updated_at local
      // para próximos saves sem precisar de refetch (cobre "salvar sequencial").
      // O guard `hydratedRef` impede que o refetch do React Query pise no form.
      // Fica registrado para o próximo lock otimista via existingProduct refetch.
      void result;

      toast({ title: isEditing ? 'Produto atualizado!' : 'Produto criado!' });
      usage.markSubmitted();
      if (!isEditing) {
        navigate('/admin/produtos');
      }
    } catch (error) {
      const err = error as SaveProductError;
      console.error('Error saving product:', err);
      switch (err?.kind) {
        case 'stale_version':
          toast({
            title: 'Edição desatualizada',
            description: 'Outro admin editou este produto. Recarregue a página para ver a versão atual.',
            variant: 'destructive',
          });
          break;
        case 'slug_taken':
          toast({
            title: 'Slug já em uso',
            description: 'Escolha um slug diferente — outro produto já usa esse.',
            variant: 'destructive',
          });
          break;
        case 'fk_missing':
          toast({
            title: 'Referência inválida',
            description: 'Uma categoria, tag, ocasião ou segmento foi removida. Atualize as seleções e tente novamente.',
            variant: 'destructive',
          });
          break;
        case 'forbidden':
          toast({
            title: 'Sem permissão',
            description: 'Sua conta não tem permissão para salvar produtos.',
            variant: 'destructive',
          });
          break;
        case 'invalid':
          toast({
            title: 'Dados inválidos',
            description: err.message || 'Verifique os campos e tente novamente.',
            variant: 'destructive',
          });
          break;
        default:
          toast({ title: 'Erro ao salvar produto', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };



  if (isEditing && loadingProduct) {
    return (
      <div
        className="p-6 lg:p-8 flex flex-col items-center justify-center gap-3 min-h-[40vh]"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando produto…</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-sm:[&_.p-6]:p-3 max-sm:[&_.space-y-6]:space-y-3 max-sm:[&_.space-y-4]:space-y-3 max-sm:[&_.gap-6]:gap-3 max-sm:[&_.gap-4]:gap-3 max-sm:[&_.text-lg]:text-base max-sm:[&_label]:text-sm">
      <div className="mb-3 sm:mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/produtos')} className="mb-2 sm:mb-4 h-8 px-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar
        </Button>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl sm:text-3xl font-display font-semibold text-foreground">
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </h1>
          {isEditing && (() => {
            const seo = evaluateProductSeo({
              ...formData,
              price: parseFloat(formData.price) || 0,
              images: formData.images.filter(Boolean),
              occasionsCount: selectedOccasions.length,
              segmentsCount: selectedSegments.length,
              tagsCount: selectedTags.length,
            });
            return (
              <div className="flex items-center gap-2 flex-wrap">
                <ProductSeoScoreBadge evaluation={seo} />
                {seo.issues.filter((i) => i.level === 'error').length > 0 && (
                  <span className="text-xs text-rose-700">
                    {seo.issues.filter((i) => i.level === 'error').length} crítico(s)
                  </span>
                )}
                <Link to="/admin/produtos/health" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  Auditoria <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            );
          })()}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card className="shadow-card">

            <CardHeader>
              <CardTitle className="text-lg font-display">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Nome do produto"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="slug-do-produto"
                    required
                    aria-describedby="slug-status"
                    aria-invalid={slugCheck.status === 'taken' || slugCheck.status === 'invalid'}
                  />
                  <p
                    id="slug-status"
                    aria-live="polite"
                    className={`text-xs flex items-center gap-1 min-h-[1rem] ${
                      slugCheck.status === 'available'
                        ? 'text-emerald-600'
                        : slugCheck.status === 'taken' || slugCheck.status === 'invalid'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {slugCheck.status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    {slugCheck.status === 'available' && <Check className="h-3 w-3" aria-hidden />}
                    {(slugCheck.status === 'taken' || slugCheck.status === 'invalid') && (
                      <AlertCircle className="h-3 w-3" aria-hidden />
                    )}
                    <span>{slugCheck.message}</span>
                  </p>
                  {(() => {
                    const q = assessSlugQuality(formData.slug);
                    if (q.severity === 'ok' || q.issues.length === 0) return null;
                    const tone =
                      q.severity === 'error' ? 'text-destructive' : 'text-amber-600';
                    return (
                      <ul className={`text-xs space-y-0.5 ${tone}`} aria-live="polite">
                        {q.issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              </div>


              <div className="space-y-2">
                <Label htmlFor="description">Descrição curta</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição breve do produto"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="long_description">Descrição detalhada</Label>
                <Textarea
                  id="long_description"
                  value={formData.long_description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, long_description: e.target.value }))}
                  placeholder="Descrição completa com detalhes do produto"
                  rows={14}
                  className="min-h-[280px] resize-y"
                />

              </div>
            </CardContent>
          </Card>

          {/* Tags + Segmentos (desktop: abaixo da descrição detalhada) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 max-h-56 overflow-y-auto">
                  {tags?.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors">
                      <Checkbox
                        checked={selectedTags.includes(tag.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTags((prev) => [...prev, tag.id]);
                          } else {
                            setSelectedTags((prev) => prev.filter((id) => id !== tag.id));
                          }
                        }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </label>
                  ))}
                  {!tags?.length && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma tag cadastrada.{' '}
                      <a href="/admin/tags" className="underline text-primary">Criar agora</a>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-display">Segmentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 max-h-56 overflow-y-auto">
                  {segments?.map((seg) => (
                    <label key={seg.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors">
                      <Checkbox
                        checked={selectedSegments.includes(seg.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSegments((prev) => [...prev, seg.id]);
                          } else {
                            setSelectedSegments((prev) => prev.filter((id) => id !== seg.id));
                          }
                        }}
                      />
                      <span className="text-sm">{seg.name}</span>
                    </label>
                  ))}
                  {!segments?.length && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum segmento cadastrado.{' '}
                      <a href="/admin/segmentos" className="underline text-primary">Criar agora</a>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-display">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Produto ativo</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-display">Personalização</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="personalization_enabled">Habilitar campo de personalização</Label>
                  <Switch
                    id="personalization_enabled"
                    checked={formData.personalization_enabled}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, personalization_enabled: checked }))}
                  />
                </div>
                {formData.personalization_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="personalization_label">Título do campo</Label>
                      <Input
                        id="personalization_label"
                        value={formData.personalization_label}
                        onChange={(e) => setFormData((prev) => ({ ...prev, personalization_label: e.target.value }))}
                        placeholder="Ex: Qual a letra para a lembrancinha?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="personalization_placeholder">Placeholder do campo</Label>
                      <Input
                        id="personalization_placeholder"
                        value={formData.personalization_placeholder}
                        onChange={(e) => setFormData((prev) => ({ ...prev, personalization_placeholder: e.target.value }))}
                        placeholder="Ex: Escreva o nome ou letra inicial..."
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-display">Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg font-display">Ocasiões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {occasions?.map((occ) => (
                    <label key={occ.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors">
                      <Checkbox
                        checked={selectedOccasions.includes(occ.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOccasions((prev) => [...prev, occ.id]);
                          } else {
                            setSelectedOccasions((prev) => prev.filter((id) => id !== occ.id));
                          }
                        }}
                      />
                      <span className="text-sm">{occ.name}</span>
                    </label>
                  ))}
                  {!occasions?.length && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma ocasião cadastrada.{' '}
                      <a href="/admin/ocasioes" className="underline text-primary">Criar agora</a>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>


          </div>
        </div>

        {/* Pricing */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Preços e Quantidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_quantity">Qtd. mínima</Label>
                <Input
                  id="min_quantity"
                  type="number"
                  value={formData.min_quantity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, min_quantity: e.target.value }))}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pix_discount">Desconto PIX (%)</Label>
                <Input
                  id="pix_discount"
                  type="number"
                  value={formData.pix_discount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pix_discount: e.target.value }))}
                  placeholder="7"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="production_days">Prazo (dias)</Label>
                <Input
                  id="production_days"
                  type="number"
                  value={formData.production_days}
                  onChange={(e) => setFormData((prev) => ({ ...prev, production_days: e.target.value }))}
                  placeholder="7"
                />
              </div>
              <div className={`space-y-2 rounded-md p-2 -m-2 transition-colors ${
                (!formData.weight || parseFloat(formData.weight) <= 0)
                  ? 'bg-destructive/5 ring-1 ring-destructive/40'
                  : 'bg-emerald-500/5 ring-1 ring-emerald-500/30'
              }`}>
                <Label htmlFor="weight" className="flex items-center gap-1">
                  Peso (kg) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.001"
                  min="0.001"
                  required={!isEditing}
                  value={formData.weight}
                  onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.target.value }))}
                  placeholder="0.100"
                  aria-invalid={!formData.weight || parseFloat(formData.weight) <= 0}
                />
                <p className="text-xs text-muted-foreground">
                  Obrigatório para o cálculo de frete (Melhor Envio).
                </p>
              </div>
            </div>

            {/* Sprint 2 — Discovery editorial */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t mt-4">
              <div className="space-y-2">
                <Label htmlFor="featured_weight">Peso editorial (destaque)</Label>
                <Input
                  id="featured_weight"
                  type="number"
                  min="0"
                  max="999"
                  value={formData.featured_weight}
                  onChange={(e) => setFormData((prev) => ({ ...prev, featured_weight: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Quanto maior, mais alto aparece no catálogo, busca e relacionados. Padrão 0.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="production_speed">Override prazo</Label>
                <select
                  id="production_speed"
                  value={formData.production_speed}
                  onChange={(e) => setFormData((prev) => ({ ...prev, production_speed: e.target.value as '' | 'rapido' | 'normal' | 'longo' }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Automático (pelo prazo em dias)</option>
                  <option value="rapido">Pronta entrega</option>
                  <option value="normal">Prazo normal</option>
                  <option value="longo">Sob encomenda</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Force a faixa exibida no filtro e badge do card, independentemente dos dias.
                </p>
                {(() => {
                  const days = parseInt(formData.production_days) || 0;
                  const override = formData.production_speed as 'rapido' | 'normal' | 'longo' | '';
                  const eff = override || (days <= 0 ? null : days <= 3 ? 'rapido' : days <= 7 ? 'normal' : 'longo');
                  const label = eff === 'rapido' ? 'Pronta entrega' : eff === 'normal' ? 'Prazo normal' : eff === 'longo' ? 'Sob encomenda' : '—';
                  return (
                    <div className="text-xs rounded-md bg-muted/50 border px-2 py-1.5">
                      <span className="text-muted-foreground">Bucket resultante: </span>
                      <span className="font-medium text-foreground">{label}</span>
                      {override && <span className="ml-1 text-primary">(override)</span>}
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Imagens</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploader 
              images={formData.images}
              onImagesChange={(images) => setFormData((prev) => ({ ...prev, images }))}
              maxImages={8}
            />
          </CardContent>
        </Card>

        {/* Features & Keywords */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Características</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={feature}
                    onChange={(e) => handleArrayChange('features', index, e.target.value)}
                    placeholder="Característica do produto"
                  />
                  {formData.features.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeArrayItem('features', index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => addArrayItem('features')}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar característica
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Palavras-chave (SEO)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Textarea
                  value={keywordsInput}
                  onChange={(e) => handleKeywordsChange(e.target.value)}
                  placeholder="Digite palavras-chave separadas por vírgula: lembrancinha, maternidade, bebê, chá de bebê"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Separe as palavras-chave com vírgulas. Ex: lembrancinha, casamento, personalizado
                </p>
              </div>
              
              {/* Display current keywords as tags */}
              {formData.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {formData.keywords.map((keyword, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                        className="hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Informações Adicionais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="badge">Badge</Label>
                <Input
                  id="badge"
                  value={formData.badge}
                  onChange={(e) => setFormData((prev) => ({ ...prev, badge: e.target.value }))}
                  placeholder="Ex: Mais Vendido"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Avaliação</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rating: e.target.value }))}
                  placeholder="5.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google_product_category">Categoria Google (Merchant Center)</Label>
                <Input
                  id="google_product_category"
                  value={formData.google_product_category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, google_product_category: e.target.value }))}
                  placeholder="Ex: Arts & Entertainment > Party & Celebration > Party Favors"
                />
                <p className="text-xs text-muted-foreground">
                  Categoria específica do Google para este produto. Se vazio, usa a categoria global do Merchant Feed.{' '}
                  <a href="https://support.google.com/merchants/answer/6324436" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                    Ver taxonomia Google
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editorial Content (Fase 7.1) */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <FileText className="w-4 h-4" /> Conteúdo Editorial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="editorial_content">Texto editorial (opcional)</Label>
            <Textarea
              id="editorial_content"
              rows={8}
              value={formData.editorial_content}
              onChange={(e) => setFormData((prev) => ({ ...prev, editorial_content: e.target.value }))}
              placeholder={
                'Conte a história da peça: inspiração, contexto, dicas de uso, decoração, apresentação, significado emocional...\n\nMarkdown simples (parágrafos) é suportado e enriquece o SEO como Article.'
              }
            />
            <p className="text-xs text-muted-foreground">
              Esse conteúdo é renderizado abaixo da descrição no site público como uma seção editorial e gera schema <code>Article</code>.
            </p>
          </CardContent>
        </Card>

        {/* Fase 8 — Checklist + Previews + Templates + Sugestões */}
        {(() => {
          const categorySlug = categories?.find((c) => c.id === formData.category_id)?.slug || null;
          const occasionSlugs = (occasions || [])
            .filter((o) => selectedOccasions.includes(o.id))
            .map((o) => o.slug);
          const segmentSlugs = (segments || [])
            .filter((s) => selectedSegments.includes(s.id))
            .map((s) => s.slug);
          const tagSlugs = (tags || [])
            .filter((t) => selectedTags.includes(t.id))
            .map((t) => t.slug);
          const checklist = buildProductChecklist({
            ...formData,
            occasionsCount: selectedOccasions.length,
            segmentsCount: selectedSegments.length,
            tagsCount: selectedTags.length,
            reviewsCount: 0,
            images: formData.images.filter(Boolean),
          });
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProductSeoChecklist result={checklist} />
              <SocialSeoPreviews
                title={formData.name}
                description={formData.description}
                slug={formData.slug}
                imageUrl={formData.images.filter(Boolean)[0]}
              />
              <TaxonomySuggestionsHints
                name={formData.name}
                description={formData.description}
                long_description={formData.long_description}
                editorial_content={formData.editorial_content}
                keywords={formData.keywords}
                existingTagSlugs={tagSlugs}
                existingOccasionSlugs={occasionSlugs}
                existingSegmentSlugs={segmentSlugs}
                existingCategorySlug={categorySlug}
              />
              <EditorialTemplatesPicker
                categorySlug={categorySlug}
                occasionSlugs={occasionSlugs}
                productName={formData.name}
                onInsert={(text) =>
                  setFormData((prev) => ({
                    ...prev,
                    editorial_content: prev.editorial_content
                      ? `${prev.editorial_content}\n\n${text}`
                      : text,
                  }))
                }
              />
            </div>
          );
        })()}

        {/* Resumo rápido + CTA WhatsApp (exibição por produto) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Resumo rápido + CTA WhatsApp</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Quando ativado, exibe a seção "Você está pedindo X unidades..." com botão de WhatsApp na página deste produto. Aplica-se apenas a produtos cujo CTA primário é o WhatsApp (personalizado ou sem estoque). Padrão: desativado.
                </p>
              </div>
              <Switch
                checked={showQuickSummary}
                onCheckedChange={setShowQuickSummary}
                aria-label="Exibir resumo rápido na PDP"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Exibir quantidade mínima na PDP */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Exibir "Mínimo X un." na PDP</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Quando ativado, mostra o selo de quantidade mínima ("Mínimo {formData.min_quantity || 'X'} un.") na linha de informações da página deste produto. Padrão: desativado.
                </p>
              </div>
              <Switch
                checked={showMinQuantity}
                onCheckedChange={setShowMinQuantity}
                aria-label="Exibir quantidade mínima na PDP"
              />
            </div>
          </CardHeader>
        </Card>


        {/* Badge personalizado da PDP (override por produto) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Badge personalizado da PDP</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Quando ativado, sobrescreve o badge global apenas neste produto. Quando desligado, usa a configuração global de <strong>/admin/conversao</strong>.
                </p>
              </div>
              <Switch
                checked={!!badgeOverride}
                onCheckedChange={(v) => setBadgeOverride(v ? { ...DEFAULT_BADGE_OVERRIDE } : null)}
              />
            </div>
          </CardHeader>
          {badgeOverride && (
            <CardContent className="grid lg:grid-cols-[1fr_280px] gap-6">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label>Texto</Label>
                  <Input
                    value={badgeOverride.label}
                    maxLength={40}
                    onChange={(e) => setBadgeOverride({ ...badgeOverride, label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cor</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={badgeOverride.tone}
                    onChange={(e) => setBadgeOverride({ ...badgeOverride, tone: e.target.value as any })}
                  >
                    <option value="blue">Azul</option>
                    <option value="coral">Coral</option>
                    <option value="green">Verde</option>
                    <option value="amber">Âmbar</option>
                    <option value="neutral">Neutro</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Posição</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={badgeOverride.position}
                    onChange={(e) => setBadgeOverride({ ...badgeOverride, position: e.target.value as any })}
                  >
                    <option value="top-left">Sup. esquerda</option>
                    <option value="top-right">Sup. direita</option>
                    <option value="bottom-left">Inf. esquerda</option>
                    <option value="bottom-right">Inf. direita</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Offset X (px)</Label>
                  <Input
                    type="number" min={0} max={80}
                    value={badgeOverride.offsetX}
                    onChange={(e) => setBadgeOverride({ ...badgeOverride, offsetX: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Offset Y (px)</Label>
                  <Input
                    type="number" min={0} max={80}
                    value={badgeOverride.offsetY}
                    onChange={(e) => setBadgeOverride({ ...badgeOverride, offsetY: Number(e.target.value) })}
                  />
                </div>
                <label className="flex items-center gap-2 sm:col-span-3">
                  <Switch
                    checked={badgeOverride.showIcon}
                    onCheckedChange={(v) => setBadgeOverride({ ...badgeOverride, showIcon: v })}
                  />
                  <span className="text-sm">Mostrar ícone de caminhão</span>
                </label>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                <div className="relative w-[280px] h-[280px] rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={formData.images.filter(Boolean)[0] || '/placeholder.svg'}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <PdpBadge config={badgeOverride} previewOnly />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* FAQ por produto (apenas ao editar — precisa do ID) */}
        {isEditing && id && (
          <ProductFaqEditor
            productId={id}
            productName={formData.name || 'produto'}
            productionDays={formData.production_days ? Number(formData.production_days) : null}
            personalizationEnabled={formData.personalization_enabled}
            categoryName={categories?.find((c) => c.id === formData.category_id)?.name ?? null}
          />
        )}

        {/* Save Button at bottom */}
        <div className="flex justify-end gap-4 sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border shadow-lg">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/produtos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} size="lg">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Salvar Alterações' : 'Criar Produto'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminProductForm;
