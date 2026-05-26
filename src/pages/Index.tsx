import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import Chatbot from "@/components/Chatbot";
import DynamicSEO from "@/components/DynamicSEO";
import OrganizationStructuredData from "@/components/OrganizationStructuredData";
import WebSiteStructuredData from "@/components/WebSiteStructuredData";
import LocalBusinessStructuredData from "@/components/LocalBusinessStructuredData";
import { useHomeSectionsPublic } from "@/hooks/useHomeSections";
import { HOME_SECTIONS_REGISTRY } from "@/lib/homeSectionsRegistry";
import { HomeRegistryProvider } from "@/contexts/HomeRegistry";

/**
 * Altura realista de cada seção, usada no skeleton para reservar espaço
 * antes do componente lazy montar (evita CLS empurrando o footer).
 */
const SECTION_HEIGHTS: Record<string, string> = {
  HeroSlider: "min-h-[460px] md:min-h-[600px]",
  CategoriesScroll: "min-h-[220px] md:min-h-[260px]",
  OccasionsThumbs: "min-h-[260px] md:min-h-[320px]",
  BestSellers: "min-h-[640px] md:min-h-[720px]",
  FeaturedCollections: "min-h-[420px] md:min-h-[520px]",
  FeaturedKits: "min-h-[520px] md:min-h-[600px]",
  QuoteCTABanner: "min-h-[220px] md:min-h-[260px]",
  Testimonials: "min-h-[360px] md:min-h-[420px]",
  FAQSection: "min-h-[480px] md:min-h-[560px]",
  InstagramFeed: "min-h-[320px] md:min-h-[400px]",
};

const SectionFallback = ({ name }: { name?: string }) => (
  <div
    className={`w-full animate-pulse bg-muted/30 ${
      (name && SECTION_HEIGHTS[name]) || "min-h-[280px] md:min-h-[360px]"
    }`}
    aria-hidden
  />
);

const Index = () => {
  const { data: sections, isLoading } = useHomeSectionsPublic();

  return (
    // Layout vertical rígido: header + main flex-1 + footer fixo no fim.
    <div className="min-h-screen bg-background flex flex-col">
      <DynamicSEO />
      <OrganizationStructuredData />
      <WebSiteStructuredData />
      <LocalBusinessStructuredData />
      <Header />
      {/* flex-1 garante que o footer fique sempre no fim, sem subir antes do conteúdo carregar */}
      <main className="flex-1 min-h-[100vh]">
        <HomeRegistryProvider>
          {isLoading || !sections
            ? // Reserva visual enquanto sections carregam — evita o pop do footer.
              <div className="min-h-[100vh] animate-pulse bg-muted/20" aria-hidden />
            : sections.map((section) => {
                const Component = HOME_SECTIONS_REGISTRY[section.component_name];
                if (!Component) {
                  if (import.meta.env.DEV) {
                    console.warn(
                      `[home] Componente "${section.component_name}" não está registrado em homeSectionsRegistry.`
                    );
                  }
                  return null;
                }
                return (
                  <Suspense
                    key={section.id}
                    fallback={<SectionFallback name={section.component_name} />}
                  >
                    <Component {...(section.editable_props || {})} />
                  </Suspense>
                );
              })}
        </HomeRegistryProvider>
      </main>
      <Footer />
      <WhatsAppButton />
      <Chatbot />
    </div>
  );
};

export default Index;
