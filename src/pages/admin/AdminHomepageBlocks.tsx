import SingleImageUpload from '@/components/admin/SingleImageUpload';
import { useState } from 'react';
import { Loader2, LayoutGrid, Save, Eye, EyeOff, Image, Link, Type, FileText, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  useAdminHomepageBlocks, 
  useUpdateHomepageBlock,
  useCreateHomepageBlock,
  useDeleteHomepageBlock,
  HomepageBlock 
} from '@/hooks/useHomepageBlocks';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const blockTypeLabels: Record<string, string> = {
  section: 'Seções da Home',
  category: 'Categorias',
  about: 'Sobre Nós',
  hero: 'Hero/Banner',
  testimonial: 'Depoimentos',
  custom: 'Personalizado',
};

const AdminHomepageBlocks = () => {
  const { data: blocks, isLoading } = useAdminHomepageBlocks();
  const updateBlock = useUpdateHomepageBlock();
  const createBlock = useCreateHomepageBlock();
  const deleteBlock = useDeleteHomepageBlock();
  const { toast } = useToast();

  const [editingBlock, setEditingBlock] = useState<HomepageBlock | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBlockType, setNewBlockType] = useState('custom');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (block: HomepageBlock) => {
    setIsSaving(true);
    try {
      await updateBlock.mutateAsync({
        id: block.id,
        title: block.title,
        subtitle: block.subtitle,
        description: block.description,
        image_url: block.image_url,
        link_url: block.link_url,
        link_text: block.link_text,
        is_visible: block.is_visible,
        content: block.content,
      });
      toast({ title: 'Bloco atualizado com sucesso!' });
      setEditingBlock(null);
    } catch (error) {
      console.error('Error updating block:', error);
      toast({ title: 'Erro ao atualizar bloco', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisibility = async (block: HomepageBlock) => {
    try {
      await updateBlock.mutateAsync({
        id: block.id,
        is_visible: !block.is_visible,
      });
      toast({ title: block.is_visible ? 'Bloco ocultado' : 'Bloco visível' });
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({ title: 'Erro ao alterar visibilidade', variant: 'destructive' });
    }
  };

  const handleCreateBlock = async () => {
    try {
      await createBlock.mutateAsync({
        block_key: `custom_${Date.now()}`,
        block_type: newBlockType,
        title: 'Novo Bloco',
        subtitle: null,
        description: null,
        image_url: null,
        link_url: null,
        link_text: null,
        position: (blocks?.length || 0) + 1,
        is_visible: false,
        content: {},
      });
      toast({ title: 'Bloco criado com sucesso!' });
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating block:', error);
      toast({ title: 'Erro ao criar bloco', variant: 'destructive' });
    }
  };

  const handleDeleteBlock = async () => {
    if (!blockToDelete) return;
    try {
      await deleteBlock.mutateAsync(blockToDelete);
      toast({ title: 'Bloco excluído com sucesso!' });
      setBlockToDelete(null);
    } catch (error) {
      console.error('Error deleting block:', error);
      toast({ title: 'Erro ao excluir bloco', variant: 'destructive' });
    }
  };

  // Group blocks by type
  const blocksByType = blocks?.reduce((acc, block) => {
    if (!acc[block.block_type]) acc[block.block_type] = [];
    acc[block.block_type].push(block);
    return acc;
  }, {} as Record<string, HomepageBlock[]>) || {};

  if (isLoading) {
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
            <LayoutGrid className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">CMS</span>
          </div>
          <h1 className="text-4xl font-display font-semibold text-foreground">Blocos da Homepage</h1>
          <p className="text-muted-foreground mt-2">Edite os blocos de conteúdo exibidos na página inicial</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Bloco
        </Button>
      </div>

      {/* Tabs by block type */}
      <Tabs defaultValue="category" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          {Object.keys(blocksByType).map((type) => (
            <TabsTrigger key={type} value={type} className="capitalize">
              {blockTypeLabels[type] || type}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(blocksByType).map(([type, typeBlocks]) => (
          <TabsContent key={type} value={type} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {typeBlocks.map((block) => (
                <Card key={block.id} className={`border-0 shadow-lg transition-opacity ${!block.is_visible ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {block.title}
                          {!block.is_visible && (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono mt-1">
                          {block.block_key}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleVisibility(block)}
                          title={block.is_visible ? 'Ocultar' : 'Mostrar'}
                        >
                          {block.is_visible ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setBlockToDelete(block.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Preview Image */}
                    {block.image_url && (
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                        <img 
                          src={block.image_url} 
                          alt={block.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Quick Info */}
                    {block.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {block.description}
                      </p>
                    )}

                    {block.link_url && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        {block.link_url}
                      </p>
                    )}

                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setEditingBlock(block)}
                    >
                      Editar Bloco
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingBlock} onOpenChange={() => setEditingBlock(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Bloco: {editingBlock?.title}</DialogTitle>
          </DialogHeader>

          {editingBlock && (
            <div className="space-y-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Título
                  </Label>
                  <Input
                    value={editingBlock.title}
                    onChange={(e) => setEditingBlock({ ...editingBlock, title: e.target.value })}
                    placeholder="Título do bloco"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Input
                    value={editingBlock.subtitle || ''}
                    onChange={(e) => setEditingBlock({ ...editingBlock, subtitle: e.target.value })}
                    placeholder="Subtítulo opcional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Descrição
                </Label>
                <Textarea
                  value={editingBlock.description || ''}
                  onChange={(e) => setEditingBlock({ ...editingBlock, description: e.target.value })}
                  placeholder="Descrição do bloco"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Imagem do bloco
                </Label>
                <SingleImageUpload
                  value={editingBlock.image_url || ''}
                  onChange={(url) => setEditingBlock({ ...editingBlock, image_url: url })}
                  folder="homepage-blocks"
                  hint="Recomendado 16:9 · PNG, JPG ou WEBP até 5MB"
                  previewMaxWidth={360}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    URL do Link
                  </Label>
                  <Input
                    value={editingBlock.link_url || ''}
                    onChange={(e) => setEditingBlock({ ...editingBlock, link_url: e.target.value })}
                    placeholder="/produtos ou https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Texto do Link</Label>
                  <Input
                    value={editingBlock.link_text || ''}
                    onChange={(e) => setEditingBlock({ ...editingBlock, link_text: e.target.value })}
                    placeholder="Comprar Agora"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>Visibilidade</Label>
                  <p className="text-xs text-muted-foreground">
                    Bloco visível na página inicial
                  </p>
                </div>
                <Switch
                  checked={editingBlock.is_visible}
                  onCheckedChange={(checked) => setEditingBlock({ ...editingBlock, is_visible: checked })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBlock(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => editingBlock && handleSave(editingBlock)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Bloco</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo do Bloco</Label>
              <Select value={newBlockType} onValueChange={setNewBlockType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Categoria</SelectItem>
                  <SelectItem value="about">Sobre Nós</SelectItem>
                  <SelectItem value="hero">Hero/Banner</SelectItem>
                  <SelectItem value="testimonial">Depoimento</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateBlock}>
              Criar Bloco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!blockToDelete} onOpenChange={() => setBlockToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Bloco</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este bloco? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminHomepageBlocks;
