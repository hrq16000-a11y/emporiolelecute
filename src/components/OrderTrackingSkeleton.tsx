import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton do acompanhamento de pedido (status, timeline e itens).
 */
const OrderTrackingSkeleton = () => (
  <div className="space-y-6 animate-fade-in" aria-busy="true" aria-live="polite">
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <Skeleton className="h-24 w-full rounded-none" />
      <div className="p-6 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>

    <div className="bg-card rounded-xl border border-border p-6">
      <Skeleton className="h-5 w-44 mb-6" />
      <div className="flex items-center justify-between">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>

    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <Skeleton className="h-5 w-32" />
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default OrderTrackingSkeleton;
