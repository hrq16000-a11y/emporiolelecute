import { useEffect, useRef } from "react";
import { MessageCircle, Package, Clock, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackFunnelEvent } from "@/lib/analytics";
import { normalizePersonalization, normalizeQuantity } from "@/lib/whatsappTemplate";

interface QuickQuoteSummaryProps {
  minQuantity: number;
  productionDays: number;
  quantity: number;
  personalization?: string;
  onWhatsApp: () => void;
  productSlug?: string;
  enabled?: boolean;
  title?: string;
  minLabel?: string;
  prazoLabel?: string;
  shippingLabel?: string;
  shippingValue?: string;
  ctaLabel?: string;
}

export const QuickQuoteSummary = ({
  minQuantity,
  productionDays,
  quantity,
  personalization,
  onWhatsApp,
  productSlug,
  enabled = true,
  title = "Resumo rápido do pedido",
  minLabel = "Mínimo",
  prazoLabel = "Prazo",
  shippingLabel = "Envio",
  shippingValue = "Brasil",
  ctaLabel = "Pedir orçamento no WhatsApp",
}: QuickQuoteSummaryProps) => {
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!enabled || viewedRef.current) return;
    viewedRef.current = true;
    trackFunnelEvent("pdp_quick_summary_view", { product_slug: productSlug });
  }, [enabled, productSlug]);

  if (!enabled) return null;

  const safeQty = normalizeQuantity(quantity);
  const hasPerson = Boolean(normalizePersonalization(personalization));

  return (
    <section
      aria-label={title}
      className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6"
    >
      {/* Selos (Mínimo/Prazo/Envio) removidos daqui — já exibidos no bloco principal
          de preço (Quick trust row), evitando duplicação visual no mobile. */}

      <div className="text-xs text-muted-foreground mb-3 text-center">
        Você está pedindo{" "}
        <span className="font-semibold text-foreground">
          {safeQty} unidade{safeQty > 1 ? "s" : ""}
        </span>
        {hasPerson ? " com personalização" : ""}.
      </div>

      <Button
        type="button"
        onClick={onWhatsApp}
        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-lg"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        {ctaLabel}
      </Button>
    </section>
  );
};
