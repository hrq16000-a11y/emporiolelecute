// Fase 2 SAFE — Hook leve para sinônimos de busca cadastrados pelo lojista.
// Lê apenas os ativos (RLS pública já filtra). Cache de 5 min é suficiente,
// pois o admin pode editar quando quiser sem impactar a vitrine pesadamente.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeSearch } from '@/lib/searchNormalize';

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
      if (error) {
        // Retrocompatível: tabela pode não existir ainda em ambientes velhos.
        return [];
      }
      return (data ?? []) as unknown as SearchSynonym[];
    },
  });
}

// Dado um termo digitado, expande para o conjunto de termos equivalentes
// (o próprio termo + canônico + apelidos), normalizados.
export function expandWithSynonyms(query: string, synonyms: SearchSynonym[] | undefined): string[] {
  const base = normalizeSearch(query);
  if (!base) return [];
  const out = new Set<string>([base]);
  for (const s of synonyms ?? []) {
    const canon = normalizeSearch(s.canonical_term);
    const aliases = (s.aliases ?? []).map(normalizeSearch);
    const pool = [canon, ...aliases].filter(Boolean);
    if (pool.includes(base)) {
      for (const term of pool) out.add(term);
    }
  }
  return Array.from(out);
}
