import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Histórico de relatórios de Web Vitals gerados por `npm run audit:vitals`
 * (Lighthouse). Cada relatório é um snapshot rotulado (ex.: "antes"/"depois")
 * com métricas por página, permitindo comparação no admin.
 */

export interface WebVitalsPage {
  name: string;
  score?: number | null;
  lcp?: number | null;
  cls?: number | null;
  tbt?: number | null;
  fcp?: number | null;
  error?: string;
}

export interface WebVitalsReport {
  id: string;
  label: string;
  base_url: string | null;
  notes: string | null;
  pages: WebVitalsPage[];
  created_at: string;
}

const KEY = ['admin', 'web-vitals-reports'];

/** Normaliza o JSON do script (`{ label, base, results: { home: {...} } }`). */
export function parseAuditSnapshot(raw: unknown): {
  label: string;
  base_url: string | null;
  pages: WebVitalsPage[];
} {
  const obj = (raw ?? {}) as {
    label?: string;
    base?: string;
    base_url?: string;
    results?: Record<string, Omit<WebVitalsPage, 'name'>>;
    pages?: WebVitalsPage[];
  };
  const pages: WebVitalsPage[] = obj.pages
    ? obj.pages
    : Object.entries(obj.results ?? {}).map(([name, metrics]) => ({ name, ...metrics }));
  return {
    label: obj.label ?? `relatorio-${new Date().toISOString().slice(0, 10)}`,
    base_url: obj.base ?? obj.base_url ?? null,
    pages,
  };
}

export function useWebVitalsReports() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<WebVitalsReport[]> => {
      const { data, error } = await supabase
        .from('web_vitals_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as WebVitalsReport[];
    },
  });
}

export function useSaveWebVitalsReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { raw: unknown; notes?: string }) => {
      const parsed = parseAuditSnapshot(input.raw);
      if (!parsed.pages.length) throw new Error('JSON sem métricas de páginas');
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('web_vitals_reports').insert({
        label: parsed.label,
        base_url: parsed.base_url,
        notes: input.notes ?? null,
        pages: parsed.pages as unknown as never,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWebVitalsReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('web_vitals_reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
