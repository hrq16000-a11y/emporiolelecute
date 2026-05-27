import { useState } from 'react';
import { Tag, Plus, Trash2, Loader2, Search, Edit, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTags, useCreateTag, useDeleteTag, useUpdateTag } from '@/hooks/useTags';
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

const AdminTags = () => {
  const { data: tags, isLoading } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const updateTag = useUpdateTag();
  const { toast } = useToast();

  const [newTagName, setNewTagName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleCreate = async () => {
    if (!newTagName.trim()) return;

    try {
      await createTag.mutateAsync({
        name: newTagName.trim(),
        slug: generateSlug(newTagName),
      });
      setNewTagName('');
      toast({ title: 'Tag criada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao criar tag', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteTag.mutateAsync(deleteId);
      setDeleteId(null);
      toast({ title: 'Tag excluída com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao excluir tag', variant: 'destructive' });
    }
  };

  const handleStartEdit = (tag: { id: string; name: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    
    try {
      await updateTag.mutateAsync({
        id: editingId,
        name: editName.trim(),
        slug: generateSlug(editName),
      });
      toast({ title: 'Tag atualizada com sucesso!' });
      handleCancelEdit();
    } catch {
      toast({ title: 'Erro ao atualizar tag', variant: 'destructive' });
    }
  };

  const filteredTags = tags?.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground flex items-center gap-3">
            <Tag className="w-8 h-8 text-primary" />
            Tags
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie as tags dos produtos</p>
        </div>
      </div>

      {/* Create new tag */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Nova Tag</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Nome da tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={!newTagName.trim() || createTag.isPending}>
              {createTag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tags list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredTags?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'Nenhuma tag encontrada' : 'Nenhuma tag cadastrada'}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {filteredTags?.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 group"
            >
              {editingId === tag.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    className="h-7 w-32 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateTag.isPending}
                    className="p-1 rounded-full hover:bg-green-100 text-green-600 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4 text-primary" />
                  <span 
                    className="text-foreground cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleStartEdit(tag)}
                  >
                    {tag.name}
                  </span>
                  <button
                    onClick={() => handleStartEdit(tag)}
                    className="p-1 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setDeleteId(tag.id)}
                    className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 text-sm text-muted-foreground">
        Total: {tags?.length || 0} tags
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tag será removida de todos os produtos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTags;
