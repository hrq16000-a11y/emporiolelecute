import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton fiel ao layout da PDP — reserva o espaço da galeria e do bloco
 * de compra para evitar CLS enquanto o produto carrega.
 */
export const ProductPageSkeleton = () => (
  <div className="container mx-auto px-4 animate-fade-in">
    <Skeleton className="h-4 w-64 mb-6 rounded-full" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
      {/* Galeria */}
      <div className="space-y-3">
        <Skeleton className="w-full aspect-square rounded-2xl" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>

      {/* Bloco de compra */}
      <div className="space-y-5">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-9 w-4/5" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-4 rounded-sm" />
          ))}
        </div>
        <Skeleton className="h-10 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 w-32 rounded-full" />
          <Skeleton className="h-12 flex-1 rounded-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-3 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default ProductPageSkeleton;
