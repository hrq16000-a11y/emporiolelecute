import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Trash2, Loader2, Search, Edit, Eye, Copy, MoreVertical, Globe, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { usePages, useDeletePage, useDuplicatePage, useUpdatePage } from '@/hooks/usePages';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const AdminPages = () => {
  const { data: pages, isLoading } = usePages();
  const deletePage = useDeletePage();
  const duplicatePage = useDuplicatePage();
  const updatePage = useUpdatePage();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deletePage.mutateAsync(deleteId);
      setDeleteId(null);
      toast({ title: 'Página excluída com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao excluir página', variant: 'destructive' });
    }
  };

  const handleDuplicate = async (page: any) => {
    try {
      await duplicatePage.mutateAsync(page);
      toast({ title: 'Página duplicada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao duplicar página', variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (page: any) => {
    const newStatus = page.status === 'published' ? 'draft' : 'published';
    try {
      await updatePage.mutateAsync({
        id: page.id,
        status: newStatus,
        published_at: newStatus === 'published' ? new Date().toISOString() : null,
      });
      toast({ 
        title: newStatus === 'published' ? 'Página publicada!' : 'Página despublicada',
        description: newStatus === 'published' 
          ? 'A página agora está visível no site.' 
          : 'A página foi movida para rascunho.'
      });
    } catch (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  const filteredPages = pages?.filter(page =>
    page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const publishedCount = pages?.filter(p => p.status === 'published').length || 0;
  const draftCount = pages?.filter(p => p.status !== 'published').length || 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Páginas
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie as páginas institucionais do site</p>
        </div>
        <Link to="/admin/paginas/nova">
          <Button className="bg-primary hover:bg-primary-dark">
            <Plus className="w-4 h-4 mr-2" />
            Nova Página
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar páginas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {/* Pages list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredPages?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'Nenhuma página encontrada' : 'Nenhuma página cadastrada'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPages?.map((page) => (
            <div
              key={page.id}
              className={`flex items-center justify-between bg-card border rounded-xl p-4 hover:shadow-md transition-all ${
                page.status === 'published' ? 'border-border' : 'border-dashed border-muted-foreground/30 opacity-75'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  page.status === 'published' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <FileText className={`w-5 h-5 ${page.status === 'published' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h3 className={`font-medium ${page.status === 'published' ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {page.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">/{page.slug}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status Toggle with Tooltip */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={page.status === 'published'}
                          onCheckedChange={() => handleToggleStatus(page)}
                          disabled={updatePage.isPending}
                        />
                        <Badge variant={page.status === 'published' ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => handleToggleStatus(page)}>
                          {page.status === 'published' ? (
                            <><Globe className="w-3 h-3 mr-1" /> Publicado</>
                          ) : (
                            <><EyeOff className="w-3 h-3 mr-1" /> Rascunho</>
                          )}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clique para {page.status === 'published' ? 'despublicar' : 'publicar'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="flex items-center gap-1">
                  <Link to={`/${page.slug}`} target="_blank">
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to={`/admin/paginas/${page.id}`}>
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleToggleStatus(page)}>
                        {page.status === 'published' ? (
                          <><ToggleLeft className="w-4 h-4 mr-2" /> Despublicar</>
                        ) : (
                          <><ToggleRight className="w-4 h-4 mr-2" /> Publicar</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(page)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteId(page.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total: {pages?.length || 0} páginas</span>
        <span className="text-primary">• {publishedCount} publicadas</span>
        <span>• {draftCount} rascunhos</span>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir página?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A página será permanentemente removida.
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

export default AdminPages;