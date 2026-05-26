// Hook de rastreamento de visitantes — Fase 2 (telemetria agressiva, Opção B).
// Captura device/UTM/referrer SEMPRE no init, dispara pageview a cada rota e
// envia heartbeats de DELTA (segundos desde o último envio), nunca tempo total.
// Consentimento LGPD continua sendo registrado, mas NÃO bloqueia mais a captura.
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

function buildDevicePayload() {
  const ua = navigator.userAgent;
  const uaInfo = parseUA(ua);
  return {
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
  };
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
  const lastHeartbeatAt = useRef<number>(Date.now()); // base para cálculo de delta
  const lastPath = useRef<string>("");

  // INIT — captura device + UTM + referrer (1x por carregamento)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Admin é exceção: continua sem trackear
    if (location.pathname.startsWith("/admin")) return;

    const search = new URLSearchParams(window.location.search);
    send({
      visitor_id: getOrCreateVisitorId(),
      event: "init",
      device: buildDevicePayload(),
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

  // PAGEVIEW + flush de heartbeat ao mudar de rota
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;

    // Flush do delta acumulado na página anterior antes de virar
    if (lastPath.current && lastPath.current !== location.pathname) {
      const deltaMs = Date.now() - lastHeartbeatAt.current;
      const delta = Math.max(1, Math.floor(deltaMs / 1000));
      send({
        visitor_id: getOrCreateVisitorId(),
        event: "heartbeat",
        delta_seconds: delta,
        scroll_depth: Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100),
      });
    }

    pageStart.current = Date.now();
    lastHeartbeatAt.current = Date.now();
    const fromPath = lastPath.current || null;
    lastPath.current = location.pathname;

    const productSlug = location.pathname.startsWith("/produto/") || location.pathname.startsWith("/produtos/")
      ? params.slug || location.pathname.split("/").pop()
      : undefined;

    // Reenvia device a cada pageview também (auto-heal de campos faltantes — barato)
    send({
      visitor_id: getOrCreateVisitorId(),
      event: "pageview",
      path: location.pathname + location.search,
      title: document.title,
      product_slug: productSlug,
      referrer: document.referrer || null,
      from_path: fromPath,
      device: buildDevicePayload(),
    });
  }, [location.pathname, location.search, params.slug]);

  // Heartbeat periódico (30s) — envia DELTA acumulado
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const deltaMs = Date.now() - lastHeartbeatAt.current;
      const delta = Math.max(1, Math.floor(deltaMs / 1000));
      if (delta < 5) return;
      send({
        visitor_id: getOrCreateVisitorId(),
        event: "heartbeat",
        delta_seconds: delta,
        scroll_depth: Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100),
      });
      lastHeartbeatAt.current = Date.now();
    }, 30000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // Heartbeat final ao sair / esconder a aba
  useEffect(() => {
    const onHide = () => {
      if (location.pathname.startsWith("/admin")) return;
      const deltaMs = Date.now() - lastHeartbeatAt.current;
      const delta = Math.max(1, Math.floor(deltaMs / 1000));
      if (delta < 1) return;
      send({
        visitor_id: getOrCreateVisitorId(),
        event: "heartbeat",
        delta_seconds: delta,
        scroll_depth: Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100),
      }, true);
      lastHeartbeatAt.current = Date.now();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") onHide();
      else lastHeartbeatAt.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, [location.pathname]);
}
