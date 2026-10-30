// Fase 2 — Hooks de leitura/escrita para o cockpit administrativo de busca.
// Sempre invalidam o cache da RPC `search_products` quando algo muda, para
// que a vitrine pública reflita imediatamente a configuração nova.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SEARCH_KEYS = [["search_products"], ["search_synonyms"], ["search_boosts"], ["search_insights"]];

export function invalidateSearchCaches(qc: ReturnType<typeof useQueryClient>) {
  for (const key of SEARCH_KEYS) qc.invalidateQueries({ queryKey: key });
}

// ---------- SYNONYMS ----------

export interface SearchSynonymRow {
  id: string;
  canonical_term: string;
  aliases: string[];
  boost_score: number;
  active: boolean;
  notes: string | null;
  updated_at: string;
}

export function useAdminSynonyms() {
  return useQuery({
    queryKey: ["search_synonyms", "admin"],
    queryFn: async (): Promise<SearchSynonymRow[]> => {
      const { data, error } = await supabase
        .from("search_synonyms" as never)
        .select("id, canonical_term, aliases, boost_score, active, notes, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SearchSynonymRow[];
    },
  });
}

export function useUpsertSynonym() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<SearchSynonymRow> & { canonical_term: string }) => {
      const payload = {
        ...(row.id ? { id: row.id } : {}),
        canonical_term: row.canonical_term.trim(),
        aliases: (row.aliases ?? []).map((a) => a.trim()).filter(Boolean),
        boost_score: Number.isFinite(row.boost_score as number) ? Number(row.boost_score) : 1,
        active: row.active ?? true,
        notes: row.notes ?? null,
      };
      const { data, error } = await supabase
        .from("search_synonyms" as never)
        .upsert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSearchCaches(qc),
  });
}

export function useDeleteSynonym() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("search_synonyms" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSearchCaches(qc),
  });
}

// ---------- BOOSTS ----------

export interface SearchBoostRow {
  id: string;
  term: string;
  term_normalized: string;
  product_id: string;
  weight: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  /** Campanha sazonal: janela opcional de vigência (ISO). */
  starts_at: string | null;
  ends_at: string | null;
  campaign_label: string | null;
}

/** Um boost está "no ar" quando ativo e dentro da janela de campanha. */
export function isBoostLive(row: Pick<SearchBoostRow, "is_active" | "starts_at" | "ends_at">): boolean {
  if (!row.is_active) return false;
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() < now) return false;
  return true;
}

export function useAdminBoosts() {
  return useQuery({
    queryKey: ["search_boosts", "admin"],
    queryFn: async (): Promise<(SearchBoostRow & { product_name?: string; product_slug?: string })[]> => {
      const { data, error } = await supabase
        .from("search_boosts" as never)
        .select(
          "id, term, term_normalized, product_id, weight, is_active, notes, created_at, starts_at, ends_at, campaign_label, products:product_id(name, slug)",
        )
        .order("term_normalized", { ascending: true })
        .order("weight", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        product_name: r.products?.name,
        product_slug: r.products?.slug,
      }));
    },
  });
}

export function useUpsertBoost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<SearchBoostRow>) => {
      const payload: any = {
        ...(row.id ? { id: row.id } : {}),
        term: (row.term ?? "").trim(),
        product_id: row.product_id,
        weight: Number.isFinite(row.weight as number) ? Number(row.weight) : 100,
        is_active: row.is_active ?? true,
        notes: row.notes ?? null,
        starts_at: row.starts_at || null,
        ends_at: row.ends_at || null,
        campaign_label: row.campaign_label?.trim() || null,
      };
      const { data, error } = await supabase
        .from("search_boosts" as never)
        .upsert(payload, { onConflict: "term_normalized,product_id" } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSearchCaches(qc),
  });
}

export function useDeleteBoost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("search_boosts" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSearchCaches(qc),
  });
}

// ---------- AUDIT LOG ----------

export interface SearchAuditRow {
  id: string;
  entity: string;
  entity_id: string | null;
  action: string;
  actor_email: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export function useSearchAuditLog(limit = 200) {
  return useQuery({
    queryKey: ["search_audit_log", limit],
    staleTime: 30_000,
    queryFn: async (): Promise<SearchAuditRow[]> => {
      const { data, error } = await supabase
        .from("search_audit_log" as never)
        .select("id, entity, entity_id, action, actor_email, before, after, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as SearchAuditRow[];
    },
  });
}



// ---------- INSIGHTS ----------

export interface SearchInsightRow {
  term_normalized: string;
  total_searches: number;
  zero_result_count: number;
  last_searched_at: string;
  last_suggestion: string | null;
}

export function useSearchInsights() {
  return useQuery({
    queryKey: ["search_insights", "summary"],
    staleTime: 60_000,
    queryFn: async (): Promise<SearchInsightRow[]> => {
      const { data, error } = await supabase
        .from("search_insights_summary" as never)
        .select("term_normalized, total_searches, zero_result_count, last_searched_at, last_suggestion")
        .order("total_searches", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as SearchInsightRow[];
    },
  });
}
