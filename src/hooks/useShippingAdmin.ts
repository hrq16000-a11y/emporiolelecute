import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ShippingSettings = {
  id: string;
  origin_zip_code: string;
  default_box_weight_kg: number;
  default_box_length_cm: number;
  default_box_width_cm: number;
  default_box_height_cm: number;
  handling_fee: number;
  shipping_markup_percentage: number;
};

export type ShippingProvider = {
  id: string;
  provider_name: string;
  provider_code: string;
  is_active: boolean;
  api_key: string | null;
  api_secret: string | null;
  endpoint_url: string | null;
  config_json: any;
};

export type ShippingRule = {
  id: string;
  rule_name: string;
  condition_type: "min_cart_value" | "specific_state" | "zip_code_range";
  condition_value: any;
  discount_type: "free_shipping" | "fixed_discount" | "percentage_discount";
  discount_value: number;
  is_active: boolean;
  priority: number;
};

export type ShippingAuditLog = {
  id: string;
  destination_zip: string | null;
  cart_snapshot: any;
  provider_name: string | null;
  error_message: string | null;
  http_status: number | null;
  created_at: string;
};

export function useShippingSettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "shipping_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ShippingSettings | null;
    },
  });
  const update = useMutation({
    mutationFn: async (payload: Partial<ShippingSettings> & { id: string }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("shipping_settings").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "shipping_settings"] }),
  });
  return { ...query, update };
}

export function useShippingProviders() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "shipping_providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_providers")
        .select("*")
        .order("provider_name");
      if (error) throw error;
      return (data ?? []) as ShippingProvider[];
    },
  });
  const upsert = useMutation({
    mutationFn: async (p: Partial<ShippingProvider> & { id: string }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("shipping_providers").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "shipping_providers"] }),
  });
  return { ...query, upsert };
}

export function useShippingRules() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "shipping_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShippingRule[];
    },
  });
  const create = useMutation({
    mutationFn: async (r: Omit<ShippingRule, "id">) => {
      const { error } = await supabase.from("shipping_rules").insert(r as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "shipping_rules"] }),
  });
  const update = useMutation({
    mutationFn: async (r: Partial<ShippingRule> & { id: string }) => {
      const { id, ...rest } = r;
      const { error } = await supabase.from("shipping_rules").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "shipping_rules"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "shipping_rules"] }),
  });
  return { ...query, create, update, remove };
}

export function useShippingAuditLogs() {
  return useQuery({
    queryKey: ["admin", "shipping_audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ShippingAuditLog[];
    },
  });
}
