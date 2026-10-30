/**
 * Persistência leve do cache público do React Query em localStorage.
 *
 * Objetivo: a vitrine (catálogo, home, menus, configurações) continuar
 * renderizando mesmo quando o backend estiver indisponível/pausado.
 * Não substitui o fetch — apenas hidrata dados anteriores como estado
 * inicial; qualquer resposta nova do servidor sobrescreve o cache.
 *
 * Regras de segurança:
 * - Somente chaves públicas whitelisted são persistidas (nada de admin,
 *   sessão, pedidos ou dados de usuário).
 * - TTL de 24h; entradas expiradas são descartadas na hidratação.
 */
import type { QueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "elc-public-query-cache-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 60;
const SAVE_DEBOUNCE_MS = 1500;

/** Prefixos de queryKey[0] considerados públicos e cacheáveis offline. */
const PUBLIC_KEYS = new Set([
  "products",
  "product",
  "product-by-id",
  "product-by-id-or-slug",
  "categories",
  "occasions",
  "tags",
  "segments",
  "collections",
  "kits",
  "menu_items",
  "home_sections",
  "hero_slides",
  "testimonials",
  "faqs",
  "product_faqs",
  "pdp_sections",
  "seo_config",
  "footer_config",
  "payment_config",
  "trust_badges_config",
  "feature_flags",
  "pages",
]);

type PersistedEntry = { key: unknown[]; data: unknown; ts: number };

function isPublicKey(key: readonly unknown[]): boolean {
  const head = key[0];
  if (typeof head !== "string") return false;
  if (head.startsWith("admin")) return false;
  return PUBLIC_KEYS.has(head);
}

function safeParse(raw: string | null): PersistedEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedEntry[]) : [];
  } catch {
    return [];
  }
}

/** Hidrata o cache com os dados persistidos (chamar antes do render). */
export function hydratePersistedQueries(client: QueryClient): void {
  if (typeof window === "undefined") return;
  let entries: PersistedEntry[] = [];
  try {
    entries = safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return;
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry || !Array.isArray(entry.key)) continue;
    if (now - (entry.ts ?? 0) > MAX_AGE_MS) continue;
    if (!isPublicKey(entry.key)) continue;
    if (client.getQueryData(entry.key) !== undefined) continue;
    try {
      client.setQueryData(entry.key, entry.data, { updatedAt: entry.ts });
    } catch {
      /* entrada corrompida — ignora */
    }
  }
}

/** Assina o cache e grava (debounced) as queries públicas bem-sucedidas. */
export function installQueryPersistence(client: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    timer = null;
    try {
      const entries: PersistedEntry[] = [];
      for (const query of client.getQueryCache().getAll()) {
        if (query.state.status !== "success") continue;
        if (query.state.data === undefined) continue;
        if (!isPublicKey(query.queryKey)) continue;
        entries.push({
          key: query.queryKey as unknown[],
          data: query.state.data,
          ts: query.state.dataUpdatedAt || Date.now(),
        });
      }
      entries.sort((a, b) => b.ts - a.ts);
      const payload = JSON.stringify(entries.slice(0, MAX_ENTRIES));
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // Quota excedida ou storage indisponível: limpa e desiste silenciosamente.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
    }
  };

  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) return;
    timer = setTimeout(save, SAVE_DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
