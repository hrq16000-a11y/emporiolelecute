import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fila de processamento assíncrono de imagens.
 *
 * O upload grava o arquivo no Storage e registra um job; a Edge Function
 * `process-image-jobs` gera as variantes WebP e o placeholder em background.
 * A UI acompanha o status via Realtime.
 */

export type ImageJobStatus = 'pending' | 'processing' | 'retry' | 'done' | 'error';

export interface ImageJob {
  id: string;
  bucket: string;
  storage_path: string;
  public_url: string | null;
  status: ImageJobStatus;
  attempts: number;
  error: string | null;
  source_bytes: number | null;
  output_bytes: number | null;
  placeholder: string | null;
  variants: Array<{ width: number; url: string; bytes: number }>;
  created_at: string;
  processed_at: string | null;
}

const KEY = ['admin', 'image-jobs'];

/** Registra um novo job e dispara o worker (best-effort, não bloqueia o upload). */
export async function enqueueImageJob(params: {
  storagePath: string;
  publicUrl: string;
  bucket?: string;
  sourceBytes?: number;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('image_processing_jobs')
    .insert({
      bucket: params.bucket ?? 'product-images',
      storage_path: params.storagePath,
      public_url: params.publicUrl,
      source_bytes: params.sourceBytes ?? null,
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  void supabase.functions.invoke('process-image-jobs').catch(() => {
    /* worker também roda por cron — falha aqui não impacta o upload */
  });

  return data.id as string;
}

export function useImageJobs(limit = 12) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...KEY, limit],
    queryFn: async (): Promise<ImageJob[]> => {
      const { data, error } = await supabase
        .from('image_processing_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ImageJob[];
    },
    staleTime: 15_000,
  });

  // Atualização em tempo real do status de processamento.
  useEffect(() => {
    const channel = supabase
      .channel('image-jobs-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'image_processing_jobs' },
        () => void queryClient.invalidateQueries({ queryKey: KEY }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export async function retryImageJob(id: string) {
  const { error } = await supabase
    .from('image_processing_jobs')
    .update({ status: 'pending', attempts: 0, error: null })
    .eq('id', id);
  if (error) throw error;
  void supabase.functions.invoke('process-image-jobs').catch(() => {});
}
