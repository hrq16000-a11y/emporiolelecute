import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbSegment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1_override: string | null;
  description_seo: string | null;
  is_indexed: boolean;
  is_draft?: boolean | null;
  position: number;
  created_at: string;
  updated_at: string;
}

// `publicOnly` (default false) aplica trava SAFE Bloco 3 (is_draft=false AND is_indexed=true).
// Componentes públicos DEVEM passar publicOnly:true. Admin consome sem flag.
export function useSegments(opts?: { publicOnly?: boolean }) {
  const publicOnly = opts?.publicOnly === true;
  return useQuery({
    queryKey: ['segments', publicOnly ? 'public' : 'all'],
    queryFn: async () => {
      let q = supabase
        .from('segments')
        .select('*')
        .order('position', { ascending: true })
        .order('name', { ascending: true });
      if (publicOnly) q = q.eq('is_draft', false).eq('is_indexed', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DbSegment[];
    },
  });
}

export function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seg: Partial<DbSegment> & { name: string; slug: string }) => {
      const { data, error } = await supabase.from('segments').insert(seg as any).select().single();
      if (error) throw error;
      return data as DbSegment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segments'] }),
  });
}

export function useUpdateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<DbSegment> & { id: string }) => {
      const { data, error } = await supabase
        .from('segments')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbSegment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segments'] }),
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('segments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segments'] }),
  });
}

export function useUpdateProductSegments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, segmentIds }: { productId: string; segmentIds: string[] }) => {
      const { error: delErr } = await supabase
        .from('product_segments')
        .delete()
        .eq('product_id', productId);
      if (delErr) throw delErr;

      if (segmentIds.length > 0) {
        const { error: insErr } = await supabase
          .from('product_segments')
          .insert(segmentIds.map((segment_id) => ({ product_id: productId, segment_id })));
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}
