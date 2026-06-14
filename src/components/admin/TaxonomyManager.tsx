import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check, AlertTriangle, EyeOff, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import TaxonomyForm from './TaxonomyForm';
import { evaluateSeo, hasAnyIssue, TAXONOMY_LABELS, TaxonomyEntity, TaxonomyKind } from '@/lib/taxonomy';
import { LucideIcon } from '@/components/LucideIcon';

interface Props {
  kind: TaxonomyKind;
  items: TaxonomyEntity[];
  isLoading?: boolean;
  showSeo?: boolean;
  existingSlugsByKind: Record<TaxonomyKind, Map<string, string>>;
  onCreate: (values: Partial<TaxonomyEntity>) => Promise<unknown>;
  onUpdate: (id: string, values: Partial<TaxonomyEntity>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

const TaxonomyManager = ({
  kind, items, isLoading, showSeo = true,
  existingSlugsByKind, onCreate, onUpdate, onDelete,
}: Props) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TaxonomyEntity | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));
  }, [items, search]);

  const handleSubmit = async (values: Partial<TaxonomyEntity>) => {
    setSaving(true);
    try {
      if (editing) {
        await onUpdate(editing.id, values);
        toast.success(`${TAXONOMY_LABELS[kind].singular} atualizada`);
      } else {
        await onCreate(values);
        toast.success(`${TAXONOMY_LABELS[kind].singular} criada`);
      }
      setEditing(null);
      setCreating(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (item: TaxonomyEntity, delta: number) => {
    try {
      await onUpdate(item.id, { position: (item.position ?? 0) + delta });
    } catch {
      toast.error('Erro ao reordenar');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await onDelete(deleteId);
      toast.success('Excluído');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao excluir';
      toast.error(msg);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Input
          placeholder={`Buscar ${TAXONOMY_LABELS[kind].plural.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => setCreating(true)} className="sm:ml-auto">
          <Plus className="w-4 h-4 mr-2" /> Nova
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Nenhum item</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((item) => {
                const seo = showSeo ? evaluateSeo(item) : null;
                const hasIssue = seo ? hasAnyIssue(seo) : false;
                return (
                  <li key={item.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMove(item, -1)}>
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMove(item, 1)}>
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="w-10 text-center text-xs text-muted-foreground">#{item.position ?? 0}</div>
                    {showSeo && kind === 'ocasiao' && item.icon ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary ring-1 ring-border/60">
                        <LucideIcon name={item.icon} className="h-5 w-5" />
                      </div>
                    ) : showSeo && item.image_url ? (
                      <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover bg-muted" />
                    ) : showSeo ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
                        <LucideIcon name={kind === 'ocasiao' ? 'Sparkles' : 'Image'} className="h-4 w-4" />
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{item.name}</p>
                        {showSeo && item.is_draft === true && (
                          <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
                            <FileEdit className="w-3 h-3" /> Rascunho
                          </Badge>
                        )}
                        {showSeo && item.is_indexed === false && (
                          <Badge variant="outline" className="gap-1"><EyeOff className="w-3 h-3" /> noindex</Badge>
                        )}
                        {showSeo && !hasIssue && item.is_draft !== true && (
                          <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
                            <Check className="w-3 h-3" /> SEO OK
                          </Badge>
                        )}
                        {showSeo && hasIssue && (
                          <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3" /> Atenção
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {TAXONOMY_LABELS[kind].urlPrefix}{item.slug}
                      </p>
                      {showSeo && seo && hasIssue && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          {[
                            seo.noMetaTitle && 'sem meta_title',
                            seo.shortMetaTitle && 'meta_title curto',
                            seo.noMetaDescription && 'sem meta_description',
                            seo.shortMetaDescription && 'meta_description curta',
                            seo.noImage && 'sem imagem',
                            seo.noDescription && 'sem descrição',
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) { setCreating(false); setEditing(null); }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar ${TAXONOMY_LABELS[kind].singular}` : `Nova ${TAXONOMY_LABELS[kind].singular}`}
            </DialogTitle>
          </DialogHeader>
          <TaxonomyForm
            kind={kind}
            initial={editing ?? undefined}
            existingSlugsByKind={existingSlugsByKind}
            showSeo={showSeo}
            saving={saving}
            scopeKey={`taxonomy:${kind}:${editing?.id ?? 'new'}`}
            onCancel={() => { setCreating(false); setEditing(null); }}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Produtos vinculados ficarão sem este vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaxonomyManager;
