// Fase 2 SAFE — Normalização e similaridade de busca no cliente.
// Espelha a função SQL `public.normalize_search` (lower + unaccent) usando
// a API nativa do JS. Mantém retrocompatibilidade total com a busca atual
// (continua sendo um filtro substring), apenas eliminando falhas silenciosas
// causadas por acento, caixa ou espaços extras.

export function normalizeSearch(input: string): string {
  return (input ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Distância de Levenshtein iterativa (limite de 32 chars — suficiente para
// nomes de produtos). Usada apenas para sugerir "Você quis dizer..." quando
// a busca exata não retorna nada.
export function levenshtein(a: string, b: string): number {
  const s = a.slice(0, 32);
  const t = b.slice(0, 32);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j];
  }
  return prev[t.length];
}

// Sugere o termo mais próximo dentro de um pool (nomes de produtos, sinônimos…).
// Aceita correspondência se a distância normalizada for ≤ ~30% do tamanho.
export function suggestClosest(query: string, pool: string[]): string | null {
  const q = normalizeSearch(query);
  if (q.length < 3) return null;
  let best: { term: string; dist: number } | null = null;
  for (const raw of pool) {
    const cand = normalizeSearch(raw);
    if (!cand) continue;
    // Match imediato por substring — não é "did you mean", deixa em branco.
    if (cand.includes(q) || q.includes(cand)) return null;
    const d = levenshtein(q, cand);
    if (!best || d < best.dist) best = { term: raw, dist: d };
  }
  if (!best) return null;
  const tolerance = Math.max(1, Math.floor(q.length * 0.34));
  return best.dist <= tolerance ? best.term : null;
}
