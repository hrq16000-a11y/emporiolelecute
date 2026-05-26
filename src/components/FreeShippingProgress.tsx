import { useQuery } from '@tanstack/react-query';
import { Truck, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatBRL } from '@/lib/format';

interface Props {
  currentTotal: number;
}

// Barra progressiva de frete grátis — lê o limiar de store_settings.shipping_policy.free_shipping_threshold
const FreeShippingProgress = ({ currentTotal }: Props) => {
  const { data: threshold } = useQuery({
    queryKey: ['shipping-policy-threshold'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'shipping_policy')
        .maybeSingle();
      const raw = (data?.value as { free_shipping_threshold?: number } | null) || null;
      const v = Number(raw?.free_shipping_threshold ?? 0);
      return Number.isFinite(v) && v > 0 ? v : 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (!threshold || threshold <= 0) return null;

  const reached = currentTotal >= threshold;
  const missing = Math.max(0, threshold - currentTotal);
  const pct = Math.min(100, Math.round((currentTotal / threshold) * 100));

  return (
    <div
      className="rounded-lg border border-border bg-muted/40 p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm">
        {reached ? (
          <Sparkles className="h-4 w-4 text-green-600 flex-shrink-0" aria-hidden="true" />
        ) : (
          <Truck className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
        )}
        <span className="text-foreground">
          {reached ? (
            <strong className="text-green-700">Você ganhou frete grátis!</strong>
          ) : (
            <>
              Faltam <strong className="text-primary">{formatBRL(missing)}</strong> para frete grátis
            </>
          )}
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso para frete grátis"
      >
        <div
          className={`h-full transition-all duration-500 ${reached ? 'bg-green-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default FreeShippingProgress;
