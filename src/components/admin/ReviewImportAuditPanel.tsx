// Auditoria de import de reviews: paginação, filtros avançados, matching fuzzy
// com limiar configurável e modal de detalhes (Elo7 x Loja).
import { useMemo, useState } from 'react';
import {
  ClipboardList, Loader2, Search, Sparkles, CheckCircle2, XCircle, HelpCircle, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDbProducts, useDbCategories } from '@/hooks/useProducts';
import {
  useCommitConfirmedReviews, useReviewImportAudit, useUpdateReviewAudit, type ReviewAuditRow,
} from '@/hooks/useReviewImportAudit';
import { explainMatch, findBestMatches, classifyScore } from '@/lib/fuzzyMatch';
import FuzzyMatchExplanation from '@/components/admin/FuzzyMatchExplanation';


const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  doubtful: 'Duvidoso',
  rejected: 'Rejeitado',
  no_match: 'Sem match',
};

const statusVariant = (s: string) =>
  s === 'confirmed' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary';

const PAGE_SIZE = 20;

export default function ReviewImportAuditPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState('all');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [importedOnly, setImportedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [threshold, setThreshold] = useState(0.45);
  const [detail, setDetail] = useState<ReviewAuditRow | null>(null);

  const { data, isLoading } = useReviewImportAudit({
    status, categoryId, search, importedOnly, page, pageSize: PAGE_SIZE,
  });
  const { data: products = [] } = useDbProducts();
  const { data: categories = [] } = useDbCategories();
  const update = useUpdateReviewAudit();
  const commit = useCommitConfirmedReviews();

  const candidates = useMemo(
    () => products.map((p) => ({ item: p, label: p.name as string })),
    [products],
  );

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  const productName = (id?: string | null) =>
    products.find((p) => p.id === id)?.name ?? null;

  const handleAutoMatch = async (row: ReviewAuditRow) => {
    const source = row.elo7_product_name ?? row.elo7_product_slug ?? '';
    const [best] = findBestMatches(source, candidates, { threshold, limit: 1 });
    if (!best) {
      await update.mutateAsync({ id: row.id, manual_status: 'no_match', suggested_confidence: 0 });
      toast({ title: 'Nenhum candidato acima do limiar', description: `Limiar atual: ${threshold.toFixed(2)}` });
      return;
    }
    await update.mutateAsync({
      id: row.id,
      suggested_product_id: best.item.id,
      suggested_product_name: best.label,
      suggested_confidence: Number(best.explanation.score.toFixed(4)),
      suggested_method: `fuzzy(dice+tokens) t=${threshold.toFixed(2)}`,
      visual_notes: best.explanation.reason,
      manual_status: classifyScore(best.explanation.score, threshold),
    });
    toast({ title: `Match sugerido: ${best.label}`, description: best.explanation.reason });
  };

  const handleCommit = async () => {
    const confirmed = rows.filter((r) => r.manual_status === 'confirmed');
    if (confirmed.length === 0) {
      toast({ title: 'Nada a importar', description: 'Nenhuma review confirmada nesta página.' });
      return;
    }
    const result = await commit.mutateAsync(confirmed);
    toast({
      title: `Import concluído: ${result.imported} nova(s)`,
      description: `${result.skipped} já existiam (idempotente)${
        result.errors.length ? ` · ${result.errors.length} erro(s)` : ''
      }`,
      variant: result.errors.length ? 'destructive' : undefined,
    });
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> Auditoria de import (Elo7)
            </h2>
            <p className="text-sm text-muted-foreground">
              Matching fuzzy com limiar configurável, revisão manual e import idempotente.
            </p>
          </div>
          <Button onClick={handleCommit} disabled={commit.isPending}>
            {commit.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Importar confirmadas
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="produto, comentário, comprador…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Categoria do produto</Label>
            <Select
              value={categoryId ?? 'all'}
              onValueChange={(v) => { setCategoryId(v === 'all' ? undefined : v); setPage(0); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Limiar do match: {threshold.toFixed(2)}</Label>
            <Slider
              className="mt-3"
              value={[threshold]}
              min={0.2}
              max={0.9}
              step={0.05}
              onValueChange={([v]) => setThreshold(v)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Button
            type="button"
            size="sm"
            variant={importedOnly ? 'default' : 'outline'}
            onClick={() => { setImportedOnly((v) => !v); setPage(0); }}
          >
            Somente já importadas
          </Button>
          <span className="text-muted-foreground">{data?.count ?? 0} registro(s)</span>
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando auditoria…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum registro de import encontrado com esses filtros.
          </p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {rows.map((row) => {
              const target = productName(row.manual_product_id ?? row.suggested_product_id);
              const explanation = target
                ? explainMatch(row.elo7_product_name ?? '', target)
                : null;
              return (
                <li key={row.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={statusVariant(row.manual_status)}>
                        {STATUS_LABEL[row.manual_status]}
                      </Badge>
                      {row.imported_review_id && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-600/40">
                          importada
                        </Badge>
                      )}
                      <span className="text-sm font-medium truncate">
                        {row.elo7_product_name ?? row.feedback_id}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      → {target ?? 'sem produto vinculado'}
                      {explanation ? ` · ${(explanation.score * 100).toFixed(0)}% — ${explanation.reason}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleAutoMatch(row)}>
                      <Sparkles className="h-4 w-4 mr-1.5" /> Sugerir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ id: row.id, manual_status: 'confirmed' })}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ id: row.id, manual_status: 'doubtful' })}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ id: row.id, manual_status: 'rejected' })}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDetail(row)}>
                      Detalhes
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </CardContent>

      <ReviewAuditDetailDialog
        row={detail}
        onClose={() => setDetail(null)}
        productName={productName}
        candidates={candidates}
        threshold={threshold}
        onLink={(productId, note) =>
          detail &&
          update.mutate({
            id: detail.id,
            manual_product_id: productId,
            visual_notes: note,
            manual_status: 'confirmed',
          })
        }
      />
    </Card>
  );
}

interface DetailProps {
  row: ReviewAuditRow | null;
  onClose: () => void;
  productName: (id?: string | null) => string | null;
  candidates: { item: { id: string; name: string }; label: string }[];
  threshold: number;
  onLink: (productId: string, note: string) => void;
}

function ReviewAuditDetailDialog({ row, onClose, productName, candidates, threshold, onLink }: DetailProps) {
  const matches = useMemo(
    () => (row ? findBestMatches(row.elo7_product_name ?? '', candidates, { threshold, limit: 5 }) : []),
    [row, candidates, threshold],
  );
  if (!row) return null;

  const storeName = productName(row.manual_product_id ?? row.suggested_product_id);
  const log = Array.isArray((row.elo7_raw as { import_log?: unknown[] })?.import_log)
    ? ((row.elo7_raw as { import_log: Record<string, string>[] }).import_log)
    : [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Detalhes da review auditada</DialogTitle>
          <DialogDescription>Comparativo Elo7 × Loja, histórico e candidatos de match.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Elo7 (origem)</h3>
            {row.elo7_image_url && (
              <img
                src={row.elo7_image_url}
                alt={`Foto enviada na avaliação de ${row.elo7_product_name ?? 'produto'}`}
                className="w-full max-h-56 object-contain rounded-lg border bg-muted"
                loading="lazy"
              />
            )}
            <dl className="text-sm space-y-1">
              <div><dt className="text-xs text-muted-foreground">Produto</dt><dd>{row.elo7_product_name ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Comprador</dt><dd>{row.elo7_buyer_name ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Data</dt><dd>{row.elo7_review_date ? new Date(row.elo7_review_date).toLocaleDateString('pt-BR') : '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Comentário</dt><dd className="whitespace-pre-wrap">{row.elo7_comment ?? '—'}</dd></div>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Loja (destino)</h3>
            <dl className="text-sm space-y-1">
              <div><dt className="text-xs text-muted-foreground">Produto vinculado</dt><dd>{storeName ?? 'nenhum'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Método</dt><dd>{row.suggested_method ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Confiança</dt><dd>{row.suggested_confidence != null ? `${(Number(row.suggested_confidence) * 100).toFixed(0)}%` : '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Explicação</dt><dd>{row.visual_notes ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Review importada</dt><dd>{row.imported_review_id ?? 'ainda não importada'}</dd></div>
            </dl>

            <h4 className="text-sm font-semibold pt-2">Candidatos (limiar {threshold.toFixed(2)})</h4>
            <ul className="space-y-1.5">
              {matches.length === 0 && (
                <li className="text-xs text-muted-foreground">Nenhum candidato acima do limiar.</li>
              )}
              {matches.map((m) => (
                <li key={m.item.id} className="flex items-center gap-2 justify-between text-xs border rounded-md p-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.label}</p>
                    <p className="text-muted-foreground">{(m.explanation.score * 100).toFixed(0)}% · {m.explanation.reason}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onLink(m.item.id, m.explanation.reason)}>
                    Vincular
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="pt-2">
          <h3 className="mb-2 text-sm font-semibold">Como o match foi calculado</h3>
          {matches[0] || storeName ? (
            <FuzzyMatchExplanation
              source={row.elo7_product_name ?? ''}
              target={storeName ?? matches[0]?.label ?? ''}
              explanation={explainMatch(row.elo7_product_name ?? '', storeName ?? matches[0]?.label ?? '')}
              threshold={threshold}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem produto vinculado nem candidato — nada a comparar.
            </p>
          )}
        </section>


        <section className="pt-2">
          <h3 className="text-sm font-semibold mb-1">Histórico</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>Criado em {new Date(row.created_at).toLocaleString('pt-BR')} · lote {row.import_batch_id.slice(0, 8)}</li>
            {row.reviewed_at && (
              <li>Revisado em {new Date(row.reviewed_at).toLocaleString('pt-BR')} por {row.reviewed_by_email ?? '—'}</li>
            )}
            {log.map((entry, i) => (
              <li key={i}>
                {entry.at ? new Date(entry.at).toLocaleString('pt-BR') : '—'} · {entry.action} por {entry.actor}
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
