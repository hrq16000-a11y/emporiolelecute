/**
 * Mapa centralizado e explícito de destinos administrativos das seções da Home.
 *
 * Indexado por `component_name` da tabela `home_sections`. Cada seção da Home é
 * renderizada por um componente registrado em `homeSectionsRegistry.ts`; aqui
 * mapeamos esse mesmo `component_name` para o módulo do admin que realmente
 * controla o conteúdo daquela seção.
 *
 * REGRAS:
 *  - Não espalhar strings de rota pelo código. Esta é a ÚNICA fonte de verdade.
 *  - Usar exclusivamente rotas que já existem em `App.tsx`.
 *  - `type` descreve a natureza do controle:
 *      'direct'      → módulo CRUD dedicado controla a seção
 *      'indirect'    → conteúdo derivado de regras/produtos (sem curadoria direta)
 *      'unavailable' → sem destino administrável (ex.: conteúdo hardcoded)
 */

export type DestinationType = "direct" | "indirect" | "unavailable";

export interface SectionDestination {
  /** Rota administrativa de destino. `null` quando não há destino. */
  route: string | null;
  /** Rótulo curto exibido na affordance de navegação. */
  label: string;
  /** Natureza do controle do conteúdo. */
  type: DestinationType;
  /** Texto auxiliar para tooltip (explica o comportamento ao operador). */
  hint?: string;
}

/**
 * Query param canônico usado para sinalizar a origem da navegação,
 * permitindo o retorno contextual "← Seções da Home".
 */
export const HOME_SECTIONS_ORIGIN = "home-sections";

/**
 * Mapa definitivo: `component_name` → destino.
 *
 * Observação sobre componentes compartilhados:
 *  - FeaturedKits é usado por home_kits_montar / home_kits_juntos / home_kits_premium
 *    → todos apontam para /admin/kits (diferenciação real é por kit, no cadastro).
 *  - FeaturedCollections é usado por featured_collections / home_colecoes_completas
 *    → ambos apontam para /admin/colecoes.
 */
export const HOME_SECTION_DESTINATIONS: Record<string, SectionDestination> = {
  HeroSlider: {
    route: "/admin/hero-slides",
    label: "Hero / Banners",
    type: "direct",
    hint: "Gerenciar os slides do banner principal.",
  },
  CategoriesScroll: {
    route: "/admin/categorias",
    label: "Categorias",
    type: "direct",
    hint: "Gerenciar as categorias exibidas no carrossel.",
  },
  OccasionsThumbs: {
    route: "/admin/ocasioes",
    label: "Ocasiões",
    type: "direct",
    hint: "Gerenciar as ocasiões exibidas na Home.",
  },
  BestSellers: {
    route: "/admin/produtos",
    label: "Produtos",
    type: "indirect",
    hint: "Controle indireto: os itens exibidos dependem das regras atuais do bloco (destaque, badges e disponibilidade dos produtos).",
  },
  FeaturedCollections: {
    route: "/admin/colecoes",
    label: "Coleções",
    type: "direct",
    hint: "Gerenciar as coleções em destaque.",
  },
  FeaturedKits: {
    route: "/admin/kits",
    label: "Kits",
    type: "direct",
    hint: "Gerenciar os kits exibidos. O tipo de bloco é definido no cadastro de cada kit.",
  },
  Testimonials: {
    route: "/admin/depoimentos",
    label: "Depoimentos",
    type: "direct",
    hint: "Gerenciar os depoimentos de clientes.",
  },
  FAQSection: {
    route: "/admin/faqs",
    label: "FAQ",
    type: "direct",
    hint: "Gerenciar as perguntas frequentes.",
  },
  InstagramFeed: {
    route: "/admin/feed-instagram",
    label: "Feed do Instagram",
    type: "direct",
    hint: "Gerenciar o feed do Instagram exibido na Home.",
  },
  QuoteCTABanner: {
    route: null,
    label: "Configuração indisponível",
    type: "unavailable",
    hint: "Este bloco não possui módulo de configuração no painel.",
  },
};

/** Destino seguro de fallback quando o componente não está mapeado. */
const FALLBACK_DESTINATION: SectionDestination = {
  route: null,
  label: "Configuração indisponível",
  type: "unavailable",
  hint: "Nenhum módulo de configuração associado a esta seção.",
};

/**
 * Resolve o destino administrativo de uma seção a partir do `component_name`.
 * Nunca lança: retorna um fallback seguro e registra um aviso em desenvolvimento.
 */
export const getSectionDestination = (componentName: string): SectionDestination => {
  const destination = HOME_SECTION_DESTINATIONS[componentName];
  if (!destination) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[home-sections] Nenhum destino mapeado para o componente "${componentName}". ` +
          `Adicione-o em src/lib/homeSectionsDestinations.ts.`
      );
    }
    return FALLBACK_DESTINATION;
  }
  return destination;
};

/**
 * Monta a rota de destino já com o marcador de origem para o retorno contextual.
 * Retorna `null` quando a seção não possui destino navegável.
 */
export const buildSectionDestinationPath = (componentName: string): string | null => {
  const { route } = getSectionDestination(componentName);
  if (!route) return null;
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}from=${HOME_SECTIONS_ORIGIN}`;
};
