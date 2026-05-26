import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import StaleBundleOverlay from "@/components/StaleBundleOverlay";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { CartProvider } from "./contexts/CartContext";
import { usePageTracking } from "./lib/analytics";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { PageSkeleton, AdminSkeleton } from "./components/ui/skeleton-loading";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Buscar = lazy(() => import("./pages/Buscar"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const Carrinho = lazy(() => import("./pages/Carrinho"));
const Envio = lazy(() => import("./pages/Envio"));
const RastrearPedido = lazy(() => import("./pages/RastrearPedido"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Sobre = lazy(() => import("./pages/Sobre"));
const Contato = lazy(() => import("./pages/Contato"));
const Depoimentos = lazy(() => import("./pages/Depoimentos"));
const Ocasioes = lazy(() => import("./pages/Ocasioes"));
const Orcamento = lazy(() => import("./pages/Orcamento"));
const DynamicPage = lazy(() => import("./pages/DynamicPage"));
const Loja = lazy(() => import("./pages/Loja"));
const LembrancinhasLanding = lazy(() => import("./pages/LembrancinhasLanding"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const SitemapCheck = lazy(() => import("./pages/SitemapCheck"));
const TaxonomyPage = lazy(() => import("./pages/TaxonomyPage"));
const CombinationPage = lazy(() => import("./pages/CombinationPage"));
const ThemePage = lazy(() => import("./pages/ThemePage"));

// Admin pages - lazy loaded with retry + telemetry
import { lazyWithRetry } from "./lib/lazyWithRetry";
const AdminLogin = lazyWithRetry(() => import("./pages/admin/AdminLogin"), "AdminLogin");
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout"), "AdminLayout");
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"), "AdminDashboard");
const AdminProducts = lazyWithRetry(() => import("./pages/admin/AdminProducts"), "AdminProducts");
const AdminProductForm = lazyWithRetry(() => import("./pages/admin/AdminProductForm"), "AdminProductForm");
const AdminCategories = lazyWithRetry(() => import("./pages/admin/AdminCategories"), "AdminCategories");
const AdminOccasions = lazyWithRetry(() => import("./pages/admin/AdminOccasions"), "AdminOccasions");
const AdminTags = lazyWithRetry(() => import("./pages/admin/AdminTags"), "AdminTags");
const AdminImport = lazyWithRetry(() => import("./pages/admin/AdminImport"), "AdminImport");
const AdminBackup = lazyWithRetry(() => import("./pages/admin/AdminBackup"), "AdminBackup");
const AdminOrders = lazyWithRetry(() => import("./pages/admin/AdminOrders"), "AdminOrders");
const AdminCustomers = lazyWithRetry(() => import("./pages/admin/AdminCustomers"), "AdminCustomers");
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"), "AdminSettings");
const AdminSEO = lazyWithRetry(() => import("./pages/admin/AdminSEO"), "AdminSEO");
const AdminSEOReport = lazyWithRetry(() => import("./pages/admin/AdminSEOReport"), "AdminSEOReport");
const AdminPages = lazyWithRetry(() => import("./pages/admin/AdminPages"), "AdminPages");
const AdminPageForm = lazyWithRetry(() => import("./pages/admin/AdminPageForm"), "AdminPageForm");
const AdminMenus = lazyWithRetry(() => import("./pages/admin/AdminMenus"), "AdminMenus");
const AdminFaqs = lazyWithRetry(() => import("./pages/admin/AdminFaqs"), "AdminFaqs");
const AdminHomepageBlocks = lazyWithRetry(() => import("./pages/admin/AdminHomepageBlocks"), "AdminHomepageBlocks");
const AdminHomeSections = lazyWithRetry(() => import("./pages/admin/AdminHomeSections"), "AdminHomeSections");
const AdminPdpSections = lazyWithRetry(() => import("./pages/admin/AdminPdpSections"), "AdminPdpSections");
const AdminSearch = lazyWithRetry(() => import("./pages/admin/AdminSearch"), "AdminSearch");
const SearchAnalytics = lazyWithRetry(() => import("./pages/admin/SearchAnalytics"), "SearchAnalytics");
const AdminMerchantFeed = lazyWithRetry(() => import("./pages/admin/AdminMerchantFeed"), "AdminMerchantFeed");
const AdminInstagram = lazyWithRetry(() => import("./pages/admin/AdminInstagram"), "AdminInstagram");
const AdminFeedInstagram = lazyWithRetry(() => import("./pages/admin/AdminFeedInstagram"), "AdminFeedInstagram");
const AdminOccasionLandings = lazyWithRetry(() => import("./pages/admin/AdminOccasionLandings"), "AdminOccasionLandings");
const AdminHeroSlides = lazyWithRetry(() => import("./pages/admin/AdminHeroSlides"), "AdminHeroSlides");
const AdminTestimonials = lazyWithRetry(() => import("./pages/admin/AdminTestimonials"), "AdminTestimonials");
const AdminProductReviews = lazyWithRetry(() => import("./pages/admin/AdminProductReviews"), "AdminProductReviews");

const AdminSitemapStatus = lazyWithRetry(() => import("./pages/admin/AdminSitemapStatus"), "AdminSitemapStatus");
const AdminProductsHealth = lazyWithRetry(() => import("./pages/admin/AdminProductsHealth"), "AdminProductsHealth");
const AdminCoupons = lazyWithRetry(() => import("./pages/admin/AdminCoupons"), "AdminCoupons");
const AdminRedirects = lazyWithRetry(() => import("./pages/admin/AdminRedirects"), "AdminRedirects");
const AdminRobots = lazyWithRetry(() => import("./pages/admin/AdminRobots"), "AdminRobots");
const AdminTracking = lazyWithRetry(() => import("./pages/admin/AdminTracking"), "AdminTracking");
const AdminConversionCTA = lazyWithRetry(() => import("./pages/admin/AdminConversionCTA"), "AdminConversionCTA");
const AdminShipping = lazyWithRetry(() => import("./pages/admin/AdminShipping"), "AdminShipping");
const AdminSEODashboard = lazyWithRetry(() => import("./pages/admin/AdminSEODashboard"), "AdminSEODashboard");
const AdminTelemetry = lazyWithRetry(() => import("./pages/admin/AdminTelemetry"), "AdminTelemetry");
const AdminUsage = lazyWithRetry(() => import("./pages/admin/AdminUsage"), "AdminUsage");
const AdminCronStatus = lazyWithRetry(() => import("./pages/admin/AdminCronStatus"), "AdminCronStatus");
const AdminCloudflareGuide = lazyWithRetry(() => import("./pages/admin/AdminCloudflareGuide"), "AdminCloudflareGuide");
const AdminDiagnostics = lazyWithRetry(() => import("./pages/admin/AdminDiagnostics"), "AdminDiagnostics");
const AdminSeoControlPlane = lazyWithRetry(() => import("./pages/admin/AdminSeoControlPlane"), "AdminSeoControlPlane");
const AdminUsers = lazyWithRetry(() => import("./pages/admin/AdminUsers"), "AdminUsers");
const AdminAccessRequests = lazyWithRetry(() => import("./pages/admin/AdminAccessRequests"), "AdminAccessRequests");
const AdminAccessRequestDetail = lazyWithRetry(() => import("./pages/admin/AdminAccessRequestDetail"), "AdminAccessRequestDetail");
const AdminAudit = lazyWithRetry(() => import("./pages/admin/AdminAudit"), "AdminAudit");
const AdminTaxonomies = lazyWithRetry(() => import("./pages/admin/AdminTaxonomies"), "AdminTaxonomies");
const AdminTaxonomiesHealth = lazyWithRetry(() => import("./pages/admin/AdminTaxonomiesHealth"), "AdminTaxonomiesHealth");
const AdminContentHealth = lazyWithRetry(() => import("./pages/admin/AdminContentHealth"), "AdminContentHealth");
const AdminOpportunities = lazyWithRetry(() => import("./pages/admin/AdminOpportunities"), "AdminOpportunities");
const AdminBlog = lazyWithRetry(() => import("./pages/admin/AdminBlog"), "AdminBlog");
const AdminBlogHealth = lazyWithRetry(() => import("./pages/admin/AdminBlogHealth"), "AdminBlogHealth");
const AdminImageHealth = lazyWithRetry(() => import("./pages/admin/AdminImageHealth"), "AdminImageHealth");
const AdminCombinationPages = lazyWithRetry(() => import("./pages/admin/AdminCombinationPages"), "AdminCombinationPages");
const AdminDiscovery = lazyWithRetry(() => import("./pages/admin/AdminDiscovery"), "AdminDiscovery");
const AdminThemes = lazyWithRetry(() => import("./pages/admin/AdminThemes"), "AdminThemes");
const AdminAuthority = lazyWithRetry(() => import("./pages/admin/AdminAuthority"), "AdminAuthority");
const AdminEditorialExecution = lazyWithRetry(() => import("./pages/admin/AdminEditorialExecution"), "AdminEditorialExecution");
const Colecao = lazyWithRetry(() => import("./pages/Colecao"), "Colecao");
const AdminCollections = lazyWithRetry(() => import("./pages/admin/AdminCollections"), "AdminCollections");
const AdminCollectionForm = lazyWithRetry(() => import("./pages/admin/AdminCollectionForm"), "AdminCollectionForm");
const KitPage = lazyWithRetry(() => import("./pages/KitPage"), "KitPage");
const AdminKits = lazyWithRetry(() => import("./pages/admin/AdminKits"), "AdminKits");
const AdminKitForm = lazyWithRetry(() => import("./pages/admin/AdminKitForm"), "AdminKitForm");
const AdminSeoOperations = lazyWithRetry(() => import("./pages/admin/AdminSeoOperations"), "AdminSeoOperations");
const AdminLinkHealth = lazyWithRetry(() => import("./pages/admin/AdminLinkHealth"), "AdminLinkHealth");
const AdminContentGaps = lazyWithRetry(() => import("./pages/admin/AdminContentGaps"), "AdminContentGaps");
const AdminSeoCommandCenter = lazyWithRetry(() => import("./pages/admin/AdminSeoCommandCenter"), "AdminSeoCommandCenter");
const AdminKnowledgeGraph = lazyWithRetry(() => import("./pages/admin/AdminKnowledgeGraph"), "AdminKnowledgeGraph");
const AdminSeoEvolution = lazyWithRetry(() => import("./pages/admin/AdminSeoEvolution"), "AdminSeoEvolution");
const AdminSeoWarRoom = lazyWithRetry(() => import("./pages/admin/AdminSeoWarRoom"), "AdminSeoWarRoom");
const AdminSeoAutonomy = lazyWithRetry(() => import("./pages/admin/AdminSeoAutonomy"), "AdminSeoAutonomy");
const AdminSeoOS = lazyWithRetry(() => import("./pages/admin/AdminSeoOS"), "AdminSeoOS");
const AdminSeoControlTower = lazyWithRetry(() => import("./pages/admin/AdminSeoControlTower"), "AdminSeoControlTower");
const AdminSeoSimulationLab = lazyWithRetry(() => import("./pages/admin/AdminSeoSimulationLab"), "AdminSeoSimulationLab");
const AdminStrategicSimulation = lazyWithRetry(() => import("./pages/admin/AdminStrategicSimulation"), "AdminStrategicSimulation");
const AdminSeoSingularity = lazyWithRetry(() => import("./pages/admin/AdminSeoSingularity"), "AdminSeoSingularity");
const AdminSeoConsciousness = lazyWithRetry(() => import("./pages/admin/AdminSeoConsciousness"), "AdminSeoConsciousness");
const AdminSeoExecutiveGrid = lazyWithRetry(() => import("./pages/admin/AdminSeoExecutiveGrid"), "AdminSeoExecutiveGrid");
const AdminSeoNervousSystem = lazyWithRetry(() => import("./pages/admin/AdminSeoNervousSystem"), "AdminSeoNervousSystem");
const AdminSeoMetaGovernance = lazyWithRetry(() => import("./pages/admin/AdminSeoMetaGovernance"), "AdminSeoMetaGovernance");
const AdminSeoCivilization = lazyWithRetry(() => import("./pages/admin/AdminSeoCivilization"), "AdminSeoCivilization");
const AdminSeoKernel = lazyWithRetry(() => import("./pages/admin/AdminSeoKernel"), "AdminSeoKernel");
const AdminSeoUnifiedIntelligence = lazyWithRetry(() => import("./pages/admin/AdminSeoUnifiedIntelligence"), "AdminSeoUnifiedIntelligence");
const AdminSeoOperatingFabric = lazyWithRetry(() => import("./pages/admin/AdminSeoOperatingFabric"), "AdminSeoOperatingFabric");
const AdminSeoCognitiveOrchestration = lazyWithRetry(() => import("./pages/admin/AdminSeoCognitiveOrchestration"), "AdminSeoCognitiveOrchestration");
const AdminSeoMetaReasoning = lazyWithRetry(() => import("./pages/admin/AdminSeoMetaReasoning"), "AdminSeoMetaReasoning");
const AdminSeoExecutiveCore = lazyWithRetry(() => import("./pages/admin/AdminSeoExecutiveCore"), "AdminSeoExecutiveCore");
const AdminSeoGovernanceMatrix = lazyWithRetry(() => import("./pages/admin/AdminSeoGovernanceMatrix"), "AdminSeoGovernanceMatrix");
const AdminSeoConsciousnessFabric = lazyWithRetry(() => import("./pages/admin/AdminSeoConsciousnessFabric"), "AdminSeoConsciousnessFabric");
const AdminSeoStrategicReality = lazyWithRetry(() => import("./pages/admin/AdminSeoStrategicReality"), "AdminSeoStrategicReality");
const AdminSeoStrategicContinuum = lazyWithRetry(() => import("./pages/admin/AdminSeoStrategicContinuum"), "AdminSeoStrategicContinuum");
const AdminSeoUnifiedNexus = lazyWithRetry(() => import("./pages/admin/AdminSeoUnifiedNexus"), "AdminSeoUnifiedNexus");
const AdminSeoNexusConvergence = lazyWithRetry(() => import("./pages/admin/AdminSeoNexusConvergence"), "AdminSeoNexusConvergence");
const AdminSeoStabilityFabric = lazyWithRetry(() => import("./pages/admin/AdminSeoStabilityFabric"), "AdminSeoStabilityFabric");
const AdminSeoIntegrityGrid = lazyWithRetry(() => import("./pages/admin/AdminSeoIntegrityGrid"), "AdminSeoIntegrityGrid");
const AdminSeoCoherenceMatrix = lazyWithRetry(() => import("./pages/admin/AdminSeoCoherenceMatrix"), "AdminSeoCoherenceMatrix");
const AdminSeoConsolidation = lazyWithRetry(() => import("./pages/admin/AdminSeoConsolidation"), "AdminSeoConsolidation");
const AdminSeoExecutionOrchestrator = lazyWithRetry(() => import("./pages/admin/AdminSeoExecutionOrchestrator"), "AdminSeoExecutionOrchestrator");
const AdminSeoExecutiveHome = lazyWithRetry(() => import("./pages/admin/AdminSeoExecutiveHome"), "AdminSeoExecutiveHome");
const AdminSeoOperationalReality = lazyWithRetry(() => import("./pages/admin/AdminSeoOperationalReality"), "AdminSeoOperationalReality");
const AdminSeoFinalGovernance = lazyWithRetry(() => import("./pages/admin/AdminSeoFinalGovernance"), "AdminSeoFinalGovernance");
const AdminSeoSystemAudit = lazyWithRetry(() => import("./pages/admin/AdminSeoSystemAudit"), "AdminSeoSystemAudit");
const AdminExecutiveMode = lazyWithRetry(() => import("./pages/admin/AdminExecutiveMode"), "AdminExecutiveMode");
const AdminSeoOperationalConsolidation = lazyWithRetry(() => import("./pages/admin/AdminSeoOperationalConsolidation"), "AdminSeoOperationalConsolidation");
const AcessoRestrito = lazy(() => import("./pages/AcessoRestrito"));
const PoliticaPrivacidade = lazyWithRetry(() => import("./pages/PoliticaPrivacidade"), "PoliticaPrivacidade");
const AdminCookieConsent = lazyWithRetry(() => import("./pages/admin/AdminCookieConsent"), "AdminCookieConsent");

import RequireAdmin from "./components/RequireAdmin";
import AdminErrorBoundary from "./components/AdminErrorBoundary";
import RedirectHandler from "./components/RedirectHandler";
import TrackingScripts from "./components/TrackingScripts";
import CanonicalNormalizer from "./components/CanonicalNormalizer";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { useVisitorTracking } from "./hooks/useVisitorTracking";

const VisitorTracker = () => { useVisitorTracking(); return null; };
import { logSlugEvent } from "./lib/slugObservability";
import { urls, PRODUCT_PATH_PREFIX, LEGACY_PRODUCT_PATH_PREFIX } from "./lib/urls";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5min — evita refetch em pico de tráfego
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Analytics wrapper component
const AnalyticsWrapper = ({ children }: { children: React.ReactNode }) => {
  usePageTracking();
  return <>{children}</>;
};

// Scroll-to-top em toda navegação SPA. Ignora quando há hash (#ancora) para
// permitir scroll para âncoras específicas. Usa "auto" para evitar flash.
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);
  return null;
};

// Mount the reduced-motion controller once. Toggles the `motion-reduced` class
// on <html> based on user preference (localStorage) or system setting.
const ReducedMotionMount = () => {
  useReducedMotion();
  return null;
};



/**
 * Fase 2.2 — Redirect canônico 1-hop: /produtos/:slug (legado) → /produto/:slug.
 * Preserva query string, hash e aliases (a resolução de alias acontece em
 * ProductPage via product_slugs resolver). Usa `replace` para não poluir o
 * histórico — equivalente client-side de 301 (Lovable hosting é static-first,
 * não há camada server-side para emitir 301 real). Emite `legacy_namespace_hit`.
 */
const LegacyProductRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  useEffect(() => {
    logSlugEvent({
      event: "legacy_namespace_hit",
      legacyPrefix: LEGACY_PRODUCT_PATH_PREFIX,
      targetPrefix: PRODUCT_PATH_PREFIX,
      matchedSlug: slug,
      pathname: location.pathname,
    });
  }, [slug, location.pathname]);
  if (!slug) return <Navigate to="/produtos" replace />;
  return (
    <Navigate
      to={`${urls.product(slug)}${location.search}${location.hash}`}
      replace
    />
  );
};

const App = () => {
  // Analytics carregadas dinamicamente em <TrackingScripts /> via tracking_config.
  useEffect(() => {}, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <ReducedMotionMount />
          <Toaster />
          <Sonner />
          <StaleBundleOverlay />
          <PwaInstallPrompt />
          <BrowserRouter>
            <AnalyticsWrapper>
              <ScrollToTop />
              <RedirectHandler />
              <CanonicalNormalizer />
              <TrackingScripts />
              <VisitorTracker />
              <CookieConsentBanner />
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Index />
                  </Suspense>
                } />
                <Route path="/sobre" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Sobre />
                  </Suspense>
                } />
                <Route path="/contato" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Contato />
                  </Suspense>
                } />
                <Route path="/politica-de-privacidade" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <PoliticaPrivacidade />
                  </Suspense>
                } />
                <Route path="/depoimentos" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Depoimentos />
                  </Suspense>
                } />
                <Route path="/ocasioes" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Ocasioes />
                  </Suspense>
                } />
                <Route path="/orcamento" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Orcamento />
                  </Suspense>
                } />
                <Route path="/produtos" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Produtos />
                  </Suspense>
                } />
                <Route path="/buscar" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Buscar />
                  </Suspense>
                } />
                {/* Fase 2.2 (FLIPPED) — /produto/:slug é canônico. */}
                <Route path="/produto/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ProductPage />
                  </Suspense>
                } />
                {/* Legado coexistente: /produtos/:slug → replace para canônico. */}
                <Route path="/produtos/:slug" element={<LegacyProductRedirect />} />
                <Route path="/produto" element={<Navigate to="/produtos" replace />} />
                <Route path="/carrinho" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Carrinho />
                  </Suspense>
                } />
                <Route path="/envio" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Envio />
                  </Suspense>
                } />
                <Route path="/envio-brasil" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Envio />
                  </Suspense>
                } />
                <Route path="/rastrear" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <RastrearPedido />
                  </Suspense>
                } />
                <Route path="/rastrear/:code" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <RastrearPedido />
                  </Suspense>
                } />
                
                {/* SEO Landing Pages — Horizonte 2 */}
                {[
                  "cha-de-bebe",
                  "maternidade",
                  "cha-revelacao",
                  "batizado",
                  "aniversario-infantil",
                  "formatura",
                ].map((slug) => (
                  <Route
                    key={slug}
                    path={`/lembrancinhas-${slug}`}
                    element={
                      <Suspense fallback={<PageSkeleton />}>
                        <LembrancinhasLanding configKey={slug} />
                      </Suspense>
                    }
                  />
                ))}

                {/* Blog — Horizonte 2 Fase 2 */}
                <Route path="/blog" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Blog />
                  </Suspense>
                } />
                <Route path="/blog/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <BlogPost />
                  </Suspense>
                } />

                <Route path="/sitemap-check" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <SitemapCheck />
                  </Suspense>
                } />

                {/* Public Taxonomy Pages — Fase 3.1 */}
                <Route path="/categoria/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <TaxonomyPage kind="categoria" />
                  </Suspense>
                } />
                <Route path="/ocasiao/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <TaxonomyPage kind="ocasiao" />
                  </Suspense>
                } />
                <Route path="/segmento/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <TaxonomyPage kind="segmento" />
                  </Suspense>
                } />
                <Route path="/colecao/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Colecao />
                  </Suspense>
                } />
                <Route path="/kit/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <KitPage />
                  </Suspense>
                } />
                <Route path="/segmento/:segmentSlug/ocasiao/:occasionSlug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <CombinationPage />
                  </Suspense>
                } />

                {/* Fase 10.3 — Hub temático SAFE MODE */}
                <Route path="/tema/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ThemePage />
                  </Suspense>
                } />

                {/* Admin Routes */}
                <Route path="/admin/login" element={
                  <Suspense fallback={<AdminSkeleton />}>
                    <AdminLogin />
                  </Suspense>
                } />
                <Route path="/acesso-restrito" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <AcessoRestrito />
                  </Suspense>
                } />
                <Route path="/admin" element={
                  <AdminErrorBoundary>
                    <RequireAdmin>
                      <Suspense fallback={<AdminSkeleton />}>
                        <AdminLayout />
                      </Suspense>
                    </RequireAdmin>
                  </AdminErrorBoundary>
                }>
                  <Route index element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminDashboard />
                    </Suspense>
                  } />
                  <Route path="pedidos" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminOrders />
                    </Suspense>
                  } />
                  <Route path="clientes" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCustomers />
                    </Suspense>
                  } />
                  <Route path="lgpd/banner" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCookieConsent />
                    </Suspense>
                  } />
                  <Route path="produtos" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminProducts />
                    </Suspense>
                  } />
                  <Route path="produtos/novo" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminProductForm />
                    </Suspense>
                  } />
                  <Route path="produtos/:id" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminProductForm />
                    </Suspense>
                  } />
                  <Route path="categorias" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCategories />
                    </Suspense>
                  } />
                  <Route path="ocasioes" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminOccasions />
                    </Suspense>
                  } />
                  <Route path="tags" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminTags />
                    </Suspense>
                  } />
                  <Route path="importar" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminImport />
                    </Suspense>
                  } />
                  <Route path="backup" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminBackup />
                    </Suspense>
                  } />
                  <Route path="paginas" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminPages />
                    </Suspense>
                  } />
                  <Route path="paginas/nova" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminPageForm />
                    </Suspense>
                  } />
                  <Route path="paginas/:id" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminPageForm />
                    </Suspense>
                  } />
                  <Route path="menus" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminMenus />
                    </Suspense>
                  } />
                  <Route path="faqs" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminFaqs />
                    </Suspense>
                  } />
                  <Route path="blocos" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminHomepageBlocks />
                    </Suspense>
                  } />
                  <Route path="secoes-home" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminHomeSections />
                    </Suspense>
                  } />
                  <Route path="pdp-sections" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminPdpSections />
                    </Suspense>
                  } />
                  <Route path="busca" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSearch />
                    </Suspense>
                  } />
                  <Route path="busca/analytics" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <SearchAnalytics />
                    </Suspense>
                  } />
                  <Route path="configuracoes" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSettings />
                    </Suspense>
                  } />
                  <Route path="seo" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSEO />
                    </Suspense>
                  } />
                  <Route path="seo/relatorio" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSEOReport />
                    </Suspense>
                  } />
                  <Route path="seo-dashboard" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSEODashboard />
                    </Suspense>
                  } />
                  <Route path="cloudflare-worker" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCloudflareGuide />
                    </Suspense>
                  } />
                  <Route path="merchant-feed" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminMerchantFeed />
                    </Suspense>
                  } />
                  <Route path="instagram" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminInstagram />
                    </Suspense>
                  } />
                  <Route path="feed-instagram" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminFeedInstagram />
                    </Suspense>
                  } />
                  <Route path="diagnostico" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminDiagnostics />
                    </Suspense>
                  } />
                  <Route path="telemetria" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminTelemetry />
                    </Suspense>
                  } />
                  <Route path="uso" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminUsage />
                    </Suspense>
                  } />
                  <Route path="cron" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCronStatus />
                    </Suspense>
                  } />
                  <Route path="seo-control-plane" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoControlPlane />
                    </Suspense>
                  } />
                  <Route path="landings" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminOccasionLandings />
                    </Suspense>
                  } />
                  <Route path="hero-slides" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminHeroSlides />
                    </Suspense>
                  } />
                  <Route path="depoimentos" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminTestimonials />
                    </Suspense>
                  } />
                  <Route path="cupons" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCoupons />
                    </Suspense>
                  } />
                  <Route path="redirects" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminRedirects />
                    </Suspense>
                  } />
                  <Route path="robots" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminRobots />
                    </Suspense>
                  } />
                  <Route path="tracking" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminTracking />
                    </Suspense>
                  } />
                  <Route path="conversao" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminConversionCTA />
                    </Suspense>
                  } />
                  <Route path="colecoes" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCollections />
                    </Suspense>
                  } />
                  <Route path="colecoes/nova" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCollectionForm />
                    </Suspense>
                  } />
                  <Route path="colecoes/:id" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCollectionForm />
                    </Suspense>
                  } />
                  <Route path="kits" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminKits />
                    </Suspense>
                  } />
                  <Route path="kits/novo" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminKitForm />
                    </Suspense>
                  } />
                  <Route path="kits/:id" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminKitForm />
                    </Suspense>
                  } />
                  <Route path="usuarios" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminUsers />
                    </Suspense>
                  } />
                  <Route path="usuarios/solicitacoes" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminAccessRequests />
                    </Suspense>
                  } />
                  <Route path="usuarios/solicitacoes/:id" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminAccessRequestDetail />
                    </Suspense>
                  } />
                  <Route path="taxonomias" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminTaxonomies />
                    </Suspense>
                  } />
                  <Route path="taxonomias/health" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminTaxonomiesHealth />
                    </Suspense>
                  } />
                  <Route path="produtos/health" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminProductsHealth />
                    </Suspense>
                  } />
                  <Route path="content-health" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminContentHealth />
                    </Suspense>
                  } />
                  <Route path="opportunities" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminOpportunities />
                    </Suspense>
                  } />
                  <Route path="reviews" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminProductReviews />
                    </Suspense>
                  } />
                  <Route path="sitemap-status" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSitemapStatus />
                    </Suspense>
                  } />
                  <Route path="auditoria" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminAudit />
                    </Suspense>
                  } />
                  <Route path="blog" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminBlog />
                    </Suspense>
                  } />
                  <Route path="blog/health" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminBlogHealth />
                    </Suspense>
                  } />
                  <Route path="image-health" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminImageHealth />
                    </Suspense>
                  } />
                  <Route path="combination-pages" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminCombinationPages />
                    </Suspense>
                  } />
                  <Route path="discovery" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminDiscovery />
                    </Suspense>
                  } />
                  <Route path="themes" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminThemes />
                    </Suspense>
                  } />
                  <Route path="authority" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminAuthority />
                    </Suspense>
                  } />
                  <Route path="editorial-execution" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminEditorialExecution />
                    </Suspense>
                  } />
                  <Route path="seo-operations" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoOperations />
                    </Suspense>
                  } />
                  <Route path="link-health" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminLinkHealth />
                    </Suspense>
                  } />
                  <Route path="content-gaps" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminContentGaps />
                    </Suspense>
                  } />
                  <Route path="seo-command" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoCommandCenter />
                    </Suspense>
                  } />
                  <Route path="knowledge-graph" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminKnowledgeGraph />
                    </Suspense>
                  } />
                  <Route path="seo-evolution" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoEvolution />
                    </Suspense>
                  } />
                  <Route path="seo-war-room" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoWarRoom />
                    </Suspense>
                  } />
                  <Route path="seo-autonomy" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoAutonomy />
                    </Suspense>
                  } />
                  <Route path="seo-os" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoOS />
                    </Suspense>
                  } />
                  <Route path="seo-control-tower" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoControlTower />
                    </Suspense>
                  } />
                  <Route path="seo-simulation-lab" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoSimulationLab />
                    </Suspense>
                  } />
                  <Route path="seo-strategic-simulation" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminStrategicSimulation />
                    </Suspense>
                  } />
                  <Route path="seo-singularity" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoSingularity />
                    </Suspense>
                  } />
                  <Route path="seo-consciousness" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoConsciousness />
                    </Suspense>
                  } />
                  <Route path="seo-executive-grid" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoExecutiveGrid />
                    </Suspense>
                  } />
                  <Route path="seo-nervous-system" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoNervousSystem />
                    </Suspense>
                  } />
                  <Route path="seo-meta-governance" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoMetaGovernance />
                    </Suspense>
                  } />
                  <Route path="seo-civilization" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoCivilization />
                    </Suspense>
                  } />
                  <Route path="seo-kernel" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoKernel />
                    </Suspense>
                  } />
                  <Route path="seo-unified-intelligence" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoUnifiedIntelligence />
                    </Suspense>
                  } />
                  <Route path="seo-operating-fabric" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoOperatingFabric />
                    </Suspense>
                  } />
                  <Route path="seo-cognitive-orchestration" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoCognitiveOrchestration />
                    </Suspense>
                  } />
                  <Route path="seo-meta-reasoning" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoMetaReasoning />
                    </Suspense>
                  } />
                  <Route path="seo-executive-core" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoExecutiveCore />
                    </Suspense>
                  } />
                  <Route path="seo-governance-matrix" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoGovernanceMatrix />
                    </Suspense>
                  } />
                  <Route path="seo-consciousness-fabric" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoConsciousnessFabric />
                    </Suspense>
                  } />
                  <Route path="seo-strategic-reality" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoStrategicReality />
                    </Suspense>
                  } />
                  <Route path="seo-strategic-continuum" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoStrategicContinuum />
                    </Suspense>
                  } />
                  <Route path="seo-unified-nexus" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoUnifiedNexus />
                    </Suspense>
                  } />
                  <Route path="seo-nexus-convergence" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoNexusConvergence />
                    </Suspense>
                  } />
                  <Route path="seo-stability-fabric" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoStabilityFabric />
                    </Suspense>
                  } />
                  <Route path="seo-integrity-grid" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoIntegrityGrid />
                    </Suspense>
                  } />
                  <Route path="seo-coherence-matrix" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoCoherenceMatrix />
                    </Suspense>
                  } />
                  <Route path="seo-consolidation" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoConsolidation />
                    </Suspense>
                  } />
                  <Route path="seo-execution-orchestrator" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoExecutionOrchestrator />
                    </Suspense>
                  } />
                  <Route path="seo-executive-home" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoExecutiveHome />
                    </Suspense>
                  } />
                  <Route path="seo-operational-reality" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoOperationalReality />
                    </Suspense>
                  } />
                  <Route path="seo-final-governance" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoFinalGovernance />
                    </Suspense>
                  } />
                  <Route path="seo-system-audit" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoSystemAudit />
                    </Suspense>
                  } />
                  <Route path="executive-mode" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminExecutiveMode />
                    </Suspense>
                  } />
                  <Route path="seo-operational-consolidation" element={
                    <Suspense fallback={<AdminSkeleton />}>
                      <AdminSeoOperationalConsolidation />
                    </Suspense>
                  } />
                </Route>
                
                {/* Landing Page for Google Ads */}
                <Route path="/loja" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Loja />
                  </Suspense>
                } />
                
                {/* Dynamic Pages - must be after other routes */}
                <Route path="/:slug" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <DynamicPage />
                  </Suspense>
                } />
                
                {/* Catch-all route */}
                <Route path="*" element={
                  <Suspense fallback={<PageSkeleton />}>
                    <NotFound />
                  </Suspense>
                } />
              </Routes>
            </AnalyticsWrapper>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
};

export default App;
