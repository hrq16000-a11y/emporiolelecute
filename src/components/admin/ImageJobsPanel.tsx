import { CheckCircle2, Clock, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useImageJobs, retryImageJob, type ImageJobStatus } from '@/hooks/useImageJobs';
import { formatBytes } from '@/lib/imagePipeline';

const STATUS: Record<ImageJobStatus, { label: string; className: string }> = {
  pending: { label: 'Na fila', className: 'bg-muted text-muted-foreground' },
  processing: { label: 'Processando', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  retry: { label: 'Retentando', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  done: { label: 'Concluído', className: 'bg-primary/10 text-primary' },
  error: { label: 'Falhou', className: 'bg-destructive/10 text-destructive' },
};

const Icon = ({ status }: { status: ImageJobStatus }) => {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />;
  if (status === 'error') return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />;
  if (status === 'pending') return <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />;
  return <Loader2 className="h-4 w-4 animate-spin text-amber-600" aria-hidden />;
};

/**
 * Status em tempo real do processamento assíncrono de imagens
 * (variantes WebP responsivas + placeholder blur gerados em background).
 */
export const ImageJobsPanel = ({ limit = 8 }: { limit?: number }) => {
  const { data: jobs, isLoading } = useImageJobs(limit);
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!jobs?.length) return null;

  return (
    <div className="animate-fade-in space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Processamento em background</p>
      <ul className="space-y-2">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs transition-colors"
          >
            <Icon status={job.status} />
            <span className="min-w-0 flex-1 truncate font-medium">
              {job.storage_path.split('/').pop()}
            </span>
            <Badge variant="outline" className={`border-0 ${STATUS[job.status].className}`}>
              {STATUS[job.status].label}
            </Badge>
            {job.status === 'done' && (
              <span className="text-muted-foreground">
                {job.variants?.length ?? 0} variantes
                {job.output_bytes ? ` · ${formatBytes(job.output_bytes)}` : ''}
              </span>
            )}
            {job.status === 'error' && (
              <>
                <span className="w-full text-destructive">{job.error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9"
                  onClick={async () => {
                    try {
                      await retryImageJob(job.id);
                      toast({ title: 'Reprocessamento solicitado' });
                    } catch (e) {
                      toast({
                        variant: 'destructive',
                        title: 'Não foi possível reprocessar',
                        description: e instanceof Error ? e.message : 'Erro desconhecido',
                      });
                    }
                  }}
                >
                  <RefreshCw className="mr-1 h-3 w-3" /> Reprocessar
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ImageJobsPanel;
