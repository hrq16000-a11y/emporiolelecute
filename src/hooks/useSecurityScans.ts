import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Scans periódicos de vulnerabilidades das dependências (Edge Function
 * `security-scan`, base OSV.dev). Resultados ficam em `security_scan_runs`.
 */

export type ScanSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface ScanFinding {
  package: string;
  version: string;
  id: string;
  summary: string;
  severity: ScanSeverity;
  url: string;
}

export interface SecurityScanRun {
  id: string;
  source: string;
  trigger: string;
  status: string;
  packages_scanned: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  moderate_count: number;
  low_count: number;
  regression: boolean;
  alert_sent: boolean;
  alert_reason: string | null;
  findings: ScanFinding[];
  error: string | null;
  created_at: string;
}

const KEY = ['admin', 'security-scans'];

export function useSecurityScans(limit = 20) {
  return useQuery({
    queryKey: [...KEY, limit],
    queryFn: async (): Promise<SecurityScanRun[]> => {
      const { data, error } = await supabase
        .from('security_scan_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as SecurityScanRun[];
    },
  });
}

export function useRunSecurityScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('security-scan', {
        body: { trigger: 'manual' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
