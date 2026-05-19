// Fase 7 — Avaliações de produto + estatísticas agregadas
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductReview {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  source: string;
  source_url: string | null;
  is_verified: boolean;
  is_featured: boolean;
  review_date: string | null;
  created_at: string;
  images: string[];
  position: number;
}

export interface ProductReviewStats {
  product_id: string;
  review_count: number;
  avg_rating: number;
}

export function useProductReviews(productId?: string) {
  return useQuery({
    queryKey: ['product-reviews', productId],
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProductReview[]> => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId!)
        .eq('is_visible', true)
        // Ordem de relevância para a cliente:
        // 1) destacadas pelo admin, 2) verificadas (compra real),
        // 3) mais recentes por data, 4) fallback created_at, 5) posição manual.
        .order('is_featured', { ascending: false })
        .order('is_verified', { ascending: false })
        .order('review_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('position', { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ProductReview[];
    },
  });
}

export function useProductReviewStats(productId?: string) {
  return useQuery({
    queryKey: ['product-review-stats', productId],
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProductReviewStats | null> => {
      const { data, error } = await supabase
        .from('product_review_stats')
        .select('*')
        .eq('product_id', productId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ProductReviewStats) ?? null;
    },
  });
}
