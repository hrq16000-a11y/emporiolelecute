/**
 * Resolve um produto a partir de qualquer slug conhecido (primário ou alias).
 *
 * Fase 1.5: discriminação explícita entre `unknown` e `inactive`.
 *
 * Contrato:
 *   - slug primário                          → resolvedVia: 'primary'
 *   - slug ativo, source manual/alias        → resolvedVia: 'alias'
 *   - slug ativo, demais sources             → resolvedVia: 'historical'
 *   - alias inativo (is_active=false)        → status: 'inactive' (404, sem redirect)
 *   - slug desconhecido                      → status: 'unknown'
 *   - slug vazio/inválido                    → status: 'unknown'
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeSlug } from "@/lib/slug";

export type ResolvedVia = "primary" | "alias" | "historical";

export interface ResolvedSlug {
  status: "ok";
  productId: string;
  matchedSlug: string;
  primarySlug: string;
  isPrimary: boolean;
  isActive: boolean;
  shouldRedirect: boolean;
  resolvedVia: ResolvedVia;
}

export interface UnresolvedSlug {
  status: "inactive" | "unknown";
  matchedSlug: string;
}

export type ResolveResult = ResolvedSlug | UnresolvedSlug;

interface ResolveRow {
  product_id: string;
  matched_slug: string;
  primary_slug: string;
  is_primary: boolean;
  is_active: boolean;
  source?: string | null;
}

function classify(row: ResolveRow): ResolvedVia {
  if (row.is_primary) return "primary";
  const src = (row.source || "").toLowerCase();
  if (src === "manual" || src === "alias") return "alias";
  return "historical";
}

export async function resolveProductSlug(rawSlug: string): Promise<ResolveResult> {
  const normalized = normalizeSlug(rawSlug);
  if (!normalized) return { status: "unknown", matchedSlug: rawSlug ?? "" };

  const { data, error } = await supabase.rpc("resolve_product_slug", { _slug: normalized });
  if (error || !data || data.length === 0) {
    return { status: "unknown", matchedSlug: normalized };
  }

  const row = data[0] as ResolveRow;
  if (!row.is_active) {
    return { status: "inactive", matchedSlug: row.matched_slug };
  }

  return {
    status: "ok",
    productId: row.product_id,
    matchedSlug: row.matched_slug,
    primarySlug: row.primary_slug,
    isPrimary: row.is_primary,
    isActive: row.is_active,
    shouldRedirect: row.matched_slug !== row.primary_slug,
    resolvedVia: classify(row),
  };
}

export function recordProductSlugHit(rawSlug: string): void {
  const normalized = normalizeSlug(rawSlug);
  if (!normalized) return;
  if (typeof window === "undefined") return;
  // Defer para idle — métrica nunca deve bloquear LCP/INP.
  const run = () => {
    void supabase.rpc("record_product_slug_hit", { _slug: normalized }).then(() => { /* noop */ });
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout?: number }) => number)
    | undefined;
  if (ric) ric(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}

