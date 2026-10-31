// Auditoria de import de reviews (Elo7 → catálogo da loja)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReviewAuditRow {
  id: string;
  import_batch_id: string;
  feedback_id: string;
  elo7_product_name: string | null;
  elo7_product_slug: string | null;
  elo7_image_url: string | null;
  elo7_comment: string | null;
  elo7_sentiment: string | null;
  elo7_review_date: string | null;
  elo7_buyer_name: string | null;
  elo7_raw: Record<string, unknown>;
  suggested_product_id: string | null;
  suggested_product_name: string | null;
  suggested_confidence: number | null;
  suggested_method: string | null;
  manual_status: 'pending' | 'confirmed' | 'doubtful' | 'rejected' | 'no_match';
  manual_product_id: string | null;
  visual_notes: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  imported_review_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewAuditFilters {
  status?: string;
  categoryId?: string;
  search?: string;
  importedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

const table = () => supabase.from('review_import_audit' as never);

/** Lista paginada com filtros por status, categoria do produto e texto livre. */
export function useReviewImportAudit(filters: ReviewAuditFilters = {}) {
  const { status, categoryId, search, importedOnly, page = 0, pageSize = 20 } = filters;

  return useQuery({
    queryKey: ['review-import-audit', filters],
    staleTime: 30_000,
    queryFn: async (): Promise<{ rows: ReviewAuditRow[]; count: number }> => {
      let productIds: string[] | null = null;
      if (categoryId) {
        const { data: prods } = await supabase
          .from('products')
          .select('id')
          .eq('category_id', categoryId);
        productIds = (prods ?? []).map((p) => p.id);
        if (productIds.length === 0) return { rows: [], count: 0 };
      }

      let q = table()
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (status && status !== 'all') q = q.eq('manual_status', status);
      if (importedOnly) q = q.not('imported_review_id', 'is', null);
      if (search) {
        const s = `%${search}%`;
        q = q.or(
          `elo7_product_name.ilike.${s},elo7_comment.ilike.${s},elo7_buyer_name.ilike.${s},suggested_product_name.ilike.${s}`,
        );
      }
      if (productIds) {
        const list = `(${productIds.join(',')})`;
        q = q.or(`manual_product_id.in.${list},suggested_product_id.in.${list}`);
      }

      const from = page * pageSize;
      const { data, error, count } = await q.range(from, from + pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as ReviewAuditRow[], count: count ?? 0 };
    },
  });
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['review-import-audit'] });
  qc.invalidateQueries({ queryKey: ['admin-reviews'] });
  qc.invalidateQueries({ queryKey: ['product-reviews'] });
};

/** Atualiza status / produto vinculado / notas da linha auditada. */
export function useUpdateReviewAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ReviewAuditRow> & { id: string }) => {
      const { id, ...rest } = payload;
      const { data: session } = await supabase.auth.getUser();
      const { error } = await table()
        .update({
          ...rest,
          reviewed_by: session.user?.id ?? null,
          reviewed_by_email: session.user?.email ?? null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export interface CommitResult {
  imported: number;
  skipped: number;
  errors: { feedback_id: string; message: string }[];
}

/**
 * Import idempotente das reviews confirmadas.
 * Pré-valida duplicidade por `external_review_id` (= feedback_id do Elo7) e
 * registra o log do commit em `elo7_raw.import_log`.
 */
export function useCommitConfirmedReviews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ReviewAuditRow[]): Promise<CommitResult> => {
      const result: CommitResult = { imported: 0, skipped: 0, errors: [] };
      const { data: session } = await supabase.auth.getUser();
      const actor = session.user?.email ?? 'sistema';

      for (const row of rows) {
        const productId = row.manual_product_id ?? row.suggested_product_id;
        if (!productId) {
          result.errors.push({ feedback_id: row.feedback_id, message: 'sem produto vinculado' });
          continue;
        }

        try {
          // 1) pré-validação de duplicidade
          const { data: existing } = await supabase
            .from('product_reviews')
            .select('id')
            .eq('external_review_id', row.feedback_id)
            .maybeSingle();

          let reviewId = existing?.id ?? null;
          let action: 'skipped' | 'imported' = 'skipped';

          if (!reviewId) {
            const { data: inserted, error } = await supabase
              .from('product_reviews')
              .insert({
                product_id: productId,
                author_name: row.elo7_buyer_name || 'Cliente Elo7',
                rating: row.elo7_sentiment === 'negative' ? 3 : 5,
                comment: row.elo7_comment,
                source: 'elo7',
                external_review_id: row.feedback_id,
                is_verified: true,
                is_visible: true,
                review_date: row.elo7_review_date,
              } as never)
              .select('id')
              .maybeSingle();
            if (error) throw error;
            reviewId = inserted?.id ?? null;
            action = 'imported';
          }

          const log = Array.isArray((row.elo7_raw as { import_log?: unknown })?.import_log)
            ? ((row.elo7_raw as { import_log: unknown[] }).import_log as unknown[])
            : [];

          await table()
            .update({
              imported_review_id: reviewId,
              elo7_raw: {
                ...(row.elo7_raw ?? {}),
                import_log: [
                  ...log,
                  { at: new Date().toISOString(), actor, action, product_id: productId, review_id: reviewId },
                ],
              },
            } as never)
            .eq('id', row.id);

          if (action === 'imported') result.imported += 1;
          else result.skipped += 1;
        } catch (e) {
          result.errors.push({
            feedback_id: row.feedback_id,
            message: e instanceof Error ? e.message : 'erro desconhecido',
          });
        }
      }

      return result;
    },
    onSuccess: () => invalidate(qc),
  });
}
