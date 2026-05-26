import { useEffect, useRef } from "react";
import { ShoppingCart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/analytics";
import { markLead } from "@/lib/visitor";
import type { PrimaryAction } from "@/lib/primaryAction";

interface StickyAddToCartProps {
  productName: string;
  productSlug?: string;
  price: string;
  /** Linha auxiliar opcional — ex: "3x sem juros de R$ 12,30". */
  installments?: string;
  /** URL da miniatura (primeira imagem do produto). */
  imageUrl?: string;
  onAddToCart: () => void;
  /** Disparado quando a ação primária resolvida é WhatsApp (personalizado / esgotado). */
  onWhatsApp?: () => void;
  /** Ação primária resolvida via resolvePrimaryAction(). Default: 'cart'. */
  primaryAction?: PrimaryAction;
  isVisible: boolean;
  enabled?: boolean;
}

export const StickyAddToCart = ({
  productName,
  productSlug,
  price,
  installments,
  imageUrl,
  onAddToCart,
  onWhatsApp,
  primaryAction = "cart",
  isVisible,
  enabled = true,
}: StickyAddToCartProps) => {
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isVisible || viewedRef.current) return;
    viewedRef.current = true;
    trackFunnelEvent("pdp_sticky_view", { product_slug: productSlug, primary: primaryAction });
  }, [enabled, isVisible, productSlug, primaryAction]);

  if (!enabled) return null;

  // Decide o handler/label do botão primário pela política central de CTA.
  const isWa = primaryAction === "whatsapp";
  const handlePrimary = () => {
    markLead(isWa ? "sticky_whatsapp" : "sticky_add_to_cart");
    if (isWa && onWhatsApp) onWhatsApp();
    else onAddToCart();
  };

  return (
    <div
      className={cn(
        // `transform-gpu` + `will-change-transform` evita reflow (apenas composite layer).
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md",
        "transform-gpu will-change-transform transition-transform duration-300 ease-out md:hidden",
        // pb-safe — respeita a barra nativa iOS/Android (home indicator).
        "px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        isVisible ? "translate-y-0" : "translate-y-full",
      )}
      role="region"
      aria-label="Ações rápidas do produto"
      aria-hidden={!isVisible}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        {/* Miniatura discreta — reforça contexto sem distrair */}
        {imageUrl ? (
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        {/* Título abreviado + preço/parcelamento */}
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {productName}
          </span>
          <span className="truncate text-base font-bold text-foreground">{price}</span>
          {installments ? (
            <span className="truncate text-[11px] text-muted-foreground">{installments}</span>
          ) : null}
        </div>

        <Button
          onClick={handlePrimary}
          className={cn(
            "h-11 shrink-0 rounded-full px-4 font-semibold shadow-md",
            isWa
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          aria-label={isWa ? "Fazer orçamento no WhatsApp" : "Comprar agora"}
        >
          {isWa ? (
            <>
              <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
              Orçar
            </>
          ) : (
            <>
              <ShoppingCart className="mr-1.5 h-4 w-4" aria-hidden />
              Comprar
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
