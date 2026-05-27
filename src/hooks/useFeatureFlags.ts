import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FeatureFlags {
  chatbot_enabled: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  chatbot_enabled: false,
};

const QUERY_KEY = ['feature_flags'];

const parse = (raw: unknown): FeatureFlags => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultFeatureFlags;
  const v = raw as Record<string, unknown>;
  return {
    chatbot_enabled: typeof v.chatbot_enabled === 'boolean' ? v.chatbot_enabled : defaultFeatureFlags.chatbot_enabled,
  };
};

export const useFeatureFlags = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<FeatureFlags> => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'feature_flags')
        .maybeSingle();
      if (error) {
        console.error('Error fetching feature flags:', error);
        return defaultFeatureFlags;
      }
      return parse(data?.value);
    },
    placeholderData: defaultFeatureFlags,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    meta: { silent: true },
  });
};

export const useUpdateFeatureFlags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flags: FeatureFlags) => {
      const { error } = await supabase
        .from('store_settings')
        .upsert({ key: 'feature_flags', value: flags as any }, { onConflict: 'key' });
      if (error) throw error;
      return flags;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};
