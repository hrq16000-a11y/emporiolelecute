// Cache local de dados do cliente e endereço — evita repetir chamadas IP/GPS
// e re-digitação a cada visita.
const CUSTOMER_KEY = 'lc_customer_v1';
const ADDRESS_KEY = 'lc_address_v1';
const ADDRESS_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

export interface CachedCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface CachedAddress {
  cep?: string;
  city?: string;
  state?: string;
  savedAt: number;
}

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

export const loadCustomer = (): CachedCustomer | null => {
  if (typeof window === 'undefined') return null;
  return safeParse<CachedCustomer>(localStorage.getItem(CUSTOMER_KEY));
};

export const saveCustomer = (data: CachedCustomer) => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data)); } catch {}
};

export const loadAddress = (): CachedAddress | null => {
  if (typeof window === 'undefined') return null;
  const parsed = safeParse<CachedAddress>(localStorage.getItem(ADDRESS_KEY));
  if (!parsed) return null;
  if (Date.now() - (parsed.savedAt || 0) > ADDRESS_TTL_MS) return null;
  return parsed;
};

export const saveAddress = (data: Omit<CachedAddress, 'savedAt'>) => {
  if (typeof window === 'undefined') return;
  if (!data.cep && !data.city) return;
  try {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {}
};
