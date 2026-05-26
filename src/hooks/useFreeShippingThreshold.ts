import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_FREE_SHIPPING_THRESHOLD = 299;

/**
 * Hook que retorna o limiar de frete grátis configurado no admin (/admin/fretes).
 * Lê preferencialmente de `shipping_settings` (singleton); se não houver valor,
 * tenta `store_settings.shipping_policy.free_shipping_threshold`;
 * em último caso, retorna o fallback seguro de R$ 299.
 */
export function useFreeShippingThreshold() {
  return useQuery({
    queryKey: ['free-shipping-threshold'],
    queryFn: async () => {
      // 1. Tenta ler de shipping_settings (fonte canônica)
      const { data: shippingData } = await supabase
        .from('shipping_settings')
        .select('free_shipping_threshold, free_shipping_enabled')
        .limit(1)
        .maybeSingle();

      // Se o admin desabilitou a barra explicitamente, retorna 0 (FreeShippingProgress já oculta).
      if (shippingData && (shippingData as any).free_shipping_enabled === false) {
        return 0;
      }

      const fromShipping = Number(shippingData?.free_shipping_threshold ?? 0);
      if (Number.isFinite(fromShipping) && fromShipping > 0) {
        return fromShipping;
      }

      // 2. Fallback legado: store_settings.shipping_policy
      const { data: storeData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'shipping_policy')
        .maybeSingle();

      const raw = (storeData?.value as { free_shipping_threshold?: number } | null) || null;
      const fromStore = Number(raw?.free_shipping_threshold ?? 0);
      if (Number.isFinite(fromStore) && fromStore > 0) {
        return fromStore;
      }

      // 3. Fallback final seguro
      return DEFAULT_FREE_SHIPPING_THRESHOLD;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
