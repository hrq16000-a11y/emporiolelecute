import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

export interface WishlistItem {
  product_id: string;
  personalization?: Record<string, unknown>;
  note?: string | null;
  created_at: string;
}

interface WishlistState {
  items: WishlistItem[];
  userId: string | null;
  hydrated: boolean;
  setItems: (items: WishlistItem[]) => void;
  setUser: (userId: string | null) => void;
  addLocal: (item: WishlistItem) => void;
  removeLocal: (productId: string) => void;
}

/**
 * Wishlist com persistência local (convidado) e sincronização com o banco
 * quando o cliente está autenticado (RLS: cada usuário só vê a própria lista).
 */
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      items: [],
      userId: null,
      hydrated: false,
      setItems: (items) => set({ items }),
      setUser: (userId) => set({ userId }),
      addLocal: (item) =>
        set((s) =>
          s.items.some((i) => i.product_id === item.product_id) ? s : { items: [item, ...s.items] },
        ),
      removeLocal: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.product_id !== productId) })),
    }),
    {
      name: 'lelecute_wishlist_v1',
      partialize: (s) => ({ items: s.items }) as WishlistState,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

const fetchRemote = async (userId: string): Promise<WishlistItem[]> => {
  const { data, error } = await supabase
    .from('wishlists' as never)
    .select('product_id, personalization, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as WishlistItem[];
};

export function useWishlist() {
  const { items, userId, setItems, setUser, addLocal, removeLocal } = useWishlistStore();
  const [syncing, setSyncing] = useState(false);

  // Descobre a sessão e sincroniza (merge local -> remoto na primeira vez).
  useEffect(() => {
    let active = true;

    const sync = async (uid: string | null) => {
      if (!active) return;
      setUser(uid);
      if (!uid) return;
      setSyncing(true);
      try {
        const remote = await fetchRemote(uid);
        const local = useWishlistStore.getState().items;
        const missing = local.filter((l) => !remote.some((r) => r.product_id === l.product_id));
        if (missing.length > 0) {
          await supabase.from('wishlists' as never).upsert(
            missing.map((m) => ({
              user_id: uid,
              product_id: m.product_id,
              personalization: m.personalization ?? {},
              note: m.note ?? null,
            })) as never,
            { onConflict: 'user_id,product_id' } as never,
          );
        }
        const merged = await fetchRemote(uid);
        if (active) setItems(merged.length ? merged : local);
      } finally {
        if (active) setSyncing(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => sync(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      sync(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSaved = useCallback(
    (productId: string) => items.some((i) => i.product_id === productId),
    [items],
  );

  const toggle = useCallback(
    async (productId: string, personalization?: Record<string, unknown>) => {
      const saved = useWishlistStore.getState().items.some((i) => i.product_id === productId);
      const uid = useWishlistStore.getState().userId;

      if (saved) {
        removeLocal(productId);
        if (uid) {
          await supabase
            .from('wishlists' as never)
            .delete()
            .eq('user_id', uid)
            .eq('product_id', productId);
        }
        return false;
      }

      addLocal({
        product_id: productId,
        personalization: personalization ?? {},
        note: null,
        created_at: new Date().toISOString(),
      });
      if (uid) {
        await supabase.from('wishlists' as never).upsert(
          {
            user_id: uid,
            product_id: productId,
            personalization: personalization ?? {},
          } as never,
          { onConflict: 'user_id,product_id' } as never,
        );
      }
      return true;
    },
    [addLocal, removeLocal],
  );

  return { items, isSaved, toggle, syncing, isAuthenticated: !!userId };
}
