import { useState } from 'react';
import { Menu, Plus, Trash2, Loader2, ExternalLink, FileText, ChevronDown, ChevronUp, Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useReorderMenuItems, MenuItem } from '@/hooks/useMenus';
import { usePages } from '@/hooks/usePages';
import { useDbCategories, useDbOccasions } from '@/hooks/useProducts';
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
  DialogTrigger,
} from '@/components/ui/dialog';

// Predefined site links
const staticLinks = [
  { label: 'Início', url: '/' },
  { label: 'Sobre', url: '/sobre' },
  { label: 'Produtos', url: '/produtos' },
  { label: 'Ocasiões', url: '/ocasioes' },
  { label: 'Depoimentos', url: '/depoimentos' },
  { label: 'Orçamento', url: '/orcamento' },
  { label: 'Contato', url: '/contato' },
  { label: 'Carrinho', url: '/carrinho' },
  { label: 'Rastrear Pedido', url: '/rastrear' },
  { label: 'Envio', url: '/envio' },
];

const AdminMenus = () => {
  const { data: allMenuItems, isLoading } = useMenuItems();
  const { data: pages } = usePages();
  const { data: categories } = useDbCategories();
  const { data: occasions } = useDbOccasions();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();
  const reorderMenuItems = useReorderMenuItems();
  const { toast } = useToast();

  const [activeLocation, setActiveLocation] = useState<'header' | 'footer'>('header');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  
  const [newItem, setNewItem] = useState({
    label: '',
    url: '',
    page_id: '',
    is_external: false,
  });

  const menuItems = allMenuItems?.filter(item => item.menu_location === activeLocation) || [];

  // Generate dynamic links from categories and occasions
  const categoryLinks = (categories || []).map(c => ({
    label: `Categoria: ${c.name}`,
    url: `/produtos?categoria=${c.slug}`,
  }));

  const occasionLinks = (occasions || []).map(o => ({
    label: `Ocasião: ${o.name}`,
    url: `/produtos?ocasiao=${o.slug}`,
  }));

  const pageLinks = (pages || []).filter(p => p.status === 'published').map(p => ({
    label: `Página: ${p.title}`,
    url: `/${p.slug}`,
  }));

  const allSuggestedLinks = [...staticLinks, ...categoryLinks, ...occasionLinks, ...pageLinks];

  const handleCreate = async () => {
    if (!newItem.label) {
      toast({ title: 'Informe o label do item', variant: 'destructive' });
      return;
    }

    if (!newItem.url && !newItem.page_id) {
      toast({ title: 'Informe uma URL ou selecione uma página', variant: 'destructive' });
      return;
    }

    try {
      const nextPosition = Math.max(...(menuItems.map(m => m.position) || [0]), 0) + 1;
      
      await createMenuItem.mutateAsync({
        menu_location: activeLocation,
        label: newItem.label,
        url: newItem.page_id ? null : newItem.url,
        page_id: newItem.page_id || null,
        is_external: newItem.is_external,
        is_visible: true,
        position: nextPosition,
        parent_id: null,
      });

      setNewItem({ label: '', url: '', page_id: '', is_external: false });
      setIsDialogOpen(false);
      toast({ title: 'Item criado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao criar item', variant: 'destructive' });
    }
  };

  const handleStartEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditUrl(item.url || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditUrl('');
  };

  const handleSaveEdit = async (item: MenuItem) => {
    if (!editLabel.trim()) {
      toast({ title: 'O label não pode estar vazio', variant: 'destructive' });
      return;
    }

    try {
      await updateMenuItem.mutateAsync({
        id: item.id,
        label: editLabel,
        url: item.page_id ? null : editUrl || null,
      });
      setEditingId(null);
      toast({ title: 'Item atualizado!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar item', variant: 'destructive' });
    }
  };

  const handleToggleVisibility = async (item: MenuItem) => {
    try {
      await updateMenuItem.mutateAsync({
        id: item.id,
        is_visible: !item.is_visible,
      });
    } catch (error) {
      toast({ title: 'Erro ao atualizar item', variant: 'destructive' });
    }
  };

  const handleToggleExternal = async (item: MenuItem) => {
    try {
      await updateMenuItem.mutateAsync({
        id: item.id,
        is_external: !item.is_external,
      });
    } catch (error) {
      toast({ title: 'Erro ao atualizar item', variant: 'destructive' });
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const sortedItems = [...menuItems].sort((a, b) => a.position - b.position);
    const updates = [
      { id: sortedItems[index].id, position: sortedItems[index - 1].position },
      { id: sortedItems[index - 1].id, position: sortedItems[index].position },
    ];
    try {
      await reorderMenuItems.mutateAsync(updates);
    } catch (error) {
      toast({ title: 'Erro ao reordenar', variant: 'destructive' });
    }
  };

  const handleMoveDown = async (index: number) => {
    const sortedItems = [...menuItems].sort((a, b) => a.position - b.position);
    if (index >= sortedItems.length - 1) return;
    const updates = [
      { id: sortedItems[index].id, position: sortedItems[index + 1].position },
      { id: sortedItems[index + 1].id, position: sortedItems[index].position },
    ];
    try {
      await reorderMenuItems.mutateAsync(updates);
    } catch (error) {
      toast({ title: 'Erro ao reordenar', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteMenuItem.mutateAsync(deleteId);
      setDeleteId(null);
      toast({ title: 'Item excluído com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao excluir item', variant: 'destructive' });
    }
  };

  const getPageByID = (pageId: string | null) => {
    if (!pageId) return null;
    return pages?.find(p => p.id === pageId);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground flex items-center gap-3">
            <Menu className="w-8 h-8 text-primary" />
            Menus
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os menus de navegação do site</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary-dark">
              <Plus className="w-4 h-4 mr-2" />
              Novo Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Item de Menu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Quick Links Section */}
              <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Links Sugeridos do Site
                    {linksOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {allSuggestedLinks.map((link, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-primary-light/50 transition-colors flex items-center justify-between group"
                        onClick={() => {
                          setNewItem({
                            label: link.label.replace(/^(Categoria|Ocasião|Página): /, ''),
                            url: link.url,
                            page_id: '',
                            is_external: link.url.startsWith('http'),
                          });
                          setLinksOpen(false);
                        }}
                      >
                        <span>{link.label}</span>
                        <span className="text-xs text-muted-foreground">{link.url}</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou preencha manualmente</span>
                </div>
              </div>

              <div>
                <Label>Label</Label>
                <Input
                  value={newItem.label}
                  onChange={(e) => setNewItem(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Texto do link"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Vincular a</Label>
                <Select
                  value={newItem.page_id}
                  onValueChange={(value) => setNewItem(prev => ({ 
                    ...prev, 
                    page_id: value === 'custom' ? '' : value,
                    url: value === 'custom' ? prev.url : ''
                  }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma página ou URL personalizada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">URL Personalizada</SelectItem>
                    {pages?.filter(p => p.status === 'published').map(page => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!newItem.page_id && (
                <div>
                  <Label>URL</Label>
                  <Input
                    value={newItem.url}
                    onChange={(e) => setNewItem(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="/pagina ou https://..."
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label>Link externo (abre em nova aba)</Label>
                <Switch
                  checked={newItem.is_external}
                  onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, is_external: checked }))}
                />
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={createMenuItem.isPending}>
                {createMenuItem.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Location tabs */}
      <Tabs value={activeLocation} onValueChange={(v) => setActiveLocation(v as 'header' | 'footer')}>
        <TabsList className="mb-6">
          <TabsTrigger value="header">Menu Principal (Header)</TabsTrigger>
          <TabsTrigger value="footer">Rodapé (Footer)</TabsTrigger>
        </TabsList>

        <TabsContent value={activeLocation}>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : menuItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                Nenhum item no menu {activeLocation === 'header' ? 'principal' : 'do rodapé'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {menuItems.sort((a, b) => a.position - b.position).map((item, index) => (
                <Card key={item.id} className="group">
                  <CardContent className="py-3">
                    {editingId === item.id ? (
                      // Inline Edit Mode
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Label</Label>
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              placeholder="Texto do link"
                              className="mt-1"
                              autoFocus
                            />
                          </div>
                          {!item.page_id && (
                            <div>
                              <Label className="text-xs">URL</Label>
                              <Input
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                placeholder="/pagina ou https://..."
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={item.is_external}
                                onCheckedChange={() => handleToggleExternal(item)}
                                id={`external-${item.id}`}
                              />
                              <Label htmlFor={`external-${item.id}`} className="text-xs">Externo</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={item.is_visible}
                                onCheckedChange={() => handleToggleVisibility(item)}
                                id={`visible-${item.id}`}
                              />
                              <Label htmlFor={`visible-${item.id}`} className="text-xs">Visível</Label>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(item)}
                              disabled={updateMenuItem.isPending}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Salvar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Display Mode
                      <div className="flex items-center gap-4">
                        {/* Reorder Buttons */}
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === menuItems.length - 1}
                            className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 cursor-pointer" onClick={() => handleStartEdit(item)}>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${item.is_visible ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                              {item.label}
                            </span>
                            {item.is_external && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                            {item.page_id && <FileText className="w-3 h-3 text-primary" />}
                            <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.page_id ? `→ /${getPageByID(item.page_id)?.slug || 'página'}` : item.url}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_visible}
                            onCheckedChange={() => handleToggleVisibility(item)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
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

export default AdminMenus;