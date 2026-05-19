import { useEffect, useRef } from "react";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { PdpBadgeConfig } from "@/hooks/useConversionCtaConfig";

interface PdpBadgeProps {
  config: PdpBadgeConfig;
  productId?: string;
  productSlug?: string;
  /** 'global' = vindo da config geral; 'product_override' = vindo do produto. */
  source?: "global" | "product_override";
  /** Quando true, desativa tracking (usado no preview do admin). */
  previewOnly?: boolean;
  /** Posicionamento absoluto dentro de um container relative. */
  absolute?: boolean;
  onClick?: () => void;
}

const TONE_CLASSES: Record<string, string> = {
  coral: "bg-primary hover:bg-primary/90",
  green: "bg-emerald-600 hover:bg-emerald-700",
  amber: "bg-amber-500 hover:bg-amber-600",
  neutral: "bg-foreground/80 hover:bg-foreground",
  blue: "bg-blue-600 hover:bg-blue-700",
};

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("pdp_session_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("pdp_session_id", id);
    }
    return id;
  } catch {
    return "no-session";
  }
}

async function logEvent(payload: Record<string, unknown>) {
  try {
    await supabase.from("pdp_badge_events").insert(payload as any);
  } catch {
    // best-effort
  }
}

export function PdpBadge({
  config,
  productId,
  productSlug,
  source = "global",
  previewOnly = false,
  absolute = true,
  onClick,
}: PdpBadgeProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef(false);

  useEffect(() => {
    if (previewOnly || !config.enabled || !ref.current) return;
    const el = ref.current;
    const sessionKey = `pdp_badge_imp_${productId || productSlug || "x"}`;
    try {
      if (sessionStorage.getItem(sessionKey)) {
        seenRef.current = true;
        return;
      }
    } catch {/* noop */}

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !seenRef.current) {
            seenRef.current = true;
            try { sessionStorage.setItem(sessionKey, "1"); } catch {/* noop */}
            logEvent({
              event_name: "impression",
              product_id: productId ?? null,
              product_slug: productSlug ?? null,
              badge_label: config.label,
              tone: config.tone,
              position: config.position,
              source,
              session_id: getSessionId(),
              user_agent: navigator.userAgent.slice(0, 200),
            });
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [previewOnly, config.enabled, config.label, config.tone, config.position, productId, productSlug, source]);

  if (!config.enabled || !config.label) return null;

  const positionStyle: React.CSSProperties = absolute
    ? (() => {
        const s: React.CSSProperties = { position: "absolute", zIndex: 10 };
        if (config.position.startsWith("top")) s.top = config.offsetY;
        else s.bottom = config.offsetY;
        if (config.position.endsWith("left")) s.left = config.offsetX;
        else s.right = config.offsetX;
        return s;
      })()
    : {};

  const tone = TONE_CLASSES[config.tone] ?? TONE_CLASSES.blue;
  const interactive = !!onClick && !previewOnly;

  const handleClick = () => {
    if (!interactive) return;
    logEvent({
      event_name: "click",
      product_id: productId ?? null,
      product_slug: productSlug ?? null,
      badge_label: config.label,
      tone: config.tone,
      position: config.position,
      source,
      session_id: getSessionId(),
      user_agent: navigator.userAgent.slice(0, 200),
    });
    onClick?.();
  };

  return (
    <div ref={ref} style={positionStyle}>
      <Badge
        data-testid="pdp-badge"
        onClick={interactive ? handleClick : undefined}
        className={`max-w-[calc(100vw-7rem)] text-white px-2.5 sm:px-3 py-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs leading-tight shadow-md ${tone} ${
          interactive ? "cursor-pointer" : ""
        }`}
      >
        {config.showIcon && <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />}
        <span className="truncate">{config.label}</span>
      </Badge>
    </div>
  );
}

/** Resolve qual badge usar: override do produto ou config global. */
export function resolveEffectiveBadge(
  global: PdpBadgeConfig | undefined,
  override: unknown
): { config: PdpBadgeConfig; source: "global" | "product_override" } | null {
  const o = (override && typeof override === "object" ? override : null) as Partial<PdpBadgeConfig> | null;
  if (o && o.enabled) {
    return {
      config: {
        enabled: true,
        label: o.label ?? global?.label ?? "",
        showIcon: o.showIcon ?? global?.showIcon ?? true,
        tone: (o.tone as any) ?? global?.tone ?? "blue",
        position: (o.position as any) ?? global?.position ?? "top-left",
        offsetX: typeof o.offsetX === "number" ? o.offsetX : global?.offsetX ?? 12,
        offsetY: typeof o.offsetY === "number" ? o.offsetY : global?.offsetY ?? 12,
      },
      source: "product_override",
    };
  }
  if (global?.enabled) {
    return { config: global, source: "global" };
  }
  return null;
}
