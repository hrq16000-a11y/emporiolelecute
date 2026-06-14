import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, Check, X, Search, Calendar, Loader2, AlertCircle, Image as ImageIcon, FileEdit, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { trackAdminEvent } from '@/lib/adminUsage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useDbOccasions, useCreateOccasion, useDeleteOccasion, useUpdateOccasion } from '@/hooks/useProducts';
import { useSlugAvailability } from '@/hooks/useSlugAvailability';
import ImagePickerWithLibrary from '@/components/admin/ImagePickerWithLibrary';
import LucideIconPicker from '@/components/admin/LucideIconPicker';
import { LucideIcon } from '@/components/LucideIcon';
import { useQueryClient } from '@tanstack/react-query';
import { markPublicTaxonomyDirty, invalidatePublicTaxonomy } from '@/lib/taxonomyAutomation';

const AdminOccasions = () => {
  const { data: occasions, isLoading } = useDbOccasions();
  const createOccasion = useCreateOccasion();
  const deleteOccasion = useDeleteOccasion();
  const updateOccasion = useUpdateOccasion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Inline editing state (name/slug)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');

  // Advanced content editor (image + descrição + meta tags)
  const [contentEditId, setContentEditId] = useState<string | null>(null);
  const [contentForm, setContentForm] = useState({
    icon: '' as string | null,
    image_url: '',
    description: '',
    meta_title: '',
    meta_description: '',
  });
  const [savingContent, setSavingContent] = useState(false);

  const createSlugCheck = useSlugAvailability('occasions', formData.slug, null);
  const editSlugCheck = useSlugAvailability('occasions', editSlug, editingId);

  // Usage telemetry: open/submit/abandon for create dialog.
  const createState = useRef({ opened: false, submitted: false });
  useEffect(() => {
    if (isDialogOpen) {
      trackAdminEvent('form_open', 'occasion_create');
      createState.current = { opened: true, submitted: false };
    } else if (createState.current.opened && !createState.current.submitted) {
      trackAdminEvent('form_abandon', 'occasion_create');
      createState.current.opened = false;
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (!searchQuery) return;
    const t = setTimeout(() => trackAdminEvent('list_search', 'occasions'), 700);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({ name, slug: generateSlug(name) });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.slug) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (createSlugCheck.status === 'taken' || createSlugCheck.status === 'invalid') {
      trackAdminEvent('slug_invalid_attempt', 'occasions');
      toast({ title: 'Corrija o slug antes de criar', variant: 'destructive' });
      return;
    }

    try {
      await createOccasion.mutateAsync(formData);
      createState.current.submitted = true;
      trackAdminEvent('form_submit', 'occasion_create');
      toast({ title: 'Ocasião criada com sucesso!' });
      setFormData({ name: '', slug: '' });
      setIsDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao criar ocasião', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteOccasion.mutateAsync(deleteId);
      toast({ title: 'Ocasião excluída com sucesso!' });
    } catch {
      toast({ title: 'Erro ao excluir ocasião', variant: 'destructive' });
    }
    setDeleteId(null);
  };

  const handleStartEdit = (occasion: { id: string; name: string; slug: string }) => {
    trackAdminEvent('list_item_click', 'occasions');
    trackAdminEvent('form_open', 'occasion_edit');
    setEditingId(occasion.id);
    setEditName(occasion.name);
    setEditSlug(occasion.slug);
  };

  const handleCancelEdit = () => {
    if (editingId) trackAdminEvent('form_abandon', 'occasion_edit');
    setEditingId(null);
    setEditName('');
    setEditSlug('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editSlug.trim()) return;
    if (editSlugCheck.status === 'taken' || editSlugCheck.status === 'invalid') {
      trackAdminEvent('slug_invalid_attempt', 'occasions');
      toast({ title: 'Corrija o slug antes de salvar', variant: 'destructive' });
      return;
    }

    try {
      await updateOccasion.mutateAsync({
        id: editingId,
        name: editName.trim(),
        slug: editSlug.trim(),
      });
      trackAdminEvent('form_submit', 'occasion_edit');
      toast({ title: 'Ocasião atualizada com sucesso!' });
      setEditingId(null);
      setEditName('');
      setEditSlug('');
    } catch {
      toast({ title: 'Erro ao atualizar ocasião', variant: 'destructive' });
    }
  };

  const filteredOccasions = occasions?.filter(occ =>
    occ.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    occ.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openContentEditor = (occ: any) => {
    setContentEditId(occ.id);
    setContentForm({
      icon: occ.icon || '',
      image_url: occ.image_url || '',
      description: occ.description || '',
      meta_title: occ.meta_title || '',
      meta_description: occ.meta_description || '',
    });
  };

  const saveContent = async () => {
    if (!contentEditId) return;
    setSavingContent(true);
    try {
      await updateOccasion.mutateAsync({
        id: contentEditId,
        icon: (contentForm.icon || '').trim() || null,
        image_url: contentForm.image_url.trim() || null,
        description: contentForm.description.trim() || null,
        meta_title: contentForm.meta_title.trim() || null,
        meta_description: contentForm.meta_description.trim() || null,
      } as any);
      invalidatePublicTaxonomy(queryClient, 'occasions');
      void markPublicTaxonomyDirty('occasions');
      toast({ title: 'Conteúdo atualizado!' });
      setContentEditId(null);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSavingContent(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            Ocasiões
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie as ocasiões dos produtos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Ocasião
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Ocasião</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Nome da ocasião"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="slug-da-ocasiao"
                  aria-describedby="create-slug-status"
                  aria-invalid={createSlugCheck.status === 'taken' || createSlugCheck.status === 'invalid'}
                />
                <p
                  id="create-slug-status"
                  aria-live="polite"
                  className={`text-xs flex items-center gap-1 min-h-[1rem] ${
                    createSlugCheck.status === 'available'
                      ? 'text-emerald-600'
                      : createSlugCheck.status === 'taken' || createSlugCheck.status === 'invalid'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {createSlugCheck.status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                  {createSlugCheck.status === 'available' && <Check className="h-3 w-3" aria-hidden />}
                  {(createSlugCheck.status === 'taken' || createSlugCheck.status === 'invalid') && (
                    <AlertCircle className="h-3 w-3" aria-hidden />
                  )}
                  <span>{createSlugCheck.message}</span>
                </p>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createOccasion.isPending}>
                {createOccasion.isPending ? 'Criando...' : 'Criar Ocasião'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar ocasiões..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">Todas as Ocasiões ({filteredOccasions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
              <span className="sr-only">Carregando ocasiões…</span>
            </div>
          ) : filteredOccasions && filteredOccasions.length > 0 ? (
            <div className="space-y-3">
              {filteredOccasions.map((occasion) => (
                <div
                  key={occasion.id}
                  className="flex flex-col gap-3 p-3 sm:p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  {editingId === occasion.id ? (
                    <div className="flex-1 flex flex-col gap-3 sm:flex-row sm:items-start">
                      <Input
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          setEditSlug(generateSlug(e.target.value));
                        }}
                        className="w-full sm:max-w-[14rem]"
                        placeholder="Nome"
                      />
                      <div className="flex-1 min-w-0">
                        <Input
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                          className="w-full"
                          placeholder="Slug"
                          aria-describedby="edit-slug-status"
                          aria-invalid={editSlugCheck.status === 'taken' || editSlugCheck.status === 'invalid'}
                        />
                        <p
                          id="edit-slug-status"
                          aria-live="polite"
                          className={`text-xs flex items-center gap-1 min-h-[1rem] ${
                            editSlugCheck.status === 'available'
                              ? 'text-emerald-600'
                              : editSlugCheck.status === 'taken' || editSlugCheck.status === 'invalid'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {editSlugCheck.status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                          {editSlugCheck.status === 'available' && <Check className="h-3 w-3" aria-hidden />}
                          {(editSlugCheck.status === 'taken' || editSlugCheck.status === 'invalid') && (
                            <AlertCircle className="h-3 w-3" aria-hidden />
                          )}
                          <span>{editSlugCheck.message}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-start">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleSaveEdit}
                          disabled={updateOccasion.isPending}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          aria-label="Salvar"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-muted ring-1 ring-border/60 shrink-0 flex items-center justify-center">
                          {(occasion as any).icon ? (
                            <LucideIcon name={(occasion as any).icon} className="w-6 h-6 text-primary" />
                          ) : occasion.image_url ? (
                            <img src={occasion.image_url} alt={occasion.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="cursor-pointer min-w-0 flex-1" onClick={() => handleStartEdit(occasion)}>
                          <p className="font-medium text-foreground flex items-center gap-2 flex-wrap">
                            <span className="truncate">{occasion.name}</span>
                            {(occasion as any).is_draft === true ? (
                              <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0">
                                <FileEdit className="w-3 h-3" /> Rascunho
                              </Badge>
                            ) : (occasion as any).is_draft === false ? (
                              <Badge variant="outline" className="gap-1 border-emerald-400 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0">
                                <Globe className="w-3 h-3" /> Publicado
                              </Badge>
                            ) : null}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {occasion.slug}
                            {(!occasion.meta_title || !occasion.meta_description || !occasion.description) && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-600">conteúdo incompleto</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0 justify-end border-t border-border/40 pt-3 sm:border-t-0 sm:pt-0">
                        {/* Toggle inline rascunho/publicado */}
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer mr-auto sm:mr-1" title="Publicado / Rascunho">
                          <Switch
                            checked={(occasion as any).is_draft === false}
                            onCheckedChange={async (checked) => {
                              try {
                                await updateOccasion.mutateAsync({ id: occasion.id, is_draft: !checked } as any);
                                invalidatePublicTaxonomy(queryClient, 'occasions');
                                void markPublicTaxonomyDirty('occasions');
                                toast({ title: checked ? 'Publicado' : 'Marcado como rascunho' });
                              } catch { toast({ title: 'Erro ao atualizar', variant: 'destructive' }); }
                            }}
                            aria-label="Alternar publicado/rascunho"
                          />
                          <span className="text-muted-foreground">
                            {(occasion as any).is_draft === false ? 'Publicado' : 'Rascunho'}
                          </span>
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openContentEditor(occasion)}
                          className="gap-2"
                          aria-label="Imagem e SEO"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span>Imagem & SEO</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(occasion)}
                          className="text-muted-foreground hover:text-primary"
                          aria-label="Editar nome e slug"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(occasion.id)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
                <Calendar className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {searchQuery ? 'Nenhuma ocasião encontrada' : 'Nenhuma ocasião cadastrada'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Tente outro termo de busca ou limpe o filtro.'
                    : 'Crie a primeira ocasião para classificar produtos por momento.'}
                </p>
              </div>
              {!searchQuery && (
                <Button onClick={() => setIsDialogOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira ocasião
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor avançado de conteúdo: imagem + descrição + meta SEO */}
      <Dialog open={!!contentEditId} onOpenChange={(o) => !o && setContentEditId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imagem & SEO da ocasião</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label>Ícone (Lucide)</Label>
              <p className="text-xs text-muted-foreground">
                Exibido no carrossel de ocasiões da home. Quando definido, tem prioridade sobre a imagem.
              </p>
              <LucideIconPicker
                value={contentForm.icon}
                onChange={(name) => setContentForm((f) => ({ ...f, icon: name }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Imagem da ocasião</Label>
              <p className="text-xs text-muted-foreground">
                Aparece no carrossel da home e na vitrine. Recomendado: quadrada, 600×600px.
              </p>
              <ImagePickerWithLibrary
                value={contentForm.image_url}
                onChange={(url) => setContentForm((f) => ({ ...f, image_url: url }))}
                folder="occasions"
                hint="600x600 recomendado"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="occ-desc">Descrição</Label>
              <Textarea
                id="occ-desc"
                rows={5}
                value={contentForm.description}
                onChange={(e) => setContentForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Texto institucional exibido nas páginas da ocasião."
              />
              <p className="text-xs text-muted-foreground">{contentForm.description.length} caracteres</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occ-mt">Meta title (SEO)</Label>
              <Input
                id="occ-mt"
                maxLength={70}
                value={contentForm.meta_title}
                onChange={(e) => setContentForm((f) => ({ ...f, meta_title: e.target.value }))}
                placeholder="Ex.: Lembrancinhas para Casamento Artesanais | Empório Lelê"
              />
              <p className="text-xs text-muted-foreground">{contentForm.meta_title.length}/60 ideal</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occ-md">Meta description (SEO)</Label>
              <Textarea
                id="occ-md"
                rows={3}
                maxLength={200}
                value={contentForm.meta_description}
                onChange={(e) => setContentForm((f) => ({ ...f, meta_description: e.target.value }))}
                placeholder="Resumo de até 155 caracteres para resultados do Google."
              />
              <p className="text-xs text-muted-foreground">{contentForm.meta_description.length}/155 ideal</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContentEditId(null)} disabled={savingContent}>Cancelar</Button>
            <Button onClick={saveContent} disabled={savingContent}>
              {savingContent ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ocasião?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos vinculados ficarão sem esta ocasião. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOccasions;
