/**
 * Correlation-ID based error reporting for the storefront.
 *
 * Goals:
 * - Every user-facing failure (catalog, PDP, cart, checkout) shows a short,
 *   traceable ID that also lands in the console for support triage.
 * - Consistent, human friendly PT-BR copy without leaking internals.
 * - No backend dependency: works even when the backend is unavailable.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short, readable correlation ID (e.g. `ELC-7F2K9A`). */
export const newCorrelationId = (prefix = "ELC"): string => {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return `${prefix}-${out}`;
};

export type ErrorScope =
  | "catalog"
  | "product"
  | "cart"
  | "checkout"
  | "order-tracking"
  | "shipping"
  | "coupon"
  | "unknown";

export interface ReportedError {
  correlationId: string;
  scope: ErrorScope;
  title: string;
  description: string;
  /** Network/offline failures are worth an automatic retry. */
  retryable: boolean;
}

const OFFLINE_HINTS = [
  "failed to fetch",
  "networkerror",
  "load failed",
  "network request failed",
  "err_internet_disconnected",
  "timeout",
  "aborted",
];

export const isNetworkError = (error: unknown): boolean => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String(
    (error as { message?: string })?.message ?? error ?? "",
  ).toLowerCase();
  return OFFLINE_HINTS.some((hint) => msg.includes(hint));
};

const SCOPE_COPY: Record<ErrorScope, string> = {
  catalog: "Não conseguimos carregar o catálogo agora.",
  product: "Não conseguimos carregar este produto agora.",
  cart: "Não conseguimos atualizar seu carrinho agora.",
  checkout: "Não conseguimos concluir seu pedido agora.",
  "order-tracking": "Não conseguimos atualizar o status do pedido agora.",
  shipping: "Não conseguimos calcular o frete agora.",
  coupon: "Não conseguimos validar o cupom agora.",
  unknown: "Algo não saiu como esperado.",
};

/**
 * Normalizes any thrown value into a traceable, user-presentable error.
 * Always logs with the correlation ID so support can match report ↔ console.
 */
export const reportError = (
  scope: ErrorScope,
  error: unknown,
  context?: Record<string, unknown>,
): ReportedError => {
  const correlationId = newCorrelationId();
  const offline = isNetworkError(error);

  const base = SCOPE_COPY[scope] ?? SCOPE_COPY.unknown;
  const description = offline
    ? `${base} Verifique sua conexão — vamos tentar de novo automaticamente. Código: ${correlationId}`
    : `${base} Tente novamente em instantes. Código: ${correlationId}`;

  // eslint-disable-next-line no-console
  console.error(`[${correlationId}] ${scope}`, { error, ...context });

  return {
    correlationId,
    scope,
    title: offline ? "Falha de conexão" : "Ops, algo falhou",
    description,
    retryable: offline,
  };
};

/** Retry with exponential backoff — only for retryable (network) failures. */
export const retryAsync = async <T>(
  fn: (attempt: number) => Promise<T>,
  {
    retries = 2,
    backoffMs = 600,
    shouldRetry = isNetworkError,
  }: {
    retries?: number;
    backoffMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) break;
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  throw lastError;
};
