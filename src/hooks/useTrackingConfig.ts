import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrackingConfig {
  ga4_id: string;
  gtm_id: string;
  meta_pixel_id: string;
  google_ads_id: string;
  google_ads_conversion_label: string;
  enabled: boolean;
  /** Glob-like path patterns where tracking is loaded. Empty = all pages. Admin paths always excluded. */
  enabled_paths: string[];
  /** Paths where tracking is explicitly disabled */
  disabled_paths: string[];
}

export const DEFAULT_TRACKING: TrackingConfig = {
  ga4_id: "",
  gtm_id: "",
  meta_pixel_id: "",
  google_ads_id: "",
  google_ads_conversion_label: "",
  enabled: false,
  enabled_paths: [],
  disabled_paths: ["/admin", "/admin/*"],
};

export const useTrackingConfig = () =>
  useQuery({
    queryKey: ["store_settings", "tracking_config"],
    placeholderData: DEFAULT_TRACKING,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("value")
        .eq("key", "tracking_config")
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_TRACKING, ...((data?.value as Partial<TrackingConfig>) ?? {}) };
    },
  });

export const useUpdateTrackingConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: TrackingConfig) => {
      const { data: existing } = await supabase
        .from("store_settings")
        .select("id")
        .eq("key", "tracking_config")
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("store_settings")
          .update({ value: cfg as any })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_settings")
          .insert({ key: "tracking_config", value: cfg as any });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store_settings", "tracking_config"] }),
  });
};

export function pathMatches(path: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    if (!p) return false;
    if (p === path) return true;
    if (p.endsWith("/*")) return path.startsWith(p.slice(0, -2));
    if (p.endsWith("*")) return path.startsWith(p.slice(0, -1));
    return path === p;
  });
}
