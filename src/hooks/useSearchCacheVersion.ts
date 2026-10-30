import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Versão global do cache de busca. É incrementada por triggers no banco
 * sempre que produtos, categorias, boosts ou sinônimos mudam — usada como
 * parte da queryKey da busca para invalidar resultados automaticamente.
 */
export function useSearchCacheVersion() {
  const { data } = useQuery({
    queryKey: ['search_cache_version'],
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    meta: { silent: true },
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'search_cache_version')
        .maybeSingle();
      if (error) return 0;
      const value = data?.value as { version?: number } | null;
      return Number(value?.version ?? 0);
    },
  });

  return data ?? 0;
}

/**
 * Alias semântico: a mesma versão global também invalida catálogo
 * (cards, listagens e páginas de detalhe) quando produtos, categorias,
 * preços ou boosts mudam no admin.
 */
export const useCatalogVersion = useSearchCacheVersion;
