// Sprint final — score editorial determinístico para a home.
//
// Combina sinais já existentes no banco (featured_weight, presença em kits,
// presença em coleções, prioridade manual via badge) num score numérico
// estável. Usado para ordenar listas de destaque e priorizar produtos com
// maior valor curatorial. Pure function — sem efeitos.

export interface HomePriorityInput {
  /** featured_weight (0-100). Sinal principal de prioridade manual. */
  featured_weight?: number | null;
  /** Produto presente em pelo menos um kit ativo. */
  in_kit?: boolean;
  /** Produto presente em pelo menos uma coleção ativa em destaque. */
  in_collection?: boolean;
  /** Badge manual ("Mais vendido", "Novo"...) atribuído pelo admin. */
  badge?: string | null;
  /** Posição manual (menor = mais prioritário). */
  position?: number | null;
}

export function homePriorityScore(input: HomePriorityInput): number {
  const fw = Math.max(0, Math.min(100, Number(input.featured_weight ?? 0)));
  const kit = input.in_kit ? 15 : 0;
  const collection = input.in_collection ? 10 : 0;
  const manual = input.badge && input.badge.trim().length > 0 ? 5 : 0;
  // Position desempata; penalidade leve, evita overpower.
  const posPenalty = Math.min(10, Math.max(0, Number(input.position ?? 0))) * 0.2;
  return fw + kit + collection + manual - posPenalty;
}

/** Ordenação descendente e estável (preserva ordem original em empate). */
export function sortByHomePriority<T extends HomePriorityInput>(items: T[]): T[] {
  return items
    .map((item, idx) => ({ item, idx, score: homePriorityScore(item) }))
    .sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
    .map((x) => x.item);
}

/** Gera um seed numérico determinístico a partir de uma string (ex: YYYYMMDD). */
function cyrb128(str: string): number {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

/** PRNG simples e determinístico (Mulberry32). */
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle determinístico (Fisher-Yates) usando seed string. */
export function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const rng = mulberry32(cyrb128(seedStr));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Retorna a data local do Brasil no formato YYYYMMDD. */
export function getBrazilDateKey(): string {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('');
}
