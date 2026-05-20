// Fase 6 — Menu semântico global
// Provedor único para navegação por taxonomias indexáveis.
// Consome categories/occasions/segments e expõe nav consistente
// para Header, Footer, mega-menu e mobile. Tags ficam de fora.

import { useMemo } from 'react';
import { useDbCategories, useDbOccasions } from './useProducts';
import { useSegments } from './useSegments';

export interface NavItem {
  type: 'category' | 'occasion' | 'segment';
  id: string;
  name: string;
  slug: string;
  canonical_path: string;
  position: number;
  image_url?: string | null;
  is_indexed: boolean;
}

interface UseTaxonomyNavigationResult {
  categories: NavItem[];
  occasions: NavItem[];
  segments: NavItem[];
  isLoading: boolean;
}

export function useTaxonomyNavigation(): UseTaxonomyNavigationResult {
  // Bloco 3 SAFE: nav semântico só consome taxonomias publicadas + indexáveis.
  const cats = useDbCategories({ publicOnly: true });
  const occs = useDbOccasions({ publicOnly: true });
  const segs = useSegments({ publicOnly: true });

  return useMemo(() => {
    const map = <T extends { id: string; name: string; slug: string; position?: number | null; image_url?: string | null; is_indexed?: boolean | null }>(
      rows: T[] | undefined,
      type: NavItem['type'],
      prefix: string,
    ): NavItem[] => {
      return (rows ?? [])
        .filter((r) => r.is_indexed !== false)
        .map((r) => ({
          type,
          id: r.id,
          name: r.name,
          slug: r.slug,
          canonical_path: `${prefix}${r.slug}`,
          position: r.position ?? 0,
          image_url: r.image_url ?? null,
          is_indexed: r.is_indexed !== false,
        }))
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    };

    return {
      categories: map(cats.data, 'category', '/categoria/'),
      occasions: map(occs.data, 'occasion', '/ocasiao/'),
      segments: map(segs.data, 'segment', '/segmento/'),
      isLoading: cats.isLoading || occs.isLoading || segs.isLoading,
    };
  }, [cats.data, occs.data, segs.data, cats.isLoading, occs.isLoading, segs.isLoading]);
}
