import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Eye, EyeOff, ExternalLink, Scale, Loader2, ArrowUp, ArrowDown, ArrowUpDown, X, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useDbProducts, useDeleteProduct, useUpdateProduct } from '@/hooks/useProducts';
import { urls } from '@/lib/urls';

const AdminProducts = () => {
  const { data: products, isLoading } = useDbProducts();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillKg, setBackfillKg] = useState('0.150');
  const [backfilling, setBackfilling] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const productsWithoutWeight = products?.filter((p: any) => !p.weight || p.weight <= 0).length || 0;

  type SortKey = 'name' | 'price' | 'tags' | 'status';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
  };

  const sortLabels: Record<SortKey, { asc: string; desc: string }> = {
    name: { asc: 'Nome A→Z', desc: 'Nome Z→A' },
    price: { asc: 'Menor preço', desc: 'Maior preço' },
    tags: { asc: 'Menos tags', desc: 'Mais tags' },
    status: { asc: 'Inativos primeiro', desc: 'Ativos primeiro' },
  };

  const runBackfill = async () => {
    const kg = parseFloat(backfillKg.replace(',', '.'));
    if (!kg || kg <= 0 || kg > 30) {
      toast({ title: 'Peso inválido', description: 'Use um valor entre 0.001 e 30 kg', variant: 'destructive' });
      return;
    }
    setBackfilling(true);
    try {
      const { data, error } = await (supabase as any).rpc('apply_default_weight', { _default_kg: kg });
      if (error) throw error;
      toast({
        title: 'Backfill concluído',
        description: `${data?.updated ?? 0} produto(s) atualizado(s) com ${kg} kg.`,
      });
      setBackfillOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro no backfill', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setBackfilling(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const base = products?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) ?? [];
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      switch (sortKey) {
        case 'price':
          return ((a.price ?? 0) - (b.price ?? 0)) * dir;
        case 'tags':
          return ((a.keywords?.length ?? 0) - (b.keywords?.length ?? 0)) * dir;
        case 'status':
          return ((a.is_active ? 1 : 0) - (b.is_active ? 1 : 0)) * dir;
        case 'name':
        default:
          return a.name.localeCompare(b.name, 'pt-BR') * dir;
      }
    });
    return sorted;
  }, [products, search, sortKey, sortDir]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct.mutateAsync(deleteId);
      toast({ title: 'Produto excluído com sucesso!' });
    } catch {
      toast({ title: 'Erro ao excluir produto', variant: 'destructive' });
    }
    setDeleteId(null);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateProduct.mutateAsync({ id, is_active: !isActive });
      toast({ title: isActive ? 'Produto desativado' : 'Produto ativado' });
    } catch {
      toast({ title: 'Erro ao atualizar produto', variant: 'destructive' });
    }
  };

  const visibleIds = useMemo(() => filteredProducts.map((p) => p.id), [filteredProducts]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const runBulk = async (fn: (id: string) => Promise<unknown>, successMsg: string) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map(fn));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    setBulkBusy(false);
    clearSelection();
    if (fail === 0) toast({ title: successMsg, description: `${ok} produto(s) atualizado(s).` });
    else toast({ title: 'Concluído com erros', description: `${ok} ok, ${fail} falha(s).`, variant: 'destructive' });
  };

  const handleBulkActivate = () =>
    runBulk((id) => updateProduct.mutateAsync({ id, is_active: true }), 'Produtos ativados');
  const handleBulkDeactivate = () =>
    runBulk((id) => updateProduct.mutateAsync({ id, is_active: false }), 'Produtos desativados');
  const handleBulkDelete = async () => {
    await runBulk((id) => deleteProduct.mutateAsync(id), 'Produtos excluídos');
    setBulkDeleteOpen(false);
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Produtos</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Gerencie todos os produtos da loja</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <Button variant="outline" onClick={() => setBackfillOpen(true)} className="w-full sm:w-auto justify-center">
            <Scale className="w-4 h-4 mr-2" />
            Backfill peso{productsWithoutWeight > 0 ? ` (${productsWithoutWeight})` : ''}
          </Button>
          <Button asChild className="w-full sm:w-auto justify-center">
            <Link to="/admin/produtos/novo">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Link>
          </Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-3 sm:p-6">
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-xs text-muted-foreground hidden sm:inline">Ordenar:</span>
              <Select value={sortKey} onValueChange={(v) => { setSortKey(v as SortKey); setSortDir('asc'); }}>
                <SelectTrigger className="h-10 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="price">Preço</SelectItem>
                  <SelectItem value="tags">Tags</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                title={sortLabels[sortKey][sortDir === 'asc' ? 'desc' : 'asc']}
              >
                {sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                <span className="ml-1 text-xs hidden sm:inline">{sortLabels[sortKey][sortDir]}</span>
              </Button>
            </div>
          </div>

          {/* Barra de ações em massa */}
          {selected.size > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 sticky top-2 z-10 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckSquare className="w-4 h-4 text-primary" />
                {selected.size} selecionado(s)
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <Button size="sm" variant="outline" onClick={handleBulkActivate} disabled={bulkBusy}>
                  <Eye className="w-4 h-4 mr-1" /> Ativar
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkDeactivate} disabled={bulkBusy}>
                  <EyeOff className="w-4 h-4 mr-1" /> Desativar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={bulkBusy}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkBusy} aria-label="Limpar seleção">
                  <X className="w-4 h-4" />
                </Button>
                {bulkBusy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          )}


          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <>
              {/* MOBILE: lista em cards verticais */}
              <ul className="md:hidden space-y-3">
                {filteredProducts.map((product) => (
                  <li
                    key={product.id}
                    className={`rounded-xl border ${selected.has(product.id) ? 'border-primary bg-primary/5' : 'border-border bg-card'} p-3 flex gap-3`}
                  >
                    <div className="pt-1">
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggleSelected(product.id)}
                        aria-label={`Selecionar ${product.name}`}
                      />
                    </div>
                    <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted">
                      {product.images[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-contain p-1"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/admin/produtos/${product.id}`}
                          className="font-medium text-sm leading-snug line-clamp-2 hover:text-primary"
                        >
                          {product.name}
                        </Link>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            product.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {product.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 mt-0.5">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </p>
                      {product.keywords && product.keywords.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                          {product.keywords.slice(0, 3).join(' · ')}
                          {product.keywords.length > 3 && ` +${product.keywords.length - 3}`}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-2 -ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-xs"
                          onClick={() => handleToggleActive(product.id, product.is_active)}
                        >
                          {product.is_active ? (
                            <><EyeOff className="w-4 h-4 mr-1" /> Ocultar</>
                          ) : (
                            <><Eye className="w-4 h-4 mr-1" /> Ativar</>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" asChild>
                          <Link to={`/admin/produtos/${product.id}`}>
                            <Pencil className="w-4 h-4 mr-1" /> Editar
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 px-2" asChild>
                          <a
                            href={urls.product(product.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Abrir no site"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-destructive hover:text-destructive ml-auto"
                          onClick={() => setDeleteId(product.id)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* DESKTOP/TABLET: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead className="w-16">Imagem</TableHead>
                      <TableHead>
                        <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                          Nome <SortIcon k="name" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => toggleSort('price')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                          Preço <SortIcon k="price" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => toggleSort('tags')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                          Tags <SortIcon k="tags" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                          Status <SortIcon k="status" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} data-state={selected.has(product.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(product.id)}
                            onCheckedChange={() => toggleSelected(product.id)}
                            aria-label={`Selecionar ${product.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                            {product.images[0] && (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-contain p-1"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product.name}</span>
                            <a
                              href={urls.product(product.slug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Abrir produto em nova aba"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          R$ {product.price.toFixed(2).replace('.', ',')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {product.keywords && product.keywords.length > 0 ? (
                              product.keywords.slice(0, 3).map((keyword, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                                >
                                  {keyword}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem tags</span>
                            )}
                            {product.keywords && product.keywords.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{product.keywords.length - 3}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              product.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {product.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(product.id, product.is_active)}
                              title={product.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {product.is_active ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/admin/produtos/${product.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(product.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Nenhum produto encontrado</p>
              <Button asChild>
                <Link to="/admin/produtos/novo">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeiro produto
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>


      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
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

      <AlertDialog open={backfillOpen} onOpenChange={(o) => !backfilling && setBackfillOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" /> Backfill de peso padrão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Aplica o peso informado a todos os produtos ativos sem peso (atualmente{' '}
              <strong>{productsWithoutWeight}</strong>). Use para evitar erros no cálculo de frete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Peso padrão (kg)</label>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              max="30"
              value={backfillKg}
              onChange={(e) => setBackfillKg(e.target.value)}
              disabled={backfilling}
            />
            <p className="text-xs text-muted-foreground">Sugerido: 0.150 kg para sabonetes pequenos.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={backfilling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runBackfill(); }} disabled={backfilling}>
              {backfilling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aplicando...</> : 'Aplicar peso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProducts;
