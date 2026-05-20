import { Truck, Percent, Headset, CreditCard, Shield, Heart, Sparkles, Package, Clock, Star, type LucideIcon } from "lucide-react";
import { useTrustBadgesConfig, type TrustBadgeItem } from "@/hooks/useStoreSettings";

const ICON_MAP: Record<TrustBadgeItem['icon'], LucideIcon> = {
  Truck, Percent, Headset, CreditCard, Shield, Heart, Sparkles, Package, Clock, Star,
};

interface TrustBadgesProps {
  className?: string;
}

const TrustBadges = ({ className = "" }: TrustBadgesProps) => {
  const { data: config } = useTrustBadgesConfig();

  if (!config) return null;

  return (
    <aside
      aria-label="Informações de envio, pagamento e atendimento"
      className={`relative z-10 border-t border-border/50 bg-cream/40 py-7 pb-10 md:py-9 ${className}`}
    >
      <div className="container mx-auto px-4">
        <ul
          role="list"
          className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 md:gap-x-8 lg:gap-x-12 items-start"
        >
          {config.items.map((item, i) => {
            const Icon = ICON_MAP[item.icon] ?? Truck;
            const aria = `${item.title} ${item.subtitle}`.trim();
            return (
              <li
                key={`${item.title}-${i}`}
                aria-label={aria}
                className="flex items-center justify-center md:justify-start gap-3 text-foreground animate-fade-in"
                style={{ animationDelay: `${i * 90}ms`, animationFillMode: "backwards" }}
              >
                <Icon className="h-7 w-7 md:h-8 md:w-8 text-primary shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <div className="leading-tight">
                  <div className="text-sm md:text-base font-semibold">{item.title}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">{item.subtitle}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default TrustBadges;

