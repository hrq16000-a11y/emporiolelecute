import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  /** Preço "de" original (antes do desconto), quando aplicável. */
  originalPrice?: number;
  quantity: number;
  image: string;
  personalization?: string;
  minQuantity: number;
  /** Quando o item foi adicionado como parte de um kit editorial. */
  bundleId?: string;
  bundleName?: string;
}

export type AddCartItemInput = Omit<CartItem, "quantity"> & { quantity?: number };

interface CartStore {
  items: CartItem[];
  addItem: (item: AddCartItemInput) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getTotal: () => number;
}

const CART_STORAGE_KEY = "emporio-cart-storage";

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        const quantity = newItem.quantity ?? newItem.minQuantity ?? 1;
        set((state) => {
          const idx = state.items.findIndex((i) => i.id === newItem.id);
          if (idx >= 0) {
            const updated = [...state.items];
            updated[idx] = {
              ...updated[idx],
              quantity: updated[idx].quantity + quantity,
              personalization: newItem.personalization || updated[idx].personalization,
            };
            return { items: updated };
          }
          const { quantity: _q, ...rest } = newItem;
          return { items: [...state.items, { ...rest, quantity } as CartItem] };
        });

        toast.success("Adicionado ao carrinho! 🛒", {
          description: `${quantity}× ${newItem.name}`,
        });
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id
              ? { ...i, quantity: Math.max(i.minQuantity || 1, quantity) }
              : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      getTotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Selectors estáveis para evitar re-renders desnecessários.
export const useCartItems = () => useCartStore((s) => s.items);
export const useCartItemCount = () =>
  useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));
export const useCartTotal = () =>
  useCartStore((s) => s.items.reduce((sum, item) => sum + item.price * item.quantity, 0));

/**
 * Hook de compatibilidade com a API anterior do CartContext.
 * Útil para componentes legados; novos componentes devem usar seletores específicos.
 */
export const useCart = () => {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { items, addItem, removeItem, updateQuantity, clearCart, itemCount, total };
};
