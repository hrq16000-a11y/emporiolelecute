// Bloco 3 SAFE — Governança de Automação
// Helper único para sinalizar que uma taxonomia pública mudou:
//   1) Marca store_settings.sitemap_dirty = true (idempotente; o trigger DB
//      também faz isso em UPDATE, mas aqui garantimos cobertura no front).
//   2) Aciona a edge function `seo-sitemap-auto-resubmit` em fire-and-forget
//      para ping IndexNow/GSC quando o lojista alterna o status de publicação.
//
// Falhas são silenciosas: a UI nunca é bloqueada por um ping de SEO.

import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';

export type TaxonomyTable = 'categories' | 'occasions' | 'segments' | 'tags';

export async function markPublicTaxonomyDirty(source: TaxonomyTable): Promise<void> {
  try {
    await supabase
      .from('store_settings')
      .upsert(
        {
          key: 'sitemap_dirty',
          value: { dirty: true, marked_at: new Date().toISOString(), source } as never,
        },
        { onConflict: 'key' },
      );
  } catch {
    /* trigger DB já cobre — silencia */
  }
  // Fire-and-forget: ping de auto-resubmit do sitemap (IndexNow/GSC).
  try {
    void supabase.functions.invoke('seo-sitemap-auto-resubmit', {
      body: { reason: `taxonomy:${source}` },
    });
  } catch {
    /* silencia */
  }
}

// Invalida TODAS as chaves de React Query que alimentam a vitrine pública
// (menus, filtros e listas) para refletir mudança de publicação em tempo real.
export function invalidatePublicTaxonomy(qc: QueryClient, table: TaxonomyTable): void {
  // O React Query trata key como prefixo: invalidar ['categories'] cobre
  // tanto ['categories','public'] quanto ['categories','all'].
  qc.invalidateQueries({ queryKey: [table] });
  qc.invalidateQueries({ queryKey: ['taxonomy', table] });
  qc.invalidateQueries({ queryKey: ['taxonomy-navigation'] });
  qc.invalidateQueries({ queryKey: ['menu_items'] });
}
