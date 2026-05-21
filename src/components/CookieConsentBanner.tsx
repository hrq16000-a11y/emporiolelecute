// Banner de consentimento LGPD — compacto, controlado pelo admin via cookie_consent_config.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { getConsentStatus, recordConsent } from "@/hooks/useVisitorTracking";
import { supabase } from "@/integrations/supabase/client";

type Config = {
  is_enabled: boolean;
  title: string;
  message: string;
  accept_label: string;
  reject_label: string;
  policy_label: string;
  policy_url: string;
  delay_ms: number;
  position: "bottom" | "top";
  variant: "compact" | "full";
  show_icon: boolean;
};

const DEFAULT_CFG: Config = {
  is_enabled: true,
  title: "Sua privacidade importa 🍪",
  message:
    "Usamos cookies para melhorar sua experiência e mostrar produtos relevantes. Aceite para liberar tudo ou recuse para o essencial.",
  accept_label: "Aceitar",
  reject_label: "Recusar",
  policy_label: "Política de Privacidade",
  policy_url: "/politica-de-privacidade",
  delay_ms: 1500,
  position: "bottom",
  variant: "compact",
  show_icon: true,
};

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<Config>(DEFAULT_CFG);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("cookie_consent_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const merged: Config = { ...DEFAULT_CFG, ...(data ?? {}) } as Config;
      setCfg(merged);
      if (!merged.is_enabled) return;
      if (getConsentStatus() !== "pending") return;
      const t = setTimeout(() => setVisible(true), merged.delay_ms);
      return () => clearTimeout(t);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const handle = (accepted: boolean) => {
    recordConsent(accepted);
    setVisible(false);
  };

  const posClass = cfg.position === "top" ? "top-0" : "bottom-0";
  const isCompact = cfg.variant === "compact";

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className={`fixed inset-x-0 ${posClass} z-[100] p-2 sm:p-3 pointer-events-none`}
    >
      <div
        className={`mx-auto ${
          isCompact ? "max-w-4xl" : "max-w-3xl"
        } bg-card/95 backdrop-blur border border-border shadow-lg rounded-full ${
          isCompact ? "py-2 pl-3 pr-2 sm:py-2.5 sm:pl-4 sm:pr-3" : "rounded-xl p-4 sm:p-5"
        } pointer-events-auto flex ${
          isCompact ? "items-center" : "flex-col sm:flex-row items-start"
        } gap-2 sm:gap-3`}
      >
        {cfg.show_icon && (
          <div
            className={`hidden sm:flex shrink-0 ${
              isCompact ? "w-7 h-7" : "w-10 h-10"
            } rounded-full bg-primary/10 items-center justify-center`}
          >
            <Cookie className={isCompact ? "w-3.5 h-3.5 text-primary" : "w-5 h-5 text-primary"} />
          </div>
        )}
        <div
          className={`flex-1 min-w-0 ${
            isCompact ? "text-xs sm:text-[13px]" : "text-sm"
          } text-foreground leading-snug`}
        >
          {!isCompact && <p className="font-semibold mb-1">{cfg.title}</p>}
          <p className={isCompact ? "text-muted-foreground truncate sm:whitespace-normal sm:line-clamp-2" : "text-muted-foreground"}>
            {isCompact ? (
              <>
                <span className="font-medium text-foreground mr-1">{cfg.title}</span>
                {cfg.message}{" "}
              </>
            ) : (
              <>{cfg.message} </>
            )}
            <Link to={cfg.policy_url} className="text-primary hover:underline whitespace-nowrap">
              {cfg.policy_label}
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => handle(false)}
            className={`${
              isCompact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
            } rounded-full border border-border bg-background hover:bg-muted text-foreground transition-colors`}
          >
            {cfg.reject_label}
          </button>
          <button
            onClick={() => handle(true)}
            className={`${
              isCompact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
            } rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors`}
          >
            {cfg.accept_label}
          </button>
          <button
            aria-label="Fechar"
            onClick={() => handle(false)}
            className={`hidden sm:flex items-center justify-center ${
              isCompact ? "w-8 h-8" : "w-9 h-9"
            } rounded-full hover:bg-muted text-muted-foreground`}
          >
            <X className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </button>
        </div>
      </div>
    </div>
  );
}
