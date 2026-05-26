import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  Send,
  Truck,
  Shield,
  Clock,
  Heart,
  Package,
  CheckCircle2,
  Loader2,
  Share2,
  ChevronRight,
  Minus,
  Plus,
  MessageCircle,
  ShoppingCart,
  Tag,
  Layers,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
// WhatsAppButton intencionalmente não importado na PDP — ver linha do bloco final.
import ProductCard from "@/components/ProductCard";
import RelatedProducts from "@/components/RelatedProducts";
import RelatedSmart from "@/components/RelatedSmart";
import ProductBundleBelongsTo from "@/components/ProductBundleBelongsTo";
import CrossSellComplete from "@/components/CrossSellComplete";
import VisualComposition from "@/components/VisualComposition";
import ProductGallery from "@/components/ProductGallery";
import { StickyAddToCart } from "@/components/StickyAddToCart";
import { QuickQuoteSummary } from "@/components/QuickQuoteSummary";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import Chatbot from "@/components/Chatbot";
import DynamicSEO from "@/components/DynamicSEO";
import ProductStructuredData from "@/components/ProductStructuredData";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import TrustBadges from "@/components/TrustBadges";
import { PdpBadge, resolveEffectiveBadge } from "@/components/PdpBadge";
import FAQSection from "@/components/FAQSection";
import { ProductFAQ } from "@/components/ProductFAQ";
import { useProductFaqs, buildAutoFaq } from "@/hooks/useProductFaqs";
import { useDbProduct, useDbProducts } from "@/hooks/useProducts";
import { useProductReviews, useProductReviewStats } from "@/hooks/useProductReviews";
import ProductReviews from "@/components/ProductReviews";
import ProductRatingBadge from "@/components/ProductRatingBadge";
import { usePaymentConfig } from "@/hooks/useStoreSettings";
import {
  trackProductView,
  trackInquiry,
  buildWhatsAppUrl,
  trackWhatsAppClick,
  trackFunnelEvent,
} from "@/lib/analytics";
import { useContactInfo } from "@/hooks/useContactInfo";
import { toast as sonnerToast } from "sonner";
import { useConversionCtaConfig } from "@/hooks/useConversionCtaConfig";
import { renderWhatsAppMessage, normalizeQuantity, normalizePersonalization } from "@/lib/whatsappTemplate";
import { useCart } from "@/contexts/CartContext";
import { useSemanticContext } from "@/hooks/useSemanticContext";
import { buildContextualLinksForProduct } from "@/lib/linkOrchestrator";
import SemanticLinkingBlock from "@/components/SemanticLinkingBlock";
import type { Product } from "@/data/products";
import { resolvePrimaryAction } from "@/lib/primaryAction";
import { logSlugEvent } from "@/lib/slugObservability";
import { urls } from "@/lib/urls";
import { usePdpSectionsPublic } from "@/hooks/usePdpSections";
import { pdpSectionRegistry } from "@/lib/pdpSectionsRegistry";

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { whatsappNumber } = useContactInfo();
  const phone = (whatsappNumber || "5541992214299").replace(/\D/g, "");
  const navigate = useNavigate();
  const { data: dbProduct, isLoading } = useDbProduct(slug || "");
  const { data: allProducts } = useDbProducts();
  const { data: pdpSections } = usePdpSectionsPublic();
  const { data: paymentConfig } = usePaymentConfig();
  const { data: reviews = [] } = useProductReviews(dbProduct?.id);
  const { data: reviewStats } = useProductReviewStats(dbProduct?.id);
  const { addItem } = useCart();
  const { data: semanticCtx } = useSemanticContext();
  const { data: ctaConfig } = useConversionCtaConfig();

  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(10);
  const [quantityInput, setQuantityInput] = useState<string>("10");
  const [personalization, setPersonalization] = useState("");
  const [addedToCart, setAddedToCart] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState("");
  const ctaAnchorRef = useRef<HTMLDivElement | null>(null);
  // Ref no wrapper do CTA primário — alvo do IntersectionObserver do sticky mobile.
  const primaryCtaRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  // Ref sempre fresco com estado atual — garante que callbacks (sticky, popup, summary)
  // construam a mensagem com a quantidade/personalização do momento do clique,
  // sem depender de closures eventualmente desatualizadas.
  const valuesRef = useRef({ quantity, personalization });
  valuesRef.current = { quantity, personalization };

  // Sticky CTA: gatilho via IntersectionObserver no botão de compra principal.
  // - Aparece quando o CTA primário sai do viewport (rolagem para baixo).
  // - Esconde suavemente quando o CTA volta a ficar visível.
  // - Fallback por scroll caso o ref ainda não esteja montado (hidratação inicial).
  useEffect(() => {
    const target = primaryCtaRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      // Fallback determinístico: aparece após ~25% da viewport rolada.
      const ratio = ctaConfig?.sticky?.scrollViewportRatio ?? 0.25;
      const onScroll = () => {
        const threshold = Math.max(120, window.innerHeight * ratio);
        setShowStickyCta(window.scrollY > threshold);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener("scroll", onScroll);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        // Sticky aparece somente quando o CTA principal NÃO está visível.
        setShowStickyCta(!entry.isIntersecting);
      },
      // rootMargin negativo no topo evita "flicker" próximo ao header fixo.
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [dbProduct?.id, ctaConfig?.sticky?.scrollViewportRatio]);

  // Fase 1 — Replace controlado para slug primário.
  // Blindagens: didReplaceRef (1x por mount) + checagem de pathname atual.
  const didReplaceRef = useRef(false);
  useEffect(() => {
    const meta = dbProduct?.__slugMeta;
    if (!meta || !meta.shouldRedirect) return;
    if (didReplaceRef.current) return;
    const targetPath = urls.product(meta.primarySlug);
    if (window.location.pathname === targetPath) {
      logSlugEvent({
        event: "loop_prevented",
        matchedSlug: meta.matchedSlug,
        primarySlug: meta.primarySlug,
        pathname: window.location.pathname,
      });
      return;
    }
    didReplaceRef.current = true;
    logSlugEvent({
      event: "replace_executed",
      matchedSlug: meta.matchedSlug,
      primarySlug: meta.primarySlug,
      productId: dbProduct?.id,
      pathname: window.location.pathname,
    });
    navigate(targetPath, { replace: true });
  }, [dbProduct?.__slugMeta, dbProduct?.id, navigate]);

  // Convert to display format
  const product = dbProduct
    ? {
        id: dbProduct.id,
        slug: dbProduct.slug,
        name: dbProduct.name,
        description: dbProduct.description || "",
        longDescription: dbProduct.long_description || undefined,
        price: dbProduct.price,
        originalPrice: dbProduct.original_price,
        images: dbProduct.images,
        link: "",
        badge: dbProduct.badge || undefined,
        rating: Math.round(dbProduct.rating),
        minQuantity: dbProduct.min_quantity,
        pixDiscount: dbProduct.pix_discount,
        productionDays: dbProduct.production_days,
        weight: dbProduct.weight || 25,
        keywords: dbProduct.keywords || [],
      }
    : null;

  // Related products
  const relatedProducts: Product[] = (allProducts || [])
    .filter((p) => p.is_active && p.id !== dbProduct?.id)
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description || "",
      price: `R$ ${p.price.toFixed(2).replace(".", ",")}`,
      originalPrice: p.original_price ? `R$ ${p.original_price.toFixed(2).replace(".", ",")}` : undefined,
      image: p.images[0] || "/placeholder.svg",
      images: p.images,
      link: "",
      badge: p.badge || undefined,
      rating: Math.round(p.rating),
      category: "outros" as const,
      occasions: [],
      keywords: p.keywords,
    }));

  // Track product view
  useEffect(() => {
    if (product) {
      trackProductView(product.name, product.id, `R$ ${product.price.toFixed(2)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Set initial quantity to min quantity (only when product changes)
  useEffect(() => {
    if (product) {
      const q = product.minQuantity;
      setQuantity(q);
      setQuantityInput(String(q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.minQuantity]);

  const handleAddToCart = () => {
    if (!product) return;

    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice && product.originalPrice > product.price ? product.originalPrice : undefined,
      image: product.images[0] || "/placeholder.svg",
      personalization,
      minQuantity: product.minQuantity,
      quantity,
    });
    setAddedToCart(true);
    navigate("/carrinho");
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copiado!",
        description: "O link do produto foi copiado para a área de transferência.",
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const handleFavoriteToggle = (source: "image_overlay" | "actions") => {
    if (!product) return;
    setIsFavorite((current) => {
      const next = !current;
      setFavoriteFeedback(next ? "Produto adicionado aos favoritos." : "Produto removido dos favoritos.");
      trackFunnelEvent("pdp_favorite_toggle", {
        source,
        product_id: product.id,
        product_slug: product.slug,
        favorite_state: next ? "added" : "removed",
        viewport: window.innerWidth < 768 ? "mobile" : "desktop",
      });
      return next;
    });
  };

  // ---- WhatsApp builder reutilizado pelo CTA inline, sticky, summary e exit popup ----
  // Lê SEMPRE o estado atual via valuesRef → sem delays de render (qty/personalização frescas).
  const buildWhatsAppMessage = () => {
    if (!product) return { url: "", utmCampaign: "" };
    const utmCampaign = `produto_${product.slug}`;
    const liveQty = normalizeQuantity(valuesRef.current.quantity);
    const livePersonalization = normalizePersonalization(valuesRef.current.personalization);

    const template =
      ctaConfig?.whatsappTemplate?.template ||
      "Olá! Tenho interesse no produto *{produto}*.{contexto}\n\n📝 *Detalhes:*\n- Quantidade: {qtd} unidades\n{personalizacao_linha}- Link: {link}{imagem_linha}\n\nPoderia me ajudar com o valor do frete e prazos?";

    const waMsg = renderWhatsAppMessage(template, {
      productName: product.name,
      productSlug: product.slug,
      link: window.location.href,
      quantity: liveQty,
      personalization: livePersonalization,
      price: `R$ ${product.price.toFixed(2).replace(".", ",")}`,
      imageUrl: product.images?.[0],
      category: dbProduct?.category?.name,
      occasion: dbProduct?.occasions?.[0]?.name,
      segment: dbProduct?.segments?.[0]?.name,
    });

    return {
      url: buildWhatsAppUrl({
        phone,
        message: waMsg,
        utm_source: "pdp",
        utm_medium: "whatsapp_cta",
        utm_campaign: utmCampaign,
        utm_content: product.slug,
      }),
      utmCampaign,
    };
  };

  const openWhatsApp = (
    source: "product_page" | "sticky_cta" | "quick_summary" | "exit_popup" | "pdp_badge" = "product_page",
  ) => {
    if (!product) return;
    const { url, utmCampaign } = buildWhatsAppMessage();
    if (!url) return;
    const liveQty = normalizeQuantity(valuesRef.current.quantity);
    const livePersonalized = Boolean(normalizePersonalization(valuesRef.current.personalization));

    trackInquiry(product.name, product.id);
    trackWhatsAppClick({ source, context: product.slug, utm_campaign: utmCampaign });
    trackFunnelEvent("pdp_whatsapp_click", {
      source,
      product_id: product.id,
      product_slug: product.slug,
      quantity: liveQty,
      personalized: livePersonalized,
    });
    window.open(url, "_blank", "noopener,noreferrer");

    // Confirmação visual + tracking pós-clique (reduz dúvida de "funcionou?")
    if (ctaConfig?.toast?.enabled !== false) {
      sonnerToast.success(ctaConfig?.toast?.message || "Abrindo o WhatsApp…", {
        duration: ctaConfig?.toast?.durationMs ?? 4000,
      });
    }
    trackFunnelEvent("whatsapp_click_confirmed", {
      source,
      product_id: product.id,
      product_slug: product.slug,
      quantity: liveQty,
      personalized: livePersonalized,
    });
  };

  // Fase 1.5 — observabilidade canonical_mismatch (DEVE rodar antes de qualquer early-return
  // para manter contagem estável de hooks entre renders).
  const _slugMetaForEffect = dbProduct?.__slugMeta;
  const _canonicalSlugForEffect = _slugMetaForEffect?.primarySlug ?? dbProduct?.slug ?? "";
  useEffect(() => {
    if (!_slugMetaForEffect || _slugMetaForEffect.shouldRedirect || !_canonicalSlugForEffect) return;
    const expected = urls.product(_canonicalSlugForEffect);
    const actual = window.location.pathname;
    if (actual !== expected) {
      logSlugEvent({
        event: "canonical_mismatch",
        expected,
        actual,
        primarySlug: _canonicalSlugForEffect,
        productId: dbProduct?.id,
      });
    }
  }, [_slugMetaForEffect, _canonicalSlugForEffect, dbProduct?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 md:pt-32 pb-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 md:pt-32 pb-16 container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl text-foreground mb-4">Produto não encontrado</h1>
          <p className="text-muted-foreground mb-8">O produto que você procura não existe ou foi removido.</p>
          <Link to="/produtos">
            <Button>Ver todos os produtos</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Calculate totals using store settings
  const totalPrice = product.price * quantity;
  const pixDiscountPercent = paymentConfig?.pix_discount ?? 5;
  const installments = paymentConfig?.installments ?? 3;
  const pixPrice = totalPrice * (1 - pixDiscountPercent / 100);
  const installmentValue = totalPrice / installments;
  const discountPercent = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : null;

  // Generate product code from ID
  const productCode = product.id.slice(0, 8).toUpperCase();

  // Fase 1 — Canonical slug deriva SEMPRE de __slugMeta.primarySlug.
  // Sem fallback silencioso: ausência é inconsistência estrutural.
  const slugMeta = dbProduct?.__slugMeta;
  if (!slugMeta?.primarySlug) {
    logSlugEvent({
      event: "structural_inconsistency",
      reason: "missing_primary_slug_meta",
      productId: dbProduct?.id,
      matchedSlug: slug,
    });
  }
  const canonicalSlug = slugMeta?.primarySlug ?? product.slug;
  const canonicalUrl = urls.productCanonical(canonicalSlug);

  // (useEffect movido para antes dos early returns — ver bloco acima do `if (isLoading)`)

  return (
    <div className="min-h-screen bg-background">
      {/* SEO and Structured Data — Fase 7 */}
      <DynamicSEO
        title={`${product.name} | Empório LeleCute`}
        description={(() => {
          const raw =
            product.description ||
            (product.longDescription ? product.longDescription.replace(/\s+/g, " ").trim() : "") ||
            `Lembrancinha artesanal ${product.name}, feita à mão e personalizada para ocasiões especiais. Empório LeleCute envia para todo o Brasil.`;
          return raw.length > 160 ? raw.slice(0, 157).trimEnd() + "…" : raw;
        })()}
        image={product.images[0] || undefined}
        url={canonicalUrl}
        type="product"
      />
      <ProductStructuredData
        name={product.name}
        description={product.description || `Lembrancinha artesanal ${product.name}`}
        price={product.price}
        originalPrice={product.originalPrice && product.originalPrice > product.price ? product.originalPrice : undefined}
        images={product.images}
        slug={canonicalSlug}
        rating={reviewStats?.avg_rating ? Number(reviewStats.avg_rating) : undefined}
        reviewCount={reviewStats?.review_count}
        productionDays={product.productionDays}
        category={dbProduct?.category?.name}
        material="Artesanal — produzido à mão no Brasil"
        reviews={reviews.map((r) => ({
          author_name: r.author_name,
          rating: r.rating,
          comment: r.comment,
          review_date: r.review_date,
          source: r.source,
        }))}
      />
      <BreadcrumbStructuredData
        items={[
          { name: "Início", url: "https://emporiolelecute.com.br/" },
          ...(dbProduct?.segments?.[0]
            ? [
                {
                  name: dbProduct.segments[0].name,
                  url: `https://emporiolelecute.com.br/segmento/${dbProduct.segments[0].slug}`,
                },
              ]
            : []),
          ...(dbProduct?.occasions?.[0]
            ? [
                {
                  name: dbProduct.occasions[0].name,
                  url: `https://emporiolelecute.com.br/ocasiao/${dbProduct.occasions[0].slug}`,
                },
              ]
            : []),
          ...(dbProduct?.category && !dbProduct?.segments?.[0] && !dbProduct?.occasions?.[0]
            ? [
                {
                  name: dbProduct.category.name,
                  url: `https://emporiolelecute.com.br/categoria/${dbProduct.category.slug}`,
                },
              ]
            : []),
          { name: product.name, url: canonicalUrl },
        ]}
      />
      <Header />

      <main className="pt-20 md:pt-32 pb-16 max-w-full overflow-x-hidden">
        {/* Breadcrumb */}
        <div className="layout-commerce py-1.5 md:py-3 overflow-hidden">
          <nav
            className="flex max-w-full items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1 text-xs sm:text-sm text-muted-foreground scrollbar-hide"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="shrink-0 hover:text-primary transition-colors">
              Início
            </Link>

            {dbProduct?.segments?.[0] && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                <Link
                  to={`/segmento/${dbProduct.segments[0].slug}`}
                  className="shrink-0 hover:text-primary transition-colors"
                >
                  {dbProduct.segments[0].name}
                </Link>
              </>
            )}

            {dbProduct?.occasions?.[0] && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                <Link
                  to={`/ocasiao/${dbProduct.occasions[0].slug}`}
                  className="shrink-0 hover:text-primary transition-colors"
                >
                  {dbProduct.occasions[0].name}
                </Link>
              </>
            )}

            {dbProduct?.category && !dbProduct?.segments?.[0] && !dbProduct?.occasions?.[0] && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                <Link
                  to={`/categoria/${dbProduct.category.slug}`}
                  className="shrink-0 hover:text-primary transition-colors"
                >
                  {dbProduct.category.name}
                </Link>
              </>
            )}

            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            <span className="min-w-0 truncate text-foreground font-medium">{product.name}</span>
          </nav>
        </div>

        {/* Product Detail */}
        <div className="layout-commerce overflow-x-hidden">
          <div className="grid min-w-0 lg:grid-cols-2 gap-6 lg:gap-10 mb-12 lg:mb-16">

            {/* Image Gallery - Horizontal layout with thumbnails below */}
            <div className="relative min-w-0 max-w-full overflow-hidden" data-testid="pdp-media-block">
              <ProductGallery
                images={product.images.length > 0 ? product.images : ["/placeholder.svg"]}
                productName={product.name}
                badge={product.badge}
                layout="horizontal"
              />

              {/* Resolve badge first so we can place favorite opposite to it */}
              {(() => {
                const eff = resolveEffectiveBadge(ctaConfig?.pdpBadge, (dbProduct as any)?.pdp_badge_override);
                const badgeIsLeft = eff?.config.position?.endsWith("left") ?? true;
                const favSideClass = badgeIsLeft ? "right-3 sm:right-4" : "left-3 sm:left-4";
                return (
                  <>
                    {/* Favorite Button — always opposite the badge, never covered */}
                    <button
                      type="button"
                      data-testid="pdp-favorite-button"
                      onClick={() => handleFavoriteToggle("image_overlay")}
                      aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar produto"}
                      aria-pressed={isFavorite}
                      className={`absolute top-3 sm:top-4 ${favSideClass} z-40 min-w-12 min-h-12 sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-full border border-border/40 bg-background/80 text-foreground backdrop-blur-sm transition-all touch-manipulation hover:bg-background hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isFavorite ? "border-primary/60 bg-primary/10 text-primary" : ""}`}
                    >
                      <Heart
                        key={String(isFavorite)}
                        className={`h-6 w-6 transition-colors ${
                          isFavorite ? "fill-primary text-primary animate-heart-pop" : "text-foreground"
                        }`}
                        strokeWidth={isFavorite ? 0 : 2.2}
                      />
                    </button>
                    <span className="sr-only" aria-live="polite">
                      {favoriteFeedback}
                    </span>

                    {eff && (
                      <PdpBadge
                        config={eff.config}
                        productId={dbProduct?.id}
                        productSlug={dbProduct?.slug}
                        source={eff.source}
                        onClick={() => openWhatsApp("pdp_badge")}
                      />
                    )}
                  </>
                );
              })()}

              {/* Reviews under the gallery thumbnails — exibido apenas quando há avaliações reais */}
              {dbProduct?.id && reviewStats?.review_count ? (
                <div className="hidden lg:block">
                  <ProductReviews productId={dbProduct.id} variant="compact" initialLimit={3} />
                </div>
              ) : null}
            </div>

            {/* Info Section - Reference Style (cap editorial em desktop p/ preservar proximidade) */}
            <div className="flex min-w-0 w-full lg:max-w-[560px] flex-col overflow-hidden">

              {/* Product Name */}
              <div className="flex items-start justify-between gap-3 sm:gap-4 mb-2">
                <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-light text-foreground leading-tight tracking-tight min-w-0 break-words">
                  {product.name}
                </h1>
              </div>

              {/* Prova social acima da dobra — clicável, faz scroll até a seção completa de reviews */}
              <div className="mb-4">
                <ProductRatingBadge productId={dbProduct?.id} />
              </div>

              {/* Trust row consolidado — linha editorial sutil, sem pílulas cromáticas */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5 text-xs text-muted-foreground">
                {(dbProduct as any)?.show_min_quantity === true && (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Mínimo {product.minQuantity} un.
                    </span>
                    <span className="text-muted-foreground/40" aria-hidden="true">
                      ·
                    </span>
                  </>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Pronto em {product.productionDays} dias úteis
                </span>
                <span className="text-muted-foreground/40" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Envio Brasil
                </span>
              </div>

              {/* Category, Occasions & Tags — hierarquia suave: categoria com leve destaque, resto neutro */}
              <div className="flex flex-wrap gap-2 mb-4">
                {/* Category Badge — leve destaque editorial */}
                {dbProduct?.category && (
                  <Link
                    to={`/produtos?categoria=${dbProduct.category.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 rounded-full text-sm font-medium text-primary transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {dbProduct.category.name}
                  </Link>
                )}

                {/* Occasion Badges — neutras, sem cromia competitiva */}
                {dbProduct?.occasions &&
                  dbProduct.occasions.length > 0 &&
                  dbProduct.occasions.map((occasion) => (
                    <Link
                      key={occasion.id}
                      to={`/produtos?ocasiao=${occasion.slug}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/70 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {occasion.name}
                    </Link>
                  ))}

                {/* Tags — neutras, ainda mais discretas */}
                {dbProduct?.tags &&
                  dbProduct.tags.length > 0 &&
                  dbProduct.tags.slice(0, 3).map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/produtos?search=${encodeURIComponent(tag.name)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 hover:bg-muted rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Tag className="h-3 w-3" strokeWidth={1.5} />
                      {tag.name}
                    </Link>
                  ))}
              </div>

              {/* Preço — hierarquia editorial (total primeiro, unitário e parcelas como apoio).
                  Quando há originalPrice (preço "de"), exibe riscado + selo de % de desconto. */}
              <div className="mb-6 min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Valor total</p>
                {product.originalPrice && product.originalPrice > product.price && (
                  <p className="text-sm text-muted-foreground line-through break-words leading-none mb-1">
                    De R$ {(product.originalPrice * quantity).toFixed(2).replace(".", ",")}
                  </p>
                )}
                <p className="font-display text-3xl sm:text-4xl font-light text-foreground break-words leading-none">
                  R$ {totalPrice.toFixed(2).replace(".", ",")}
                  {discountPercent && discountPercent > 0 && (
                    <span className="ml-3 align-middle inline-block text-xs font-medium uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded">
                      -{discountPercent}%
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-2 break-words">
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="line-through mr-1.5">
                      R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  <span className="text-foreground">R$ {product.price.toFixed(2).replace(".", ",")}</span> / unidade
                  <span className="text-muted-foreground/40 mx-2" aria-hidden="true">
                    ·
                  </span>
                  {product.minQuantity} un. mín.
                </p>
                <p className="text-sm text-muted-foreground mt-1 break-words">
                  {installments}x sem juros de R$ {installmentValue.toFixed(2).replace(".", ",")}
                  <span className="text-muted-foreground/40 mx-2" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-foreground">R$ {pixPrice.toFixed(2).replace(".", ",")}</span>
                  <span className="text-muted-foreground"> no PIX (-{pixDiscountPercent}%)</span>
                </p>
              </div>

              {/* Description (resumo) — o CTA WhatsApp foi movido para baixo da descrição completa (seção PDP). */}
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {product.description ||
                  `Lembrancinha especial com sabonete artesanal. Perfeito para lembrancinhas de maternidade, batizado e eventos especiais.`}
              </p>

              {/* Personalization Field - only show if enabled */}
              {dbProduct?.personalization_enabled !== false && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5 mb-6">
                  <h3 className="text-sm font-medium text-foreground mb-3 tracking-wide">
                    {dbProduct?.personalization_label || "Personalização"}
                  </h3>
                  <Textarea
                    placeholder={
                      dbProduct?.personalization_placeholder || "Digite o nome, data ou mensagem para personalização..."
                    }
                    value={personalization}
                    onChange={(e) => setPersonalization(e.target.value)}
                    className="min-h-[80px] resize-none border-border/40 focus-visible:ring-1"
                  />
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="font-medium text-foreground">Quantidade</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary/80">
                    <Package className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                    Mínimo {product.minQuantity} un.
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden max-w-full">
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(product.minQuantity, quantity - 1);
                        setQuantity(next);
                        setQuantityInput(String(next));
                      }}
                      disabled={quantity <= product.minQuantity}
                      className="p-3 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={quantityInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setQuantityInput(raw);
                        const parsed = Number(raw);
                        if (Number.isFinite(parsed) && parsed >= product.minQuantity) {
                          setQuantity(parsed);
                        }
                      }}
                      onBlur={() => {
                        const parsed = Number(quantityInput);
                        const next =
                          Number.isFinite(parsed) && parsed >= product.minQuantity ? parsed : product.minQuantity;
                        setQuantity(next);
                        setQuantityInput(String(next));
                      }}
                      className="w-20 text-center border-0 bg-transparent focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={product.minQuantity}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = quantity + 1;
                        setQuantity(next);
                        setQuantityInput(String(next));
                      }}
                      className="p-3 hover:bg-muted transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumo rápido + CTA WhatsApp — exibido apenas quando WhatsApp é primário
                  (personalizado / sem estoque). Para pronta entrega o CTA primário é o carrinho,
                  evitando concorrência de 3 CTAs verdes acima da dobra. */}
              <QuickQuoteSummary
                minQuantity={product.minQuantity}
                productionDays={product.productionDays}
                quantity={quantity}
                personalization={personalization}
                onWhatsApp={() => openWhatsApp("quick_summary")}
                productSlug={product.slug}
                productName={product.name}
                occasionName={dbProduct?.occasions?.[0]?.name}
                enabled={
                  (dbProduct as any)?.show_quick_summary === true &&
                  resolvePrimaryAction(dbProduct).primary !== "cart" &&
                  ctaConfig?.quickSummary?.enabled !== false
                }
                title={ctaConfig?.quickSummary?.title}
                minLabel={ctaConfig?.quickSummary?.minLabel}
                prazoLabel={ctaConfig?.quickSummary?.prazoLabel}
                shippingLabel={ctaConfig?.quickSummary?.shippingLabel}
                shippingValue={ctaConfig?.quickSummary?.shippingValue}
                ctaLabel={ctaConfig?.quickSummary?.ctaLabel}
              />

              {/* Nota frete — microcopy editorial, sem caixa colorida */}
              <p className="text-xs text-muted-foreground mb-6 text-center">
                Frete calculado via WhatsApp após o pedido.
              </p>

              {/* Sprint 4 — CTA primário decidido por resolvePrimaryAction(product) */}
              {(() => {
                const action = resolvePrimaryAction(dbProduct);
                const isWaPrimary = action.primary === "whatsapp";
                const cartBtn = (primary: boolean) => (
                  <Button
                    size="lg"
                    className={`min-w-0 flex-1 rounded-lg px-3 py-5 text-sm sm:text-base font-medium shadow-sm hover:shadow-md transition-all ${
                      addedToCart
                        ? "bg-green-500 hover:bg-green-600 text-white"
                        : primary
                          ? "bg-primary hover:bg-primary-dark text-primary-foreground"
                          : "bg-card border border-primary/60 text-primary hover:bg-primary/5"
                    }`}
                    variant={primary ? "default" : "outline"}
                    onClick={handleAddToCart}
                  >
                    {addedToCart ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
                        <span className="truncate">Adicionado!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 mr-2 shrink-0" />
                        <span className="truncate">{primary ? "Adicionar ao Carrinho" : "Adicionar ao carrinho"}</span>
                      </>
                    )}
                  </Button>
                );
                return (
                  <>
                    <div ref={primaryCtaRef} className="flex min-w-0 items-stretch gap-2 sm:gap-3 mb-4 lg:max-w-[420px]">
                      {cartBtn(true)}
                      {/* Favorite */}
                      <Button
                        variant="outline"
                        size="lg"
                        className={`min-h-11 min-w-11 shrink-0 px-3 sm:px-4 focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-2 ${isFavorite ? "border-primary bg-primary/10 text-primary" : ""}`}
                        onClick={() => handleFavoriteToggle("actions")}
                        aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar produto"}
                        aria-pressed={isFavorite}
                      >
                        <Heart
                          className={`h-5 w-5 ${isFavorite ? "fill-primary text-primary animate-heart-pop" : ""}`}
                        />
                      </Button>
                      {/* Share */}
                      <Button
                        variant="outline"
                        size="lg"
                        className="min-h-11 min-w-11 shrink-0 px-3 sm:px-4"
                        onClick={handleShare}
                        aria-label="Compartilhar produto"
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Go to Cart Button - Shows after adding to cart */}
                    {addedToCart && (
                      <Button
                        size="lg"
                        className="w-full lg:max-w-[420px] bg-primary hover:bg-primary-dark text-primary-foreground rounded-lg py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all mb-4"
                        onClick={() => navigate("/carrinho")}
                      >
                        Finalizar Compra Agora
                        <ChevronRight className="h-5 w-5 ml-2" />
                      </Button>
                    )}
                  </>
                );
              })()}

              {/* Payment Methods — discreto: oculto no mobile, micro no desktop */}
              <div className="hidden md:block mb-6">
                <p className="text-[11px] text-muted-foreground/70">
                  Aceitamos
                  {paymentConfig?.accepted_methods?.pix ? <span className="text-muted-foreground"> PIX</span> : null}
                  {paymentConfig?.accepted_methods?.credit_card ? (
                    <>
                      <span className="text-muted-foreground/40">,</span>
                      <span className="text-muted-foreground"> Cartão de Crédito</span>
                    </>
                  ) : null}
                  {paymentConfig?.accepted_methods?.boleto ? (
                    <>
                      <span className="text-muted-foreground/40">,</span>
                      <span className="text-muted-foreground"> Boleto Bancário</span>
                    </>
                  ) : null}
                  .
                </p>
              </div>

              {/* Trust badges 3-up removidos — informação já consolidada na linha editorial do topo */}

              {/* Trust Badges horizontais removidos — consolidados na linha editorial do topo. */}

              {/* Tags Section — oculto quando dbProduct.tags já renderizou chips acima (zero redundância) */}
              {product.keywords && product.keywords.length > 0 && !(dbProduct?.tags && dbProduct.tags.length > 0) && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.keywords.map((keyword, index) => (
                      <Link
                        key={index}
                        to={`/produtos?search=${encodeURIComponent(keyword)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-primary-light rounded-full text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Tag className="h-3 w-3" />
                        {keyword}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seções gerenciadas via /admin/pdp-sections (ordem + visibilidade).
              Wrapper aplica cadência editorial: hairline mobile entre módulos (a partir do 2º). */}
          {(pdpSections ?? []).map((s, idx) => {
            const renderer = pdpSectionRegistry[s.section_key];
            if (!renderer) return null;
            const node = renderer({ product, dbProduct, canonicalUrl });
            if (!node) return null;
            return (
              <div
                key={s.section_key}
                className={`max-w-3xl mr-auto ${idx > 0 ? "border-t border-border/40 pt-10 md:border-0 md:pt-0" : ""}`.trim()}
              >


                {node}
                {s.section_key === "description" &&
                  ctaConfig?.inlineCta?.enabled !== false &&
                  (() => {
                    const { url } = buildWhatsAppMessage();
                    const inline = ctaConfig?.inlineCta;
                    const label = inline?.label || "Fazer Orçamento no WhatsApp";
                    const showIcon = inline?.showIcon !== false;
                    const variant = inline?.variant || "dark";
                    const variantClass =
                      variant === "primary"
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : variant === "whatsapp"
                        ? "bg-[#25D366] hover:bg-[#1ebe57] text-white"
                        : variant === "outline"
                        ? "border-2 border-foreground/80 hover:bg-foreground hover:text-background text-foreground"
                        : "bg-foreground/95 hover:bg-foreground text-background";
                    return (
                      <div ref={ctaAnchorRef} className="mt-6 mb-10 max-w-3xl">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            openWhatsApp("product_page");
                          }}
                          className={`flex max-w-full items-center justify-center gap-3 p-4 rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-300 ${variantClass}`}
                        >
                          {showIcon && <MessageCircle className="h-6 w-6 shrink-0" />}
                          <span className="min-w-0 truncate">{label}</span>
                        </a>
                      </div>
                    );
                  })()}
              </div>
            );
          })}

          {/* Fase 11.1 — Linking semântico contextual (SAFE MODE) */}
          {(() => {
            const usedPaths = new Set<string>();
            // Paths já exibidos: breadcrumb, badges, RelatedByTaxonomy, tags relacionadas
            if (dbProduct?.category) usedPaths.add(`/categoria/${dbProduct.category.slug}`);
            (dbProduct?.occasions ?? []).forEach((o) => usedPaths.add(`/ocasiao/${o.slug}`));
            (dbProduct?.segments ?? []).forEach((s) => usedPaths.add(`/segmento/${s.slug}`));
            (dbProduct?.tags ?? []).forEach((t) => usedPaths.add(`/tag/${t.slug}`));

            const links = buildContextualLinksForProduct(
              { slug: product.slug },
              {
                themes: semanticCtx.themes,
                combinations: semanticCtx.combinations,
                posts: semanticCtx.posts,
              },
            )
              .filter((l) => !usedPaths.has(l.path))
              .slice(0, 8); // hard cap absoluto

            if (links.length < 3) return null;
            return (
              <div className="container mx-auto max-w-full overflow-hidden">
                <SemanticLinkingBlock title="Explore mais ideias relacionadas" links={links} />
              </div>
            );
          })()}
        </div>
      </main>

      <TrustBadges />

      {/* FAQ editorial por PDP — overrides do admin (product_faqs) ou fallback automático */}
      {dbProduct?.id && (
        <section className="layout-conversational">
          <ProductPdpFaq
            productId={dbProduct.id}
            productName={product.name}
            productionDays={dbProduct.production_days}
            personalizationEnabled={dbProduct.personalization_enabled}
            categoryName={dbProduct.category?.name ?? null}
          />
        </section>
      )}

      <FAQSection />

      <Footer />
      {/* Spacer mobile para o sticky CTA não cobrir o final do rodapé */}
      <div aria-hidden className="md:hidden h-[58px]" />

      {/* WhatsAppButton removido da PDP — sticky CTA + CTAs inline já cobrem a ação principal e evitam conflito de FABs */}
      <Chatbot />

      {/* Sticky CTA mobile — aparece quando o CTA principal sai do viewport */}
      <StickyAddToCart
        productName={product.name}
        productSlug={product.slug}
        price={`R$ ${totalPrice.toFixed(2).replace(".", ",")}`}
        installments={
          installments > 1
            ? `${installments}x sem juros de R$ ${installmentValue.toFixed(2).replace(".", ",")}`
            : undefined
        }
        imageUrl={product.images?.[0]}
        isVisible={showStickyCta}
        onAddToCart={handleAddToCart}
        onWhatsApp={() => openWhatsApp("sticky_cta")}
        primaryAction={resolvePrimaryAction(dbProduct).primary}
        enabled={ctaConfig?.sticky?.enabled !== false}
      />

      {/* Exit intent popup — usa getWhatsappUrl para garantir estado fresco no clique */}
      <ExitIntentPopup
        getWhatsappUrl={() => buildWhatsAppMessage().url}
        productName={product.name}
        productSlug={product.slug}
        minQuantity={product.minQuantity}
        productionDays={product.productionDays}
        quantity={quantity}
        personalized={Boolean(normalizePersonalization(personalization))}
        enabled={ctaConfig?.exitPopup?.enabled !== false}
        title={ctaConfig?.exitPopup?.title}
        description={ctaConfig?.exitPopup?.description}
        ctaLabel={ctaConfig?.exitPopup?.ctaLabel}
        dismissLabel={ctaConfig?.exitPopup?.dismissLabel}
        maxPerSession={ctaConfig?.exitPopup?.maxPerSession}
        cooldownMinutes={ctaConfig?.exitPopup?.cooldownMinutes}
        armDelayMs={ctaConfig?.exitPopup?.armDelayMs}
      />
    </div>
  );
};

function ProductPdpFaq({
  productId,
  productName,
  productionDays,
  personalizationEnabled,
  categoryName,
}: {
  productId: string;
  productName: string;
  productionDays?: number | null;
  personalizationEnabled?: boolean | null;
  categoryName?: string | null;
}) {
  const { data: pf = [] } = useProductFaqs(productId);
  const items =
    pf.length > 0
      ? pf.map((f) => ({ question: f.question, answer: f.answer }))
      : buildAutoFaq({ productName, productionDays, personalizationEnabled, categoryName });
  return <ProductFAQ productName={productName} items={items} />;
}

export default ProductPage;
