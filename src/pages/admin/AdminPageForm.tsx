import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Globe, EyeOff, History, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePageById, useCreatePage, useUpdatePage, useSavePageVersion, usePageVersions } from '@/hooks/usePages';
import WYSIWYGEditor from '@/components/admin/WYSIWYGEditor';
import { useFormDraft } from '@/hooks/useFormDraft';
import DraftStatusBadge from '@/components/admin/DraftStatusBadge';

const AdminPageForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = id && id !== 'nova';

  const { data: existingPage, isLoading } = usePageById(isEditing ? id : '');
  const { data: versions } = usePageVersions(isEditing ? id : '');
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const saveVersion = useSavePageVersion();

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    seo_title: '',
    seo_description: '',
    seo_canonical: '',
    seo_noindex: false,
    seo_nofollow: false,
    status: 'draft' as 'draft' | 'published',
    internal_notes: '',
  });

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Rascunho global: persiste em localStorage e sobrevive à navegação
  const draft = useFormDraft(formData, hydrated);

  // Hidratação inicial: prioriza rascunho local
  useEffect(() => {
    if (hydrated) return;
    const saved = draft.hydrate<typeof formData>();
    if (saved) {
      setFormData(saved);
      setHydrated(true);
      return;
    }
    if (!isEditing) setHydrated(true);
  }, [hydrated, isEditing, draft]);

  useEffect(() => {
    if (existingPage && !hydrated) {
      setFormData({
        title: existingPage.title,
        slug: existingPage.slug,
        content: existingPage.content || '',
        seo_title: existingPage.seo_title || '',
        seo_description: existingPage.seo_description || '',
        seo_canonical: existingPage.seo_canonical || '',
        seo_noindex: existingPage.seo_noindex,
        seo_nofollow: existingPage.seo_nofollow,
        status: existingPage.status,
        internal_notes: existingPage.internal_notes || '',
      });
      setHydrated(true);
    }
  }, [existingPage, hydrated]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: isEditing ? prev.slug : generateSlug(title),
    }));
  };

  const handleAutoSave = useCallback(async (content: string) => {
    if (isEditing && id) {
      try {
        await updatePage.mutateAsync({
          id,
          content,
          status: 'draft',
        });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  }, [isEditing, id, updatePage]);

  const handleSubmit = async (publish = false) => {
    if (!formData.title || !formData.slug) {
      toast({ title: 'Preencha título e slug', variant: 'destructive' });
      return;
    }

    try {
      const pageData = {
        ...formData,
        status: publish ? 'published' as const : formData.status,
        published_at: publish ? new Date().toISOString() : undefined,
      };

      if (isEditing && id) {
        // Save version before updating
        await saveVersion.mutateAsync({
          pageId: id,
          content: formData.content,
          seo_title: formData.seo_title,
          seo_description: formData.seo_description,
        });

        await updatePage.mutateAsync({ id, ...pageData });
        draft.clear();
        toast({ title: publish ? 'Página publicada!' : 'Página salva!' });
      } else {
        await createPage.mutateAsync(pageData);
        draft.clear();
        toast({ title: 'Página criada com sucesso!' });
        navigate('/admin/paginas');
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar página', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/paginas')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-display text-foreground truncate">
                {isEditing ? 'Editar Página' : 'Nova Página'}
              </h1>
              <DraftStatusBadge />
            </div>
            {lastSaved && (
              <p className="text-xs text-muted-foreground mt-1">
                Último salvamento: {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSubmit(false)}
            disabled={createPage.isPending || updatePage.isPending}
          >
            {(createPage.isPending || updatePage.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button
            size="sm"
            onClick={() => handleSubmit(true)}
            disabled={createPage.isPending || updatePage.isPending}
            className="bg-primary hover:bg-primary-dark"
          >
            <Globe className="w-4 h-4 mr-2" />
            Publicar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título da página"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>URL (slug)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-muted-foreground">/</span>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="url-da-pagina"
                  />
                </div>
              </div>
              <div>
                <Label>Conteúdo</Label>
                <div className="mt-1">
                  <WYSIWYGEditor
                    content={formData.content}
                    onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                    onAutoSave={isEditing ? handleAutoSave : undefined}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Tabs defaultValue="seo">
            <TabsList className="w-full">
              <TabsTrigger value="seo" className="flex-1">
                <Settings className="w-4 h-4 mr-1" /> SEO
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                <History className="w-4 h-4 mr-1" /> Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seo">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <Label>Título SEO</Label>
                    <Input
                      value={formData.seo_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, seo_title: e.target.value }))}
                      placeholder="Título para SEO"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{formData.seo_title.length}/60 caracteres</p>
                  </div>
                  <div>
                    <Label>Meta Description</Label>
                    <Textarea
                      value={formData.seo_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, seo_description: e.target.value }))}
                      placeholder="Descrição para SEO"
                      className="mt-1"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{formData.seo_description.length}/160 caracteres</p>
                  </div>
                  <div>
                    <Label>URL Canônica</Label>
                    <Input
                      value={formData.seo_canonical}
                      onChange={(e) => setFormData(prev => ({ ...prev, seo_canonical: e.target.value }))}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>noindex</Label>
                    <Switch
                      checked={formData.seo_noindex}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, seo_noindex: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>nofollow</Label>
                    <Switch
                      checked={formData.seo_nofollow}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, seo_nofollow: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardContent className="pt-4">
                  {versions?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão anterior</p>
                  ) : (
                    <div className="space-y-2">
                      {versions?.slice(0, 10).map((version) => (
                        <div key={version.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                          <div>
                            <p className="text-sm font-medium">Versão {version.version_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(version.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              content: version.content || '',
                              seo_title: version.seo_title || '',
                              seo_description: version.seo_description || '',
                            }))}
                          >
                            Restaurar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Notas Internas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.internal_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, internal_notes: e.target.value }))}
                placeholder="Notas visíveis apenas no admin..."
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {formData.status === 'published' ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Globe className="w-4 h-4" />
                    <span>Publicado</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <EyeOff className="w-4 h-4" />
                    <span>Rascunho</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPageForm;
