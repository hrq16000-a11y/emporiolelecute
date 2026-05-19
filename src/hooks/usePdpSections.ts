import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PdpSection {
  id: string;
  section_key: string;
  label: string;
  description: string | null;
  is_visible: boolean;
  position: number;
  editable_props: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PdpSectionAuditEntry {
  id: string;
  section_key: string;
  action: "visibility_changed" | "reordered" | "edited" | "created" | "deleted";
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changed_by: string | null;
  changed_by_email: string | null;
  created_at: string;
}

const QK = {
  public: ["pdp_sections", "public"] as const,
  admin: ["pdp_sections", "admin"] as const,
  audit: ["pdp_sections", "audit"] as const,
};

export const usePdpSectionsPublic = () =>
  useQuery({
    queryKey: QK.public,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdp_sections" as never)
        .select("*")
        .eq("is_visible", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PdpSection[];
    },
    staleTime: 60_000,
  });

export const useAdminPdpSections = () =>
  useQuery({
    queryKey: QK.admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdp_sections" as never)
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PdpSection[];
    },
  });

export const useUpdatePdpSection = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (patch: Partial<PdpSection> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase
        .from("pdp_sections" as never)
        .update(rest as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.public });
      qc.invalidateQueries({ queryKey: QK.admin });
      qc.invalidateQueries({ queryKey: QK.audit });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });
};

export const useReorderPdpSections = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        supabase
          .from("pdp_sections" as never)
          .update({ position: (idx + 1) * 10 } as never)
          .eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.public });
      qc.invalidateQueries({ queryKey: QK.admin });
      qc.invalidateQueries({ queryKey: QK.audit });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao reordenar", description: e.message, variant: "destructive" }),
  });
};

export const usePdpSectionAudit = (sectionKey?: string) =>
  useQuery({
    queryKey: [...QK.audit, sectionKey ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("pdp_section_audit" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (sectionKey) q = q.eq("section_key", sectionKey);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as PdpSectionAuditEntry[];
    },
  });
