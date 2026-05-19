/**
 * Analytics helpers — wrappers para gtag/fbq.
 *
 * IDs e carregamento de scripts são gerenciados pelo painel admin
 * (tabela store_settings.tracking_config) e injetados via
 * <TrackingScripts /> com filtros por rota.
 *
 * Estas funções aqui apenas DISPARAM eventos — silenciam se gtag/fbq
 * ainda não foram carregados (rota desabilitada ou IDs não configurados).
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

const safeGtag = (...args: any[]) => {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag(...args);
  }
};
const safeFbq = (...args: any[]) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq(...args);
  }
};

export const event = (action: string, params: Record<string, any> = {}) => {
  safeGtag("event", action, params);
};

export const fbEvent = (eventName: string, params?: Record<string, any>) => {
  safeFbq("track", eventName, params);
};

export const trackProductView = (productName: string, productId: string, price: string) => {
  const value = parseFloat(String(price).replace("R$", "").trim().replace(/\./g, "").replace(",", "."));
  event("view_item", {
    currency: "BRL",
    value: isFinite(value) ? value : undefined,
    items: [{ item_id: productId, item_name: productName }],
  });
  fbEvent("ViewContent", {
    content_name: productName,
    content_ids: [productId],
    content_type: "product",
    value: isFinite(value) ? value : undefined,
    currency: "BRL",
  });
};

export const trackInquiry = (productName: string, productId: string) => {
  event("generate_lead", {
    currency: "BRL",
    items: [{ item_id: productId, item_name: productName }],
  });
  fbEvent("Lead", { content_name: productName, content_ids: [productId] });
};

export const trackFormSubmission = (formType: string) => {
  event("form_submission", { form_type: formType });
  fbEvent("Contact", { content_category: formType });
};

export const trackInternalLink = (params: {
  from: string;
  to: string;
  label: string;
  position?: string;
}) => {
  event("internal_link_click", {
    link_from: params.from,
    link_to: params.to,
    link_label: params.label,
    link_position: params.position || "default",
  });
};

/**
 * Click no botão WhatsApp — usado em blog/landings/produto.
 * Aceita campanha/UTM e contexto livre.
 */
export const trackWhatsAppClick = (params: {
  source: string;          // ex: "blog_post", "product_page", "landing_maternidade"
  context?: string;        // ex: slug do post/produto
  utm_campaign?: string;
}) => {
  event("whatsapp_click", {
    source: params.source,
    context: params.context,
    utm_campaign: params.utm_campaign,
  });
  fbEvent("Contact", {
    content_category: "whatsapp",
    content_name: params.source,
  });
};

/**
 * Builda um link wa.me com mensagem + parâmetros UTM consistentes.
 */
export const buildWhatsAppUrl = (params: {
  phone: string;           // ex: "5541992214299"
  message: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}) => {
  const utmParts: string[] = [];
  if (params.utm_source) utmParts.push(`utm_source=${params.utm_source}`);
  if (params.utm_medium) utmParts.push(`utm_medium=${params.utm_medium}`);
  if (params.utm_campaign) utmParts.push(`utm_campaign=${params.utm_campaign}`);
  if (params.utm_content) utmParts.push(`utm_content=${params.utm_content}`);
  const utmTail = utmParts.length ? `\n\nRef: ${utmParts.join("&")}` : "";
  const text = encodeURIComponent(params.message + utmTail);
  return `https://wa.me/${params.phone}?text=${text}`;
};

/** Hook noop — page_view é disparado por TrackingScripts. Mantido por compat. */
export const usePageTracking = () => {
  const location = useLocation();
  useEffect(() => {
    /* TrackingScripts dispara page_view via gtag/fbq quando configurado */
  }, [location]);
};

// ============================================================================
// Funil de conversão PDP — eventos GA + persistência no banco
// (tabela pdp_funnel_events) para o painel admin de funil.
// ============================================================================

const FUNNEL_EVENTS = new Set([
  "pdp_sticky_view",
  "pdp_quick_summary_view",
  "pdp_whatsapp_click",
  "whatsapp_click_confirmed",
  "exit_popup_open",
  "exit_popup_blocked",
  "exit_popup_close",
  "exit_popup_whatsapp_click",
  "pdp_favorite_toggle",
]);

const SESSION_KEY = "__pdp_funnel_sid__";
const getSessionId = (): string => {
  if (typeof window === "undefined") return "ssr";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = (crypto?.randomUUID?.() ?? `sid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "no_storage";
  }
};

export interface FunnelPayload {
  source?: string;
  product_slug?: string;
  quantity?: number;
  personalized?: boolean;
  [k: string]: any;
}

/**
 * Registra evento do funil:
 *  1) dispara em GA (compat com `event()`)
 *  2) persiste em `pdp_funnel_events` para o painel admin (fire-and-forget)
 */
export const trackFunnelEvent = (name: string, payload: FunnelPayload = {}) => {
  event(name, payload);
  if (!FUNNEL_EVENTS.has(name)) return;
  if (typeof window === "undefined") return;

  import("@/integrations/supabase/client")
    .then(({ supabase }) => {
      const { source, product_slug, quantity, personalized, ...rest } = payload;
      return supabase.from("pdp_funnel_events").insert({
        event_name: name,
        source: source ?? null,
        product_slug: product_slug ?? null,
        quantity:
          typeof quantity === "number" ? Math.max(0, Math.min(99999, Math.floor(quantity))) : null,
        personalized: typeof personalized === "boolean" ? personalized : null,
        session_id: getSessionId(),
        meta: Object.keys(rest).length ? (rest as any) : null,
      });
    })
    .catch(() => { /* fire-and-forget — telemetria nunca quebra a UX */ });
};
