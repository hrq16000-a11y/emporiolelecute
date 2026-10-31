// Lightweight client-side telemetry. Captures runtime errors with as much
// context as we can collect (source, route, component stack, user agent,
// breadcrumbs, correlation id, network failures) and persists them to
// `stale_bundle_logs` so admins can diagnose production issues without
// needing the user's devtools.
import { supabase } from "@/integrations/supabase/client";

type ErrorSource =
  | "react-boundary"
  | "window-error"
  | "unhandled-rejection"
  | "fetch-error"
  | "xhr-error"
  | "manual"
  // Sprint 4 — fase final: eventos operacionais nomeados.
  | "ui_error_boundary"
  | "supabase_query_slow"
  | "image_load_fail"
  | "cta_resolution_fail";

/**
 * Sprint 4 — emite um evento operacional nomeado para a tabela de telemetria.
 * Use para sinais de degradação que NÃO são exceptions (queries lentas,
 * falha de imagem, CTA inconsistente). Throttled e best-effort como os erros.
 */
export function logTelemetryEvent(
  event:
    | "ui_error_boundary"
    | "supabase_query_slow"
    | "image_load_fail"
    | "cta_resolution_fail",
  message: string,
  extra?: Record<string, unknown>,
) {
  void logClientError({ source: event, message, extra });
}

// Limite acima do qual uma query Supabase é considerada lenta.
const SUPABASE_SLOW_MS = Math.max(
  500,
  Number((import.meta as any).env?.VITE_SUPABASE_SLOW_MS) || 2500,
);

interface LogParams {
  source: ErrorSource;
  message: string;
  stack?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
}

// ---------- Correlation ID (per session) ----------
// A stable id stored in sessionStorage so every log emitted during a single
// browser session shares the same identifier. Lets admins group breadcrumbs +
// errors that belong to the same incident.
const CID_KEY = "lc_telemetry_cid";

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return (crypto as Crypto).randomUUID();
    }
  } catch { /* fallthrough */ }
  return "cid-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function getCorrelationId(): string {
  if (typeof sessionStorage === "undefined") return "no-session";
  let cid = sessionStorage.getItem(CID_KEY);
  if (!cid) {
    cid = uuid();
    try { sessionStorage.setItem(CID_KEY, cid); } catch { /* ignore */ }
  }
  return cid;
}

export function getTelemetryCorrelationId(): string {
  return getCorrelationId();
}

// ---------- Breadcrumbs ----------
const breadcrumbs: Array<{ t: number; type: string; detail: string }> = [];
const MAX_BREADCRUMBS = 25;

export function pushBreadcrumb(type: string, detail: string) {
  breadcrumbs.push({ t: Date.now(), type, detail: detail.slice(0, 200) });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

// ---------- Throttle ----------
const recentKeys = new Map<string, number>();
const THROTTLE_MS = 10_000;

function shouldThrottle(key: string) {
  const now = Date.now();
  const last = recentKeys.get(key) || 0;
  if (now - last < THROTTLE_MS) return true;
  recentKeys.set(key, now);
  if (recentKeys.size > 50) {
    for (const [k, ts] of recentKeys) {
      if (now - ts > THROTTLE_MS) recentKeys.delete(k);
    }
  }
  return false;
}

export async function logClientError(params: LogParams) {
  const { source, message, stack, componentStack, extra } = params;
  const route = typeof location !== "undefined" ? location.pathname + location.search : "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const viewport =
    typeof window !== "undefined"
      ? `${window.innerWidth}x${window.innerHeight}`
      : "";
  const cid = getCorrelationId();

  const payloadKey = `${source}|${(message || "").slice(0, 120)}`;
  if (shouldThrottle(payloadKey)) return;

  const componentName = componentStack
    ? (componentStack.trim().split("\n")[0] || "").replace(/^\s*(in|at)\s+/, "").trim()
    : undefined;

  const enrichedStack = [
    `--- correlation_id ---\n${cid}`,
    componentStack ? `--- componentStack ---\n${componentStack}` : "",
    stack ? `--- errorStack ---\n${stack}` : "",
    `--- breadcrumbs ---\n${JSON.stringify(breadcrumbs.slice(-15))}`,
    `--- context ---\n${JSON.stringify({ viewport, extra: extra || {} })}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Tag format: [cid:xxx] [source][component] message
  // Telemetry viewer parses this prefix to extract correlation id + component.
  const tagged =
    `[cid:${cid.slice(0, 8)}] [${source}]` +
    `${componentName ? `[${componentName}]` : ""} ${message}`;

  // eslint-disable-next-line no-console
  console.error("[telemetry]", tagged, { route, cid, componentName, extra, stack, componentStack });

  try {
    await (supabase as any).from("stale_bundle_logs").insert({
      route,
      message: tagged.slice(0, 2000),
      stack: enrichedStack.slice(0, 8000),
      user_agent: ua.slice(0, 1000),
      reloaded: false,
    });
  } catch {
    /* best-effort, never throw from telemetry */
  }
}

// ---------- Fetch / XHR wrapping ----------
// Capture network failures (network errors and 5xx). 4xx is intentionally
// skipped to avoid noise from validation/auth flows.

function describeFetchInput(input: RequestInfo | URL): { url: string; method: string } {
  try {
    if (typeof input === "string") return { url: input, method: "GET" };
    if (input instanceof URL) return { url: input.toString(), method: "GET" };
    const req = input as Request;
    return { url: req.url, method: req.method || "GET" };
  } catch {
    return { url: String(input), method: "GET" };
  }
}

function shouldSkipUrl(url: string) {
  // Avoid feedback loop: never log the telemetry insert itself.
  if (!url) return true;
  if (url.includes("/rest/v1/stale_bundle_logs")) return true;
  // Analytics beacon (best-effort, non-critical): falha aqui não afeta a loja e
  // gera ruído/loop de logs quando bloqueada por adblock ou rede instável.
  if (url.includes("/functions/v1/track-visit")) return true;
  return false;
}

function safeBodyPreview(init?: RequestInit): string | undefined {
  if (!init || init.body == null) return undefined;
  try {
    if (typeof init.body === "string") return init.body.slice(0, 500);
    if (init.body instanceof FormData) return "[FormData]";
    if (init.body instanceof Blob) return `[Blob ${init.body.size}b]`;
    if (init.body instanceof ArrayBuffer) return `[ArrayBuffer ${init.body.byteLength}b]`;
    return JSON.stringify(init.body).slice(0, 500);
  } catch {
    return "[unserializable]";
  }
}

function installFetchCapture() {
  if (typeof window === "undefined" || !window.fetch) return;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const { url, method: defaultMethod } = describeFetchInput(input);
    const method = (init?.method || defaultMethod || "GET").toUpperCase();
    const start = Date.now();
    try {
      const res = await orig(input as RequestInfo, init);
      const duration = Date.now() - start;
      if (res.status >= 500 && !shouldSkipUrl(url)) {
        void logClientError({
          source: "fetch-error",
          message: `fetch ${res.status} ${method} ${url}`,
          extra: {
            url,
            method,
            status: res.status,
            statusText: res.statusText,
            durationMs: duration,
            requestBody: safeBodyPreview(init),
          },
        });
      }
      // Sprint 4 — query Supabase lenta (REST ou RPC). Ignora telemetria.
      if (
        duration >= SUPABASE_SLOW_MS &&
        !shouldSkipUrl(url) &&
        /\/(rest|functions)\/v1\//.test(url) &&
        res.status < 500
      ) {
        logTelemetryEvent(
          "supabase_query_slow",
          `slow ${method} ${url} ${duration}ms`,
          { url, method, status: res.status, durationMs: duration },
        );
      }
      return res;
    } catch (err) {
      if (!shouldSkipUrl(url)) {
        const e = err as Error;
        void logClientError({
          source: "fetch-error",
          message: `fetch network error ${method} ${url}: ${e?.message || "unknown"}`,
          stack: e?.stack,
          extra: {
            url,
            method,
            durationMs: Date.now() - start,
            requestBody: safeBodyPreview(init),
          },
        });
      }
      throw err;
    }
  };
}

function installXhrCapture() {
  if (typeof window === "undefined" || !window.XMLHttpRequest) return;
  const Xhr = window.XMLHttpRequest;
  const origOpen = Xhr.prototype.open;
  const origSend = Xhr.prototype.send;

  Xhr.prototype.open = function (
    this: XMLHttpRequest & { __lc?: { method: string; url: string; start: number } },
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__lc = { method: (method || "GET").toUpperCase(), url: String(url), start: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (origOpen as any).call(this, method, url, ...rest);
  };

  Xhr.prototype.send = function (
    this: XMLHttpRequest & { __lc?: { method: string; url: string; start: number } },
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const meta = this.__lc;
    if (meta) {
      meta.start = Date.now();
      const onErr = (kind: "error" | "timeout" | "abort") => {
        if (shouldSkipUrl(meta.url)) return;
        void logClientError({
          source: "xhr-error",
          message: `xhr ${kind} ${meta.method} ${meta.url}`,
          extra: {
            url: meta.url,
            method: meta.method,
            kind,
            durationMs: Date.now() - meta.start,
            requestBody: typeof body === "string" ? body.slice(0, 500) : body ? "[non-string body]" : undefined,
          },
        });
      };
      this.addEventListener("error", () => onErr("error"));
      this.addEventListener("timeout", () => onErr("timeout"));
      this.addEventListener("loadend", () => {
        if (this.readyState === 4 && this.status >= 500 && !shouldSkipUrl(meta.url)) {
          void logClientError({
            source: "xhr-error",
            message: `xhr ${this.status} ${meta.method} ${meta.url}`,
            extra: {
              url: meta.url,
              method: meta.method,
              status: this.status,
              durationMs: Date.now() - meta.start,
            },
          });
        }
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (origSend as any).call(this, body as any);
  };
}

let installed = false;

export function installTelemetry() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Initialize correlation id eagerly so it appears in console early.
  const cid = getCorrelationId();
  // eslint-disable-next-line no-console
  console.info("[telemetry] session correlation id:", cid);

  // Track route changes as breadcrumbs.
  const origPush = history.pushState;
  history.pushState = function (...args) {
    pushBreadcrumb("navigate", String(args[2] ?? location.pathname));
    return origPush.apply(this, args as any);
  };
  window.addEventListener("popstate", () =>
    pushBreadcrumb("popstate", location.pathname)
  );
  window.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const el = t.closest("button,a,[role=button]") as HTMLElement | null;
      if (!el) return;
      const label =
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        (el.textContent || "").trim().slice(0, 60) ||
        el.tagName.toLowerCase();
      pushBreadcrumb("click", `${el.tagName.toLowerCase()}:${label}`);
    },
    { capture: true }
  );

  window.addEventListener("error", (e) => {
    if (!e.error && !e.message) return;
    const err = e.error as Error | undefined;
    void logClientError({
      source: "window-error",
      message: e.message || err?.message || "Unknown error",
      stack: err?.stack,
      extra: {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason?.message || JSON.stringify(reason)?.slice(0, 500) || "Unhandled rejection";
    const stack = typeof reason === "object" ? reason?.stack : undefined;
    void logClientError({
      source: "unhandled-rejection",
      message,
      stack,
    });
  });

  installFetchCapture();
  installXhrCapture();
}
