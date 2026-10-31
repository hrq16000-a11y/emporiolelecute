import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WishlistShare {
  id: string;
  user_id: string;
  token: string;
  title: string | null;
  is_public: boolean;
  product_ids: string[];
  created_at: string;
  updated_at: string;
}

const table = () => supabase.from('wishlist_shares' as never);

const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 20);

/** Link de compartilhamento da wishlist do usuário autenticado (1 por conta). */
export function useMyWishlistShare(enabled: boolean) {
  return useQuery({
    queryKey: ['wishlist-share', 'me'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<WishlistShare | null> => {
      const { data: session } = await supabase.auth.getUser();
      if (!session.user) return null;
      const { data, error } = await table()
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as WishlistShare) ?? null;
    },
  });
}

/** Cria ou atualiza o link (produtos atuais + visibilidade pública/privada). */
export function useUpsertWishlistShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productIds,
      isPublic,
      title,
      token,
    }: {
      productIds: string[];
      isPublic: boolean;
      title?: string | null;
      token?: string | null;
    }): Promise<WishlistShare> => {
      const { data: session } = await supabase.auth.getUser();
      if (!session.user) throw new Error('Entre na sua conta para compartilhar a lista.');
      const { data, error } = await table()
        .upsert(
          {
            user_id: session.user.id,
            token: token || randomToken(),
            title: title ?? null,
            is_public: isPublic,
            product_ids: productIds,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'user_id' } as never,
        )
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as WishlistShare;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist-share'] }),
  });
}

/** Leitura pública de uma lista compartilhada por token (RLS: só se is_public). */
export function useSharedWishlist(token?: string) {
  return useQuery({
    queryKey: ['wishlist-share', 'token', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await table()
        .select('title, product_ids, is_public, created_at')
        .eq('token', token!)
        .maybeSingle();
      if (error) throw error;
      const share = data as unknown as Pick<WishlistShare, 'title' | 'product_ids' | 'is_public' | 'created_at'> | null;
      if (!share) return { share: null, products: [] as { id: string; name: string; slug: string; price: number | null; images: string[] | null }[] };

      const { data: products } = await supabase
        .from('products')
        .select('id, name, slug, price, images')
        .in('id', share.product_ids.length ? share.product_ids : ['00000000-0000-0000-0000-000000000000'])
        .eq('is_active', true);

      return { share, products: (products ?? []) as { id: string; name: string; slug: string; price: number | null; images: string[] | null }[] };
    },
  });
}
