import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveProductSlug, recordProductSlugHit, type ResolvedVia, type ResolvedSlug } from '@/lib/productResolver';
import { logSlugEvent } from '@/lib/slugObservability';

export interface DbProductSlugMeta {
  matchedSlug: string;
  primarySlug: string;
  isPrimary: boolean;
  shouldRedirect: boolean;
  resolvedVia: ResolvedVia;
}

export interface DbProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  price: number;
  original_price: number | null;
  min_quantity: number;
  pix_discount: number;
  production_days: number;
  weight: number | null;
  category_id: string | null;
  badge: string | null;
  rating: number;
  images: string[];
  features: string[];
  keywords: string[];
  
  editorial_content: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Personalization fields
  personalization_enabled: boolean | null;
  personalization_label: string | null;
  personalization_placeholder: string | null;
  google_product_category: string | null;
  // Sprint 2 — discovery
  featured_weight?: number | null;
  production_speed?: 'rapido' | 'normal' | 'longo' | null;
  // Relations (populated by joins)
  category?: DbCategory | null;
  occasions?: DbOccasion[];
  tags?: DbTag[];
  segments?: DbSegment[];
  // Fase 1 — metadata de resolução de slug (populated by useDbProduct)
  __slugMeta?: DbProductSlugMeta;
}

export interface DbSegment {
  id: string;
  name: string;
  slug: string;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  image_url?: string | null;
  icon?: string | null;
  position?: number | null;
  is_indexed?: boolean | null;
  is_draft?: boolean | null;
  description?: string | null;
}

export interface DbOccasion {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  icon?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  is_indexed?: boolean | null;
  is_draft?: boolean | null;
  created_at: string;
}

export interface DbTag {
  id: string;
  name: string;
  slug: string;
  created_at: string | null;
}

// Fetch all products with relations (optimized single query with nested selects)
export function useDbProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          occasions:product_occasions(occasion:occasions(*)),
          tags:product_tags(tag:tags(*)),
          segments:product_segments(segment:segments(id,name,slug))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (products || []).map(product => ({
        ...product,
        occasions: (product.occasions || [])
          .map((po: { occasion: DbOccasion }) => po.occasion)
          .filter(Boolean),
        tags: (product.tags || [])
          .map((pt: { tag: DbTag }) => pt.tag)
          .filter(Boolean),
        segments: (product.segments || [])
          .map((ps: { segment: DbSegment }) => ps.segment)
          .filter(Boolean),
      })) as DbProduct[];
    },
  });
}

// Fetch single product by slug (or alias / historical slug).
// Fase 1: resolução via product_slugs (RPC resolve_product_slug) +
// fetch por id. Expõe __slugMeta para a página decidir replace/canonical.
export function useDbProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const result = await resolveProductSlug(slug);

      if (result.status === 'unknown') {
        logSlugEvent({ event: 'unknown_slug', matchedSlug: result.matchedSlug });
        return null;
      }
      if (result.status === 'inactive') {
        logSlugEvent({ event: 'inactive_alias_attempt', matchedSlug: result.matchedSlug });
        return null;
      }
      const resolved = result as ResolvedSlug; // narrowed

      // Telemetria fire-and-forget
      recordProductSlugHit(resolved.matchedSlug);

      if (resolved.resolvedVia === 'alias') {
        logSlugEvent({
          event: 'alias_hit',
          matchedSlug: resolved.matchedSlug,
          primarySlug: resolved.primarySlug,
          productId: resolved.productId,
        });
      } else if (resolved.resolvedVia === 'historical') {
        logSlugEvent({
          event: 'historical_hit',
          matchedSlug: resolved.matchedSlug,
          primarySlug: resolved.primarySlug,
          productId: resolved.productId,
        });
      }

      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          occasions:product_occasions(occasion:occasions(*)),
          tags:product_tags(tag:tags(*)),
          segments:product_segments(segment:segments(id,name,slug))
        `)
        .eq('id', resolved.productId)
        .maybeSingle();

      if (error) throw error;
      if (!product) {
        logSlugEvent({
          event: 'structural_inconsistency',
          reason: 'resolved_product_id_not_found',
          productId: resolved.productId,
          matchedSlug: resolved.matchedSlug,
          primarySlug: resolved.primarySlug,
        });
        return null;
      }

      // Drift: products.slug deve coincidir com primarySlug.
      if (product.slug !== resolved.primarySlug) {
        logSlugEvent({
          event: 'slug_drift_detected',
          productId: resolved.productId,
          matchedSlug: resolved.matchedSlug,
          primarySlug: resolved.primarySlug,
          productSlug: product.slug,
        });
      }

      return {
        ...product,
        occasions: (product.occasions || [])
          .map((po: { occasion: DbOccasion }) => po.occasion)
          .filter(Boolean),
        tags: (product.tags || [])
          .map((pt: { tag: DbTag }) => pt.tag)
          .filter(Boolean),
        segments: (product.segments || [])
          .map((ps: { segment: DbSegment }) => ps.segment)
          .filter(Boolean),
        __slugMeta: {
          matchedSlug: resolved.matchedSlug,
          primarySlug: resolved.primarySlug,
          isPrimary: resolved.isPrimary,
          shouldRedirect: resolved.shouldRedirect,
          resolvedVia: resolved.resolvedVia,
        },
      } as DbProduct;
    },
    enabled: !!slug,
  });
}

// Fetch single product by ID
export function useDbProductById(id: string) {
  return useQuery({
    queryKey: ['product-by-id', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as DbProduct | null;
    },
    enabled: !!id,
  });
}

// UUID v4-ish detector. Aceita qualquer UUID padrão.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fetch single product by ID ou slug (usado no admin para URLs amigáveis).
export function useDbProductByIdOrSlug(idOrSlug: string | undefined | null) {
  const key = idOrSlug || '';
  const isUuid = UUID_RE.test(key);
  return useQuery({
    queryKey: ['product-by-id-or-slug', key],
    queryFn: async () => {
      if (!key) return null;
      // Tenta resolver pelo campo direto (id se UUID, senão slug).
      const primaryField = isUuid ? 'id' : 'slug';
      const { data: primary, error: errPrimary } = await supabase
        .from('products')
        .select('*')
        .eq(primaryField, key)
        .maybeSingle();
      if (errPrimary) throw errPrimary;
      if (primary) return primary as DbProduct;

      // Fallback: se não é UUID, tenta resolver via product_slugs (histórico de slugs).
      if (!isUuid) {
        const { data: alias } = await supabase
          .from('product_slugs')
          .select('product_id')
          .eq('slug', key)
          .maybeSingle();
        if (alias?.product_id) {
          const { data: byAlias, error: errAlias } = await supabase
            .from('products')
            .select('*')
            .eq('id', alias.product_id)
            .maybeSingle();
          if (errAlias) throw errAlias;
          return (byAlias as DbProduct) ?? null;
        }
      }
      return null;
    },
    enabled: !!key,
  });
}


// Fetch all categories.
// `publicOnly` (default false) aplica a trava SAFE Bloco 3:
//   só retorna registros com is_draft=false AND is_indexed=true.
// Componentes públicos (Header, Footer, filtros, vitrines) DEVEM passar publicOnly:true.
// Admin (CRUD) consome sem flag e enxerga rascunhos.
export function useDbCategories(opts?: { publicOnly?: boolean }) {
  const publicOnly = opts?.publicOnly === true;
  return useQuery({
    queryKey: ['categories', publicOnly ? 'public' : 'all'],
    queryFn: async () => {
      let q = supabase
        .from('categories')
        .select('*')
        .order('position', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
      if (publicOnly) q = q.eq('is_draft', false).eq('is_indexed', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as DbCategory[];
    },
  });
}

// Fetch all occasions. Mesma semântica de `publicOnly` que useDbCategories.
export function useDbOccasions(opts?: { publicOnly?: boolean }) {
  const publicOnly = opts?.publicOnly === true;
  return useQuery({
    queryKey: ['occasions', publicOnly ? 'public' : 'all'],
    queryFn: async () => {
      let q = supabase
        .from('occasions')
        .select('*')
        .order('position', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
      if (publicOnly) q = q.eq('is_draft', false).eq('is_indexed', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as DbOccasion[];
    },
  });
}
// useUpdateProduct — RESERVADO para updates atômicos de 1 campo (ex.: toggle is_active).
// Para edições do formulário completo (slug/preço/categoria/imagens/pivôs), use
// useSaveProductFull (RPC save_product_full com lock otimista). Não usar este hook
// para campos sob o lock — bypassa o expected_updated_at.
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...product }: Partial<DbProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// =============================================================================
// useSaveProductFull — operação ATÔMICA (RPC save_product_full)
// Substitui a cadeia: update products + delete/insert pivôs + update redundante.
// Lock otimista via expected_updated_at. Rollback total em qualquer erro.
// =============================================================================

export interface SaveProductFullPayload {
  id: string | null;
  expected_updated_at: string | null;
  product: Record<string, unknown>;
  occasion_ids: string[];
  tag_ids: string[];
  segment_ids: string[];
}

export interface SaveProductFullResult {
  id: string;
  slug: string;
  updated_at: string;
  row: Record<string, unknown>;
}

/** Categoria de erro mapeada para UX do AdminProductForm. */
export type SaveProductErrorKind =
  | 'stale_version'    // 40001 — outro admin editou
  | 'slug_taken'       // 23505 — slug duplicado
  | 'fk_missing'       // 23503 — categoria/tag removida
  | 'forbidden'        // 42501 — sem permissão
  | 'invalid'          // 23514 — slug reservado, validação
  | 'unknown';

export interface SaveProductError extends Error {
  kind: SaveProductErrorKind;
  code?: string;
  hint?: string;
}

function classifySaveError(raw: unknown): SaveProductError {
  const e = raw as { code?: string; hint?: string; message?: string; details?: string } | null;
  const code = e?.code;
  const hint = e?.hint;
  const msg = e?.message || 'Erro ao salvar produto';
  let kind: SaveProductErrorKind = 'unknown';
  if (code === '40001' || hint === 'stale_version') kind = 'stale_version';
  else if (code === '23505') kind = 'slug_taken';
  else if (code === '23503') kind = 'fk_missing';
  else if (code === '42501') kind = 'forbidden';
  else if (code === '23514') kind = 'invalid';
  else if (code === '23502') {
    // NOT NULL violation — tipicamente categoria obrigatória ausente.
    kind = 'invalid';
    const err = new Error('Categoria obrigatória ausente.') as SaveProductError;
    err.kind = kind;
    err.code = code;
    err.hint = hint;
    return err;
  }
  const err = new Error(msg) as SaveProductError;
  err.kind = kind;
  err.code = code;
  err.hint = hint;
  return err;
}

export function useSaveProductFull() {
  const qc = useQueryClient();
  return useMutation<SaveProductFullResult, SaveProductError, SaveProductFullPayload>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.rpc('save_product_full' as any, {
        _payload: payload as any,
      });
      if (error) throw classifySaveError(error);
      return data as unknown as SaveProductFullResult;
    },
    onSuccess: (data) => {
      // Invalidação completa — lista, by-id-or-slug, PDP pública e pivôs.
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-by-id-or-slug'] });
      qc.invalidateQueries({ queryKey: ['product', data.slug] });
      qc.invalidateQueries({ queryKey: ['product_tags', data.id] });
    },
  });
}



// Delete product
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Category mutations
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: { name: string; slug: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ external_ref: '', ...category })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// Occasion mutations
export function useCreateOccasion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (occasion: { name: string; slug: string }) => {
      const { data, error } = await supabase
        .from('occasions')
        .insert({ external_ref: '', ...occasion })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occasions'] });
    },
  });
}

export function useDeleteOccasion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('occasions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occasions'] });
    },
  });
}

// Update category
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...category }: { id: string; name?: string; slug?: string; icon?: string | null; image_url?: string | null; position?: number | null }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy-navigation'] });
      // Sinaliza pipeline SEO (sitemap_dirty + auto-resubmit).
      void import('@/lib/taxonomyAutomation').then((m) => m.markPublicTaxonomyDirty('categories'));
    },
  });
}

// Update occasion
export function useUpdateOccasion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...occasion }: {
      id: string;
      name?: string;
      slug?: string;
      description?: string | null;
      image_url?: string | null;
      icon?: string | null;
      meta_title?: string | null;
      meta_description?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('occasions')
        .update(occasion)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occasions'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy', 'occasions'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy-navigation'] });
      void import('@/lib/taxonomyAutomation').then((m) => m.markPublicTaxonomyDirty('occasions'));
    },
  });
}
