import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, Check, X, Search, GripVertical, Loader2, AlertCircle, FileEdit, Globe, EyeOff, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { trackAdminEvent } from '@/lib/adminUsage';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  useDbCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type DbCategory,
} from '@/hooks/useProducts';
import { useSlugAvailability, type SlugCheckState } from '@/hooks/useSlugAvailability';
import { LucideIcon } from '@/components/LucideIcon';
import LucideIconPicker from '@/components/admin/LucideIconPicker';

interface SortableRowProps {
  category: DbCategory;
  editingId: string | null;
  editName: string;
  editSlug: string;
  editIcon: string | null;
  editImageUrl: string;
  isSaving: boolean;
  onStartEdit: (c: DbCategory) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: string) => void;
  setEditName: (v: string) => void;
  setEditSlug: (v: string) => void;
  setEditIcon: (v: string | null) => void;
  setEditImageUrl: (v: string) => void;
  generateSlug: (n: string) => string;
  slugCheck?: SlugCheckState;
}

const SortableRow = ({
  category,
  editingId,
  editName,
  editSlug,
  editIcon,
  editImageUrl,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  setEditName,
  setEditSlug,
  setEditIcon,
  setEditImageUrl,
  generateSlug,
  slugCheck,
}: SortableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: editingId === category.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isEditing = editingId === category.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
    >
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditSlug(generateSlug(e.target.value));
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                aria-describedby="edit-slug-status"
                aria-invalid={slugCheck?.status === 'taken' || slugCheck?.status === 'invalid'}
              />
              <p
                id="edit-slug-status"
                aria-live="polite"
                className={`text-xs flex items-center gap-1 min-h-[1rem] ${
                  slugCheck?.status === 'available'
                    ? 'text-emerald-600'
                    : slugCheck?.status === 'taken' || slugCheck?.status === 'invalid'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {slugCheck?.status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {slugCheck?.status === 'available' && <Check className="h-3 w-3" aria-hidden />}
                {(slugCheck?.status === 'taken' || slugCheck?.status === 'invalid') && (
                  <AlertCircle className="h-3 w-3" aria-hidden />
                )}
                <span>{slugCheck?.message}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Ícone (Lucide)</Label>
              <LucideIconPicker value={editIcon} onChange={setEditIcon} />
            </div>
            <div>
              <Label className="text-xs">Imagem (URL)</Label>
              <Input
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancelEdit}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={onSaveEdit} disabled={isSaving}>
              <Check className="w-4 h-4 mr-1" /> Salvar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1 touch-none"
              aria-label="Arrastar para reordenar"
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-background ring-2 ring-border flex items-center justify-center shrink-0">
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <LucideIcon name={category.icon} className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="cursor-pointer min-w-0" onClick={() => onStartEdit(category)}>
              <p className="font-medium text-foreground truncate flex items-center gap-2 flex-wrap">
                {category.name}
                {category.is_draft === true && (
                  <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0">
                    <FileEdit className="w-3 h-3" /> Rascunho
                  </Badge>
                )}
                {category.is_draft === false && (
                  <Badge variant="outline" className="gap-1 border-emerald-400 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0">
                    <Globe className="w-3 h-3" /> Publicado
                  </Badge>
                )}
                {category.is_indexed === false && (
                  <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
                    <EyeOff className="w-3 h-3" /> noindex
                  </Badge>
                )}
                {category.icon && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <LucideIcon name={category.icon} className="w-3 h-3" />
                    {category.icon}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {category.slug}
                {typeof category.position === 'number' && (
                  <span className="ml-2 text-xs">#{category.position}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Bloco 3 SAFE: toggles rápidos de Publicado e Indexável */}
            <div className="hidden md:flex items-center gap-3 mr-1 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer" title="Publicado / Rascunho">
                <Switch
                  checked={category.is_draft === false}
                  onCheckedChange={(checked) => onToggleField(category.id, 'is_draft', !checked)}
                  aria-label={category.is_draft ? 'Marcar como publicado' : 'Marcar como rascunho'}
                />
                <span className="text-muted-foreground">{category.is_draft ? 'Rascunho' : 'Publicado'}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer" title="Aparece no sitemap/SEO">
                <Switch
                  checked={category.is_indexed !== false}
                  onCheckedChange={(checked) => onToggleField(category.id, 'is_indexed', checked)}
                  aria-label={category.is_indexed ? 'Remover do índice' : 'Indexar'}
                />
                <Eye className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
              </label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onStartEdit(category)}
              className="text-muted-foreground hover:text-primary"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(category.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminCategories = () => {
  const { data: categories, isLoading } = useDbCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');

  const createSlugCheck = useSlugAvailability('categories', formData.slug, null);
  const editSlugCheck = useSlugAvailability('categories', editSlug, editingId);

  // Local sortable order
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    if (categories) setOrderedIds(categories.map((c) => c.id));
  }, [categories]);

  // Usage telemetry: open/submit/abandon for the create dialog.
  const createState = useRef({ opened: false, submitted: false });
  useEffect(() => {
    if (isDialogOpen) {
      trackAdminEvent('form_open', 'category_create');
      createState.current = { opened: true, submitted: false };
    } else if (createState.current.opened && !createState.current.submitted) {
      trackAdminEvent('form_abandon', 'category_create');
      createState.current.opened = false;
    }
  }, [isDialogOpen]);

  // Debounced search usage tracking.
  useEffect(() => {
    if (!searchQuery) return;
    const t = setTimeout(() => trackAdminEvent('list_search', 'categories'), 700);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleNameChange = (name: string) => setFormData({ name, slug: generateSlug(name) });

  const handleCreate = async () => {
    if (!formData.name || !formData.slug) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (createSlugCheck.status === 'taken' || createSlugCheck.status === 'invalid') {
      trackAdminEvent('slug_invalid_attempt', 'categories');
      toast({ title: 'Corrija o slug antes de criar', variant: 'destructive' });
      return;
    }
    try {
      await createCategory.mutateAsync(formData);
      createState.current.submitted = true;
      trackAdminEvent('form_submit', 'category_create');
      toast({ title: 'Categoria criada com sucesso!' });
      setFormData({ name: '', slug: '' });
      setIsDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao criar categoria', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCategory.mutateAsync(deleteId);
      toast({ title: 'Categoria excluída com sucesso!' });
    } catch {
      toast({ title: 'Erro ao excluir categoria', variant: 'destructive' });
    }
    setDeleteId(null);
  };

  const handleStartEdit = (category: DbCategory) => {
    trackAdminEvent('list_item_click', 'categories');
    trackAdminEvent('form_open', 'category_edit');
    setEditingId(category.id);
    setEditName(category.name);
    setEditSlug(category.slug);
    setEditIcon(category.icon ?? null);
    setEditImageUrl(category.image_url ?? '');
  };

  const handleCancelEdit = () => {
    if (editingId) trackAdminEvent('form_abandon', 'category_edit');
    setEditingId(null);
    setEditName('');
    setEditSlug('');
    setEditIcon(null);
    setEditImageUrl('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editSlug.trim()) return;
    if (editSlugCheck.status === 'taken' || editSlugCheck.status === 'invalid') {
      trackAdminEvent('slug_invalid_attempt', 'categories');
      toast({ title: 'Corrija o slug antes de salvar', variant: 'destructive' });
      return;
    }
    try {
      await updateCategory.mutateAsync({
        id: editingId,
        name: editName.trim(),
        slug: editSlug.trim(),
        icon: editIcon,
        image_url: editImageUrl.trim() || null,
      });
      trackAdminEvent('form_submit', 'category_edit');
      toast({ title: 'Categoria atualizada com sucesso!' });
      setEditingId(null);
      setEditName('');
      setEditSlug('');
      setEditIcon(null);
      setEditImageUrl('');
    } catch {
      toast({ title: 'Erro ao atualizar categoria', variant: 'destructive' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(newOrder);
    setSavingOrder(true);

    try {
      // Persist position = (index+1) * 10 for each category
      const updates = newOrder.map((id, idx) =>
        supabase
          .from('categories')
          .update({ position: (idx + 1) * 10 })
          .eq('id', id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Ordem atualizada' });
    } catch {
      toast({ title: 'Erro ao salvar ordem', variant: 'destructive' });
      if (categories) setOrderedIds(categories.map((c) => c.id));
    } finally {
      setSavingOrder(false);
    }
  };

  const byId = new Map((categories ?? []).map((c) => [c.id, c]));
  const sortedCategories: DbCategory[] = orderedIds
    .map((id) => byId.get(id))
    .filter((c): c is DbCategory => !!c);

  const filteredCategories = sortedCategories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showDnd = !searchQuery; // Drag only makes sense over the full list

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground">Categorias</h1>
          <p className="text-muted-foreground mt-1">
            Arraste para reordenar. Edite nome, slug, ícone (Lucide) e imagem. A ordem aqui define o
            carrossel da home.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Nome da categoria"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="slug-da-categoria"
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
              <p className="text-xs text-muted-foreground">
                Após criar, edite a categoria para definir o ícone Lucide e a imagem.
              </p>
              <Button onClick={handleCreate} className="w-full" disabled={createCategory.isPending}>
                {createCategory.isPending ? 'Criando...' : 'Criar Categoria'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categorias..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-display">
            Todas as Categorias ({filteredCategories.length})
          </CardTitle>
          {savingOrder && (
            <span className="text-xs text-muted-foreground">Salvando ordem...</span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
              <span className="sr-only">Carregando categorias…</span>
            </div>
          ) : filteredCategories.length > 0 ? (
            showDnd ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {filteredCategories.map((category) => (
                      <SortableRow
                        key={category.id}
                        category={category}
                        editingId={editingId}
                        editName={editName}
                        editSlug={editSlug}
                        editIcon={editIcon}
                        editImageUrl={editImageUrl}
                        isSaving={updateCategory.isPending}
                        onStartEdit={handleStartEdit}
                        onCancelEdit={handleCancelEdit}
                        onSaveEdit={handleSaveEdit}
                        onDelete={setDeleteId}
                        setEditName={setEditName}
                        setEditSlug={setEditSlug}
                        setEditIcon={setEditIcon}
                        setEditImageUrl={setEditImageUrl}
                        generateSlug={generateSlug}
                        slugCheck={editSlugCheck}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Reordenação desativada durante a busca. Limpe o filtro para arrastar.
                </p>
                <div className="space-y-3">
                  {filteredCategories.map((category) => (
                    <SortableRow
                      key={category.id}
                      category={category}
                      editingId={editingId}
                      editName={editName}
                      editSlug={editSlug}
                      editIcon={editIcon}
                      editImageUrl={editImageUrl}
                      isSaving={updateCategory.isPending}
                      onStartEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      onSaveEdit={handleSaveEdit}
                      onDelete={setDeleteId}
                      setEditName={setEditName}
                      setEditSlug={setEditSlug}
                      setEditIcon={setEditIcon}
                        setEditImageUrl={setEditImageUrl}
                        generateSlug={generateSlug}
                        slugCheck={editSlugCheck}
                      />
                  ))}
                </div>
              </>
            )
          ) : (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {searchQuery ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Tente outro termo de busca ou limpe o filtro.'
                    : 'Crie a primeira categoria para começar a organizar seus produtos.'}
                </p>
              </div>
              {!searchQuery && (
                <Button onClick={() => setIsDialogOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira categoria
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos vinculados ficarão sem esta categoria. Esta ação não pode ser desfeita.
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

export default AdminCategories;
