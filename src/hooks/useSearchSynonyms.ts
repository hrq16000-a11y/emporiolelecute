// Fase 2 (refactor server-side) — A busca passou a rodar via RPC `search_products`
// no Postgres, que já expande sinônimos internamente. Este hook permanece
// apenas para telas administrativas futuras que queiram listar os sinônimos.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SearchSynonym {
  id: string;
  canonical_term: string;
  aliases: string[];
  boost_score: number;
  active: boolean;
}

export function useSearchSynonyms() {
  return useQuery({
    queryKey: ['search_synonyms', 'public'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SearchSynonym[]> => {
      const { data, error } = await supabase
        .from('search_synonyms' as never)
        .select('id, canonical_term, aliases, boost_score, active')
        .eq('active', true);
      if (error) return [];
      return (data ?? []) as unknown as SearchSynonym[];
    },
  });
}
