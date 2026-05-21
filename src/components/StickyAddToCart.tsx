import { useEffect, useRef } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/analytics";

interface StickyAddToCartProps {
  productName: string;
  productSlug?: string;
  price: string;
  onAddToCart: () => void;
  isVisible: boolean;
  enabled?: boolean;
}

export const StickyAddToCart = ({
  productName,
  productSlug,
  price,
  onAddToCart,
  isVisible,
  enabled = true,
}: StickyAddToCartProps) => {
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isVisible || viewedRef.current) return;
    viewedRef.current = true;
    trackFunnelEvent("pdp_sticky_view", { product_slug: productSlug });
  }, [enabled, isVisible, productSlug]);

  if (!enabled) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-3 transition-transform duration-500 md:hidden",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
      role="region"
      aria-label="Ações rápidas do produto"
    >
      <div className="flex items-center gap-2 max-w-md mx-auto">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-muted-foreground uppercase font-bold truncate max-w-[110px]">
            {productName}
          </span>
          <span className="text-base font-bold text-primary leading-tight">{price}</span>
        </div>

        <Button
          onClick={onAddToCart}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold shadow-lg h-11"
          aria-label="Comprar agora"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Comprar
        </Button>
      </div>
    </div>
  );
};
