import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton fiel ao layout de /carrinho (produtos + dados + resumo),
 * evitando layout shift enquanto o carrinho hidrata do storage.
 */
const CheckoutSkeleton = () => (
  <div className="grid lg:grid-cols-3 gap-6 md:gap-8 animate-fade-in" aria-busy="true" aria-live="polite">
    <div className="lg:col-span-2 space-y-4 md:space-y-6">
      <div className="bg-card rounded-xl border border-border p-3 md:p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 md:gap-4 pb-3 border-b border-border last:border-0">
            <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-3 md:p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="lg:col-span-1">
      <div className="bg-card rounded-xl border border-border p-4 md:p-6 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  </div>
);

export default CheckoutSkeleton;
