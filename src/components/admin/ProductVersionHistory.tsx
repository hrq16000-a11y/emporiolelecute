import { useMemo, useState } from 'react';
import { History, RotateCcw, Loader2, ArrowRight, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  fieldLabel,
  formatFieldValue,
  useProductVersions,
  useRevertProductVersion,
  type ProductVersion,
} from '@/hooks/useProductVersions';

interface Props {
  productId: string;
}

const IGNORED = new Set(['id', 'created_at', 'updated_at', 'search_text']);

/**
 * Trilha de auditoria do produto: lista as versões, mostra o diff campo a campo
 * entre a versão selecionada e a anterior e permite reverter (tudo ou 1 campo).
 */
export default function ProductVersionHistory({ productId }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: versions = [], isLoading } = useProductVersions(open ? productId : null);
  const revert = useRevertProductVersion();
  const { toast } = useToast();

  const selectedIndex = useMemo(
    () => versions.findIndex((v) => v.id === (selectedId ?? versions[0]?.id)),
    [versions, selectedId],
  );
  const current: ProductVersion | undefined = versions[selectedIndex === -1 ? 0 : selectedIndex];
  const previous: ProductVersion | undefined = versions[(selectedIndex === -1 ? 0 : selectedIndex) + 1];

  const diff = useMemo(() => {
    if (!current) return [] as { key: string; before: unknown; after: unknown }[];
    const keys = current.changed_fields.length
      ? current.changed_fields
      : Object.keys(current.snapshot);
    return keys
      .filter((k) => !IGNORED.has(k))
      .map((key) => ({
        key,
        before: previous?.snapshot?.[key],
        after: current.snapshot?.[key],
      }));
  }, [current, previous]);

  const handleRevert = async (fields?: string[]) => {
    if (!current) return;
    try {
      await revert.mutateAsync({ versionId: current.id, fields });
      toast({
        title: 'Versão restaurada',
        description: fields?.length
          ? `Campo "${fieldLabel(fields[0])}" revertido para a versão ${current.version}.`
          : `Produto revertido para a versão ${current.version}.`,
      });
    } catch (e) {
      toast({
        title: 'Não foi possível reverter',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <History className="w-4 h-4 mr-1.5" />
          Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">Histórico de alterações</DialogTitle>
          <DialogDescription>
            Compare as versões campo a campo e restaure rapidamente o que precisar.
          </DialogDescription>
          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={versions.length === 0}
              onClick={() => exportVersionsCsv(productId, versions)}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Exportar CSV
            </Button>
          </div>
        </DialogHeader>


        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico…
          </div>
        ) : versions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma versão registrada ainda. As próximas edições aparecerão aqui.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 min-h-0 flex-1">
            <ScrollArea className="max-h-[55vh] border rounded-lg">
              <ul className="divide-y">
                {versions.map((v) => {
                  const active = current?.id === v.id;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(v.id)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 min-h-[44px] transition-colors',
                          active ? 'bg-primary/10' : 'hover:bg-muted/60',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={active ? 'default' : 'secondary'}>v{v.version}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(v.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {v.actor_email ?? 'Sistema'} • {v.changed_fields.length} campo(s)
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>

            <div className="min-w-0 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  {previous
                    ? `Comparando v${previous.version} → v${current?.version}`
                    : `Versão inicial (v${current?.version})`}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={revert.isPending}
                  onClick={() => handleRevert()}
                >
                  {revert.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                  )}
                  Restaurar esta versão
                </Button>
              </div>

              <ScrollArea className="max-h-[50vh] pr-2">
                <div className="space-y-2">
                  {diff.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem diferenças registradas.</p>
                  )}
                  {diff.map(({ key, before, after }) => (
                    <div key={key} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-medium">{fieldLabel(key)}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          disabled={revert.isPending}
                          onClick={() => handleRevert([key])}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Reverter campo
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs">
                        <span className="rounded-md bg-destructive/10 text-destructive px-2 py-1.5 break-words">
                          {formatFieldValue(before)}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mx-auto hidden sm:block" />
                        <span className="rounded-md bg-emerald-500/10 text-emerald-700 px-2 py-1.5 break-words">
                          {formatFieldValue(after)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Exporta o histórico em CSV com o diff por campo e o autor de cada mudança. */
function exportVersionsCsv(productId: string, versions: ProductVersion[]) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const header = ['versao', 'data', 'operacao', 'autor', 'campo', 'valor_anterior', 'valor_novo'];
  const lines: string[] = [header.join(';')];

  versions.forEach((v, index) => {
    const previous = versions[index + 1];
    const keys = (v.changed_fields.length ? v.changed_fields : Object.keys(v.snapshot)).filter(
      (k) => !IGNORED.has(k),
    );
    const rows = keys.length ? keys : ['—'];
    rows.forEach((key) => {
      lines.push(
        [
          v.version,
          new Date(v.created_at).toLocaleString('pt-BR'),
          v.operation,
          v.actor_email ?? 'Sistema',
          key === '—' ? '—' : fieldLabel(key),
          key === '—' ? '' : formatFieldValue(previous?.snapshot?.[key]),
          key === '—' ? '' : formatFieldValue(v.snapshot?.[key]),
        ]
          .map(escape)
          .join(';'),
      );
    });
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico-produto-${productId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
