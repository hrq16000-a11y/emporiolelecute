// Helpers compartilhados de taxonomia (Fase 3.2 → expandido Fase 6)
export type TaxonomyKind = 'categoria' | 'ocasiao' | 'segmento' | 'tag';

export const TAXONOMY_LABELS: Record<TaxonomyKind, { singular: string; plural: string; urlPrefix: string }> = {
  categoria: { singular: 'Categoria', plural: 'Categorias', urlPrefix: '/categoria/' },
  ocasiao:   { singular: 'Ocasião',  plural: 'Ocasiões',   urlPrefix: '/ocasiao/'   },
  segmento:  { singular: 'Segmento', plural: 'Segmentos',  urlPrefix: '/segmento/'  },
  tag:       { singular: 'Tag',      plural: 'Tags',       urlPrefix: '/tag/'       },
};

export function slugify(name: string) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface TaxonomyFaq { question: string; answer: string; [key: string]: string }

export interface TaxonomyEntity {
  id: string;
  name: string;
  slug: string;
  position?: number;
  description?: string | null;
  image_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  h1_override?: string | null;
  description_seo?: string | null;
  is_indexed?: boolean;
  // Bloco 3 SAFE: rascunho. true = invisível ao público (sitemap/SEO/listagens).
  is_draft?: boolean;
  faqs?: TaxonomyFaq[] | null;
}

// ============================================================
// Fase 6 — Fallbacks automáticos de SEO (runtime, não persistem)
// ============================================================

const SITE_NAME = 'Empório LeleCute';

export function metaTitleFallback(kind: TaxonomyKind, name: string): string {
  if (!name) return SITE_NAME;
  switch (kind) {
    case 'categoria': return `${name} Artesanais Personalizados | ${SITE_NAME}`;
    case 'ocasiao':   return `Lembrancinhas para ${name} | ${SITE_NAME}`;
    case 'segmento':  return `${name} Personalizados | ${SITE_NAME}`;
    case 'tag':       return `${name} | ${SITE_NAME}`;
  }
}

export function metaDescriptionFallback(kind: TaxonomyKind, name: string): string {
  switch (kind) {
    case 'categoria': return `Descubra ${name.toLowerCase()} artesanais personalizados, feitos à mão com carinho. Lembrancinhas únicas para todo Brasil.`;
    case 'ocasiao':   return `Lembrancinhas artesanais para ${name.toLowerCase()}: sabonetes, sachês e velas personalizados com entrega em todo o Brasil.`;
    case 'segmento':  return `Produtos artesanais personalizados para ${name.toLowerCase()}. Feitos sob encomenda com atenção aos detalhes.`;
    case 'tag':       return `Veja produtos relacionados a ${name.toLowerCase()} no ${SITE_NAME}.`;
  }
}

// ============================================================
// Avaliação SEO (Fase 6 — checks expandidos + score 0–100)
// ============================================================

export interface SeoIssues {
  noMetaTitle: boolean;
  shortMetaTitle: boolean;
  longMetaTitle: boolean;
  noMetaDescription: boolean;
  shortMetaDescription: boolean;
  longMetaDescription: boolean;
  noImage: boolean;
  noDescription: boolean;
  notIndexed: boolean;
  noDescriptionSeo: boolean;
  shortDescriptionSeo: boolean;
  noFaq: boolean;
  genericSlug: boolean;
}

export type SeoGrade = 'Excelente' | 'Bom' | 'Regular' | 'Fraco' | 'Crítico';

const GENERIC_SLUGS = new Set([
  'produtos', 'produto', 'categoria', 'categorias', 'tag', 'tags',
  'pagina', 'item', 'novo', 'teste', 'home', 'default',
]);

export function normalizeFaqs(raw: unknown): TaxonomyFaq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = r as { question?: unknown; answer?: unknown };
      const q = typeof o?.question === 'string' ? o.question.trim() : '';
      const a = typeof o?.answer === 'string' ? o.answer.trim() : '';
      return q && a ? { question: q, answer: a } : null;
    })
    .filter((x): x is TaxonomyFaq => !!x);
}

export function evaluateSeo(e: TaxonomyEntity): SeoIssues {
  const mt = (e.meta_title || '').trim();
  const md = (e.meta_description || '').trim();
  const ds = (e.description_seo || '').trim();
  const faqs = normalizeFaqs(e.faqs);
  const slug = (e.slug || '').trim().toLowerCase();
  return {
    noMetaTitle: mt.length === 0,
    shortMetaTitle: mt.length > 0 && mt.length < 20,
    longMetaTitle: mt.length > 60,
    noMetaDescription: md.length === 0,
    shortMetaDescription: md.length > 0 && md.length < 80,
    longMetaDescription: md.length > 160,
    noImage: !e.image_url,
    noDescription: !(e.description && e.description.trim().length > 0),
    notIndexed: e.is_indexed === false,
    noDescriptionSeo: ds.length === 0,
    shortDescriptionSeo: ds.length > 0 && ds.length < 200,
    noFaq: faqs.length === 0,
    genericSlug: GENERIC_SLUGS.has(slug),
  };
}

export function hasAnyIssue(s: SeoIssues) {
  return Object.values(s).some(Boolean);
}

// Pesos: críticos custam mais pontos; avisos custam pouco.
const SEO_WEIGHTS: Record<keyof SeoIssues, number> = {
  noMetaTitle: 15,
  shortMetaTitle: 5,
  longMetaTitle: 5,
  noMetaDescription: 15,
  shortMetaDescription: 5,
  longMetaDescription: 5,
  noImage: 8,
  noDescription: 8,
  notIndexed: 10,
  noDescriptionSeo: 12,
  shortDescriptionSeo: 4,
  noFaq: 8,
  genericSlug: 10,
};

export interface SeoScoreResult {
  score: number;            // 0–100
  grade: SeoGrade;
  issues: SeoIssues;
  productCount?: number;
}

export function scoreSeo(e: TaxonomyEntity, opts?: { productCount?: number }): SeoScoreResult {
  const issues = evaluateSeo(e);
  let penalty = 0;
  (Object.keys(issues) as (keyof SeoIssues)[]).forEach((k) => {
    if (issues[k]) penalty += SEO_WEIGHTS[k];
  });
  // penalidade extra: taxonomia órfã ou com poucos produtos
  const pc = opts?.productCount;
  if (typeof pc === 'number') {
    if (pc === 0) penalty += 15;
    else if (pc < 3) penalty += 6;
  }
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade: SeoGrade =
    score >= 90 ? 'Excelente' :
    score >= 75 ? 'Bom' :
    score >= 55 ? 'Regular' :
    score >= 35 ? 'Fraco' : 'Crítico';
  return { score, grade, issues, productCount: pc };
}

// ============================================================
// Breadcrumbs centralizado (Fase 6)
// ============================================================

export interface Crumb { name: string; url: string }

const SITE_ORIGIN = 'https://emporiolelecute.com.br';

export interface BuildBreadcrumbsInput {
  kind: TaxonomyKind | 'produto' | 'produtos' | 'home';
  productName?: string;
  productPath?: string;
  // Prioridade segment > occasion > category
  segment?: { name: string; slug: string } | null;
  occasion?: { name: string; slug: string } | null;
  category?: { name: string; slug: string } | null;
  taxonomyName?: string;
  taxonomySlug?: string;
}

export function buildBreadcrumbs(input: BuildBreadcrumbsInput): Crumb[] {
  const crumbs: Crumb[] = [{ name: 'Início', url: `${SITE_ORIGIN}/` }];

  if (input.kind === 'produto') {
    // priorize segmento → ocasião → categoria como contexto
    const parent =
      input.segment ? { name: input.segment.name, url: `${SITE_ORIGIN}/segmento/${input.segment.slug}` } :
      input.occasion ? { name: input.occasion.name, url: `${SITE_ORIGIN}/ocasiao/${input.occasion.slug}` } :
      input.category ? { name: input.category.name, url: `${SITE_ORIGIN}/categoria/${input.category.slug}` } :
      { name: 'Produtos', url: `${SITE_ORIGIN}/produtos` };
    crumbs.push(parent);
    if (input.productName) {
      crumbs.push({ name: input.productName, url: `${SITE_ORIGIN}${input.productPath || ''}` });
    }
    return crumbs;
  }

  if (input.kind === 'categoria' || input.kind === 'ocasiao' || input.kind === 'segmento' || input.kind === 'tag') {
    const hubLabel = input.kind === 'ocasiao' ? 'Ocasiões' : 'Produtos';
    const hubPath = input.kind === 'ocasiao' ? '/ocasioes' : '/produtos';
    crumbs.push({ name: hubLabel, url: `${SITE_ORIGIN}${hubPath}` });
    if (input.taxonomyName && input.taxonomySlug) {
      const prefix = TAXONOMY_LABELS[input.kind].urlPrefix;
      crumbs.push({ name: input.taxonomyName, url: `${SITE_ORIGIN}${prefix}${input.taxonomySlug}` });
    }
    return crumbs;
  }

  if (input.kind === 'produtos') {
    crumbs.push({ name: 'Produtos', url: `${SITE_ORIGIN}/produtos` });
  }
  return crumbs;
}
