import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductVersion {
  id: string;
  product_id: string;
  version: number;
  operation: string;
  snapshot: Record<string, unknown>;
  changed_fields: string[];
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
}

/** Histórico de versões de um produto (trilha de auditoria por campo). */
export function useProductVersions(productId?: string | null) {
  return useQuery({
    queryKey: ['product_versions', productId],
    enabled: !!productId,
    staleTime: 30_000,
    queryFn: async (): Promise<ProductVersion[]> => {
      const { data, error } = await supabase
        .from('product_versions' as never)
        .select('*')
        .eq('product_id', productId as string)
        .order('version', { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as ProductVersion[]).map((v) => ({
        ...v,
        changed_fields: Array.isArray(v.changed_fields) ? v.changed_fields : [],
      }));
    },
  });
}

/** Reverte o produto para uma versão anterior (todos os campos ou apenas alguns). */
export function useRevertProductVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, fields }: { versionId: string; fields?: string[] }) => {
      const { data, error } = await supabase.rpc('revert_product_version' as never, {
        _version_id: versionId,
        _fields: fields && fields.length > 0 ? fields : null,
      } as never);
      if (error) throw error;
      return data as { ok: boolean; product_id: string; from_version: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-by-id-or-slug'] });
      qc.invalidateQueries({ queryKey: ['product_versions', data?.product_id] });
    },
  });
}

export const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  slug: 'Slug',
  description: 'Descrição',
  price: 'Preço',
  images: 'Imagens',
  is_active: 'Ativo',
  category_id: 'Categoria',
  personalization_options: 'Condições de personalização',
  meta_title: 'Meta título',
  meta_description: 'Meta descrição',
  stock: 'Estoque',
  min_quantity: 'Quantidade mínima',
  weight: 'Peso',
};

export const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? `${value.length} item(ns)` : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}
