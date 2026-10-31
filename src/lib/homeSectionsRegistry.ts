import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Registry de componentes renderizáveis na home, indexado por `component_name`
 * da tabela `home_sections`. Para adicionar uma nova seção:
 *  1) Insira uma linha em `home_sections` no banco
 *  2) Registre o componente aqui
 */
export const HOME_SECTIONS_REGISTRY: Record<
  string,
  LazyExoticComponent<ComponentType<Record<string, unknown>>>
> = {
  HeroSlider: lazy(() => import("@/components/HeroSlider")),
  CategoriesScroll: lazy(() => import("@/components/CategoriesScroll")),
  OccasionsThumbs: lazy(() => import("@/components/OccasionsThumbs")),
  BestSellers: lazy(() => import("@/components/BestSellers")),
  FeaturedCollections: lazy(() => import("@/components/FeaturedCollections")),
  FeaturedKits: lazy(() => import("@/components/FeaturedKits")),
  QuoteCTABanner: lazy(() => import("@/components/QuoteCTABanner")),
  Testimonials: lazy(() => import("@/components/Testimonials")),
  FAQSection: lazy(() => import("@/components/FAQSection")),
  AboutAtelier: lazy(() => import("@/components/AboutAtelier")),
  InstagramFeed: lazy(() => import("@/components/InstagramFeed")),

};

export const isRegisteredSection = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(HOME_SECTIONS_REGISTRY, name);
