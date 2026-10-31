/**
 * Fuzzy matching entre nomes de produtos (ex.: título do Elo7 x catálogo da loja).
 *
 * Combina três sinais e devolve uma "explicação" legível do porquê do match,
 * usada nos painéis de auditoria para o admin entender a sugestão.
 *  - Dice coefficient sobre bigramas (tolera erros de digitação)
 *  - Sobreposição de tokens (palavras em comum)
 *  - Bônus por prefixo/contenção literal
 */

export interface MatchExplanation {
  score: number;
  bigram: number;
  tokenOverlap: number;
  containment: number;
  sharedTokens: string[];
  missingTokens: string[];
  reason: string;
}

export interface MatchCandidate<T> {
  item: T;
  label: string;
}

export interface MatchResult<T> {
  item: T;
  label: string;
  explanation: MatchExplanation;
}

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'por', 'em', 'um', 'uma',
  'o', 'a', 'os', 'as', 'no', 'na', 'kit', 'un', 'unidades', 'personalizado',
  'personalizada', 'lembrancinha', 'lembrancinhas',
]);

export const normalizeText = (value: string): string =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(' ')
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

const bigrams = (value: string): Set<string> => {
  const clean = normalizeText(value).replace(/\s/g, '');
  const out = new Set<string>();
  for (let i = 0; i < clean.length - 1; i += 1) out.add(clean.slice(i, i + 2));
  return out;
};

/** Dice coefficient (0..1) entre bigramas das duas strings. */
export const diceCoefficient = (a: string, b: string): number => {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  A.forEach((g) => {
    if (B.has(g)) shared += 1;
  });
  return (2 * shared) / (A.size + B.size);
};

/** Similaridade combinada + explicação legível. */
export function explainMatch(source: string, target: string): MatchExplanation {
  const sourceTokens = tokenize(source);
  const targetTokens = tokenize(target);
  const targetSet = new Set(targetTokens);

  const sharedTokens = sourceTokens.filter((t) => targetSet.has(t));
  const missingTokens = sourceTokens.filter((t) => !targetSet.has(t));

  const bigram = diceCoefficient(source, target);
  const tokenOverlap = sourceTokens.length
    ? sharedTokens.length / Math.max(sourceTokens.length, targetTokens.length || 1)
    : 0;

  const ns = normalizeText(source);
  const nt = normalizeText(target);
  const containment = ns && nt && (ns.includes(nt) || nt.includes(ns)) ? 1 : 0;

  const score = Math.min(1, bigram * 0.5 + tokenOverlap * 0.4 + containment * 0.1);

  const parts: string[] = [];
  if (containment) parts.push('um título contém o outro literalmente');
  if (sharedTokens.length) parts.push(`palavras em comum: ${sharedTokens.join(', ')}`);
  parts.push(`similaridade textual ${(bigram * 100).toFixed(0)}%`);
  if (missingTokens.length) parts.push(`sem correspondência: ${missingTokens.slice(0, 5).join(', ')}`);

  return {
    score,
    bigram,
    tokenOverlap,
    containment,
    sharedTokens,
    missingTokens,
    reason: parts.join(' · '),
  };
}

/** Ordena candidatos pelo score e devolve os melhores acima do limiar. */
export function findBestMatches<T>(
  source: string,
  candidates: MatchCandidate<T>[],
  { threshold = 0.45, limit = 5 }: { threshold?: number; limit?: number } = {},
): MatchResult<T>[] {
  return candidates
    .map((c) => ({ item: c.item, label: c.label, explanation: explainMatch(source, c.label) }))
    .filter((r) => r.explanation.score >= threshold)
    .sort((a, b) => b.explanation.score - a.explanation.score)
    .slice(0, limit);
}

/** Classificação sugerida a partir do score (limiar configurável). */
export function classifyScore(score: number, threshold = 0.45): 'confirmed' | 'doubtful' | 'no_match' {
  if (score >= Math.max(threshold, 0.75)) return 'confirmed';
  if (score >= threshold) return 'doubtful';
  return 'no_match';
}
