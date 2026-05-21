// Hook de rastreamento de visitantes — gera visitor_id persistente, envia eventos
// para a Edge Function track-visit. Respeita consentimento LGPD (não envia nada
// até o usuário aceitar o banner, exceto o próprio evento de consent).
import { useEffect, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import { parseUA } from "@/lib/uaParser";

const STORAGE_KEY = "elc_visitor_id";
const CONSENT_KEY = "elc_cookie_consent";
const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-visit`;

function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

function send(payload: Record<string, unknown>, useBeacon = false) {
  const body = JSON.stringify(payload);
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    return;
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => { /* silencioso */ });
}

function readConsent(): "pending" | "accepted" | "rejected" {
  return (localStorage.getItem(CONSENT_KEY) as "accepted" | "rejected" | null) ?? "pending";
}

export function recordConsent(accepted: boolean) {
  localStorage.setItem(CONSENT_KEY, accepted ? "accepted" : "rejected");
  send({
    visitor_id: getOrCreateVisitorId(),
    event: "consent",
    accepted,
    categories: { analytics: accepted, tracking: accepted },
  });
}

export function getConsentStatus() {
  return readConsent();
}

export function useVisitorTracking() {
  const location = useLocation();
  const params = useParams<{ slug?: string }>();
  const initialized = useRef(false);
  const pageStart = useRef<number>(Date.now());
  const lastPath = useRef<string>("");

  // INIT — captura device, UTM, referrer 1x
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Não traqueia rotas /admin
    if (location.pathname.startsWith("/admin")) return;

    const visitor_id = getOrCreateVisitorId();
    const ua = navigator.userAgent;
    const uaInfo = parseUA(ua);
    const search = new URLSearchParams(window.location.search);

    send({
      visitor_id,
      event: "init",
      device: {
        ...uaInfo,
        screen_w: window.screen.width,
        screen_h: window.screen.height,
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
        pixel_ratio: window.devicePixelRatio,
        color_depth: window.screen.colorDepth,
        language: navigator.language,
        languages: navigator.languages?.slice(0, 5),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        touch_support: "ontouchstart" in window,
      },
      utm: {
        utm_source: search.get("utm_source"),
        utm_medium: search.get("utm_medium"),
        utm_campaign: search.get("utm_campaign"),
        utm_term: search.get("utm_term"),
        utm_content: search.get("utm_content"),
      },
      referrer: document.referrer || null,
      landing_path: location.pathname,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // PAGEVIEW em mudança de rota
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    if (readConsent() !== "accepted") return;

    // Envia heartbeat da página anterior antes de mudar
    if (lastPath.current && lastPath.current !== location.pathname) {
      const elapsed = Math.floor((Date.now() - pageStart.current) / 1000);
      if (elapsed > 1) {
        send({
          visitor_id: getOrCreateVisitorId(),
          event: "heartbeat",
          time_on_page: elapsed,
          scroll_depth: Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100),
        });
      }
    }

    pageStart.current = Date.now();
    lastPath.current = location.pathname;

    const productSlug = location.pathname.startsWith("/produto/") || location.pathname.startsWith("/produtos/")
      ? params.slug || location.pathname.split("/").pop()
      : undefined;

    send({
      visitor_id: getOrCreateVisitorId(),
      event: "pageview",
      path: location.pathname + location.search,
      title: document.title,
      product_slug: productSlug,
      referrer: document.referrer || null,
    });
  }, [location.pathname, location.search, params.slug]);

  // Heartbeat ao sair da página
  useEffect(() => {
    const onHide = () => {
      if (readConsent() !== "accepted") return;
      if (location.pathname.startsWith("/admin")) return;
      const elapsed = Math.floor((Date.now() - pageStart.current) / 1000);
      if (elapsed > 1) {
        send({
          visitor_id: getOrCreateVisitorId(),
          event: "heartbeat",
          time_on_page: elapsed,
          scroll_depth: Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100),
        }, true);
      }
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
    };
  }, [location.pathname]);
}
