import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

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

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'lelecute-cart';

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const quantity = newItem.quantity || newItem.minQuantity;
    
    setItems(currentItems => {
      const existingIndex = currentItems.findIndex(item => item.id === newItem.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...currentItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          personalization: newItem.personalization || updated[existingIndex].personalization,
        };
        return updated;
      }
      
      // Add new item
      return [...currentItems, { ...newItem, quantity }];
    });

    toast({
      title: "Adicionado ao carrinho! 🛒",
      description: `${quantity}x ${newItem.name}`,
    });
  };

  const removeItem = (id: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    setItems(currentItems => 
      currentItems.map(item => 
        item.id === id 
          ? { ...item, quantity: Math.max(item.minQuantity, quantity) }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount,
      total,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
