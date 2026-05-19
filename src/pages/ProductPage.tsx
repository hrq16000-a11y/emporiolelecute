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
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
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
import { useDbProduct, useDbProducts } from "@/hooks/useProducts";
import { useProductReviews, useProductReviewStats } from "@/hooks/useProductReviews";
import ProductReviews from "@/components/ProductReviews";
import { usePaymentConfig } from "@/hooks/useStoreSettings";
import { trackProductView, trackInquiry, buildWhatsAppUrl, trackWhatsAppClick, trackFunnelEvent } from "@/lib/analytics";
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
  const { toast } = useToast();

  // Ref sempre fresco com estado atual — garante que callbacks (sticky, popup, summary)
  // construam a mensagem com a quantidade/personalização do momento do clique,
  // sem depender de closures eventualmente desatualizadas.
  const valuesRef = useRef({ quantity, personalization });
  valuesRef.current = { quantity, personalization };

  // Sticky CTA: aparece quando o CTA principal sai do viewport (qualquer altura de tela)
  // e some quando o usuário volta para ele. Fallback por scroll caso o ref não exista.
  useEffect(() => {
    const anchor = ctaAnchorRef.current;
    if (anchor && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          // Se o CTA está visível, esconde o sticky.
          // Se saiu do viewport (acima OU abaixo), mostra apenas quando já passou (acima).
          if (entry.isIntersecting) {
            setShowStickyCta(false);
          } else {
            const rect = entry.boundingClientRect;
            setShowStickyCta(rect.top < 0);
          }
        },
        { threshold: 0, rootMargin: "0px 0px -10% 0px" }
      );
      observer.observe(anchor);
      return () => observer.disconnect();
    }
    // Fallback: gatilho relativo à altura da viewport (ratio configurável).
    const ratio = ctaConfig?.sticky?.scrollViewportRatio ?? 0.7;
    const onScroll = () => {
      const threshold = Math.max(320, window.innerHeight * ratio);
      setShowStickyCta(window.scrollY > threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
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
  const product = dbProduct ? {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: dbProduct.name,
    description: dbProduct.description || '',
    longDescription: dbProduct.long_description || undefined,
    price: dbProduct.price,
    originalPrice: dbProduct.original_price,
    images: dbProduct.images,
    link: '',
    badge: dbProduct.badge || undefined,
    rating: Math.round(dbProduct.rating),
    minQuantity: dbProduct.min_quantity,
    pixDiscount: dbProduct.pix_discount,
    productionDays: dbProduct.production_days,
    weight: dbProduct.weight || 25,
    keywords: dbProduct.keywords || [],
  } : null;

  // Related products
  const relatedProducts: Product[] = (allProducts || [])
    .filter(p => p.is_active && p.id !== dbProduct?.id)
    .slice(0, 4)
    .map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description || '',
      price: `R$ ${p.price.toFixed(2).replace('.', ',')}`,
      originalPrice: p.original_price ? `R$ ${p.original_price.toFixed(2).replace('.', ',')}` : undefined,
      image: p.images[0] || '/placeholder.svg',
      images: p.images,
      link: '',
      badge: p.badge || undefined,
      rating: Math.round(p.rating),
      category: 'outros' as const,
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
      image: product.images[0] || '/placeholder.svg',
      personalization,
      minQuantity: product.minQuantity,
      quantity,
    });
    setAddedToCart(true);
  };


  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copiado!",
        description: "O link do produto foi copiado para a área de transferência."
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive"
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

    const template = ctaConfig?.whatsappTemplate?.template
      || "Olá! Tenho interesse no produto *{produto}*.{contexto}\n\n📝 *Detalhes:*\n- Quantidade: {qtd} unidades\n{personalizacao_linha}- Link: {link}{imagem_linha}\n\nPoderia me ajudar com o valor do frete e prazos?";

    const waMsg = renderWhatsAppMessage(template, {
      productName: product.name,
      productSlug: product.slug,
      link: window.location.href,
      quantity: liveQty,
      personalization: livePersonalization,
      price: `R$ ${product.price.toFixed(2).replace('.', ',')}`,
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
    source: "product_page" | "sticky_cta" | "quick_summary" | "exit_popup" | "pdp_badge" = "product_page"
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
      sonnerToast.success(
        ctaConfig?.toast?.message || "Abrindo o WhatsApp…",
        { duration: ctaConfig?.toast?.durationMs ?? 4000 }
      );
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
  const _canonicalSlugForEffect = _slugMetaForEffect?.primarySlug ?? dbProduct?.slug ?? '';
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
        <main className="pt-24 pb-16 flex items-center justify-center">
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
        <main className="pt-24 pb-16 container mx-auto px-4 text-center">
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
  const discountPercent = product.originalPrice 
    ? Math.round((1 - product.price / product.originalPrice) * 100) 
    : null;

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
          const raw = product.description
            || (product.longDescription ? product.longDescription.replace(/\s+/g, ' ').trim() : '')
            || `Lembrancinha artesanal ${product.name}, feita à mão e personalizada para ocasiões especiais. Empório LeleCute envia para todo o Brasil.`;
          return raw.length > 160 ? raw.slice(0, 157).trimEnd() + '…' : raw;
        })()}
        image={product.images[0] || undefined}
        url={canonicalUrl}
        type="product"
      />
      <ProductStructuredData
        name={product.name}
        description={product.description || `Lembrancinha artesanal ${product.name}`}
        price={product.price}
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
          { name: 'Início', url: 'https://emporiolelecute.com.br/' },
          ...(dbProduct?.segments?.[0]
            ? [{ name: dbProduct.segments[0].name, url: `https://emporiolelecute.com.br/segmento/${dbProduct.segments[0].slug}` }]
            : []),
          ...(dbProduct?.occasions?.[0]
            ? [{ name: dbProduct.occasions[0].name, url: `https://emporiolelecute.com.br/ocasiao/${dbProduct.occasions[0].slug}` }]
            : []),
          ...(dbProduct?.category && !dbProduct?.segments?.[0] && !dbProduct?.occasions?.[0]
            ? [{ name: dbProduct.category.name, url: `https://emporiolelecute.com.br/categoria/${dbProduct.category.slug}` }]
            : []),
          { name: product.name, url: canonicalUrl },
        ]}
      />
      <Header />
      
      <main className="pt-24 pb-16 max-w-full overflow-x-hidden">
        {/* Breadcrumb */}
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link to="/" className="hover:text-primary transition-colors">Início</Link>

            {dbProduct?.segments?.[0] && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link to={`/segmento/${dbProduct.segments[0].slug}`} className="hover:text-primary transition-colors">
                  {dbProduct.segments[0].name}
                </Link>
              </>
            )}

            {dbProduct?.occasions?.[0] && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link to={`/ocasiao/${dbProduct.occasions[0].slug}`} className="hover:text-primary transition-colors">
                  {dbProduct.occasions[0].name}
                </Link>
              </>
            )}

            {dbProduct?.category && !dbProduct?.segments?.[0] && !dbProduct?.occasions?.[0] && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link
                  to={`/categoria/${dbProduct.category.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {dbProduct.category.name}
                </Link>
              </>
            )}

            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{product.name}</span>
          </nav>
        </div>

        {/* Product Detail */}
        <div className="container mx-auto max-w-full px-4 overflow-x-hidden">
          <div className="grid min-w-0 lg:grid-cols-2 gap-6 lg:gap-12 mb-12 lg:mb-16">
            {/* Image Gallery - Horizontal layout with thumbnails below */}
            <div className="relative min-w-0 max-w-full overflow-hidden" data-testid="pdp-media-block">
              <ProductGallery
                images={product.images.length > 0 ? product.images : ['/placeholder.svg']}
                productName={product.name}
                badge={product.badge}
                layout="horizontal"
              />
              
              {/* Resolve badge first so we can place favorite opposite to it */}
              {(() => {
                const eff = resolveEffectiveBadge(
                  ctaConfig?.pdpBadge,
                  (dbProduct as any)?.pdp_badge_override
                );
                const badgeIsLeft = eff?.config.position?.endsWith("left") ?? true;
                const favSideClass = badgeIsLeft
                  ? "right-3 sm:right-4"
                  : "left-3 sm:left-4";
                return (
                  <>
                    {/* Favorite Button — always opposite the badge, never covered */}
                    <button
                      type="button"
                      data-testid="pdp-favorite-button"
                      onClick={() => handleFavoriteToggle("image_overlay")}
                      aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar produto"}
                      aria-pressed={isFavorite}
                      className={`absolute top-3 sm:top-4 ${favSideClass} z-40 min-w-12 min-h-12 sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-medium ring-2 ring-background/80 backdrop-blur-md transition-all touch-manipulation hover:bg-card hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isFavorite ? "border-primary bg-primary/10 text-primary" : ""}`}
                    >
                      <Heart
                        key={String(isFavorite)}
                        className={`h-6 w-6 transition-colors ${
                          isFavorite
                            ? "fill-primary text-primary animate-heart-pop"
                            : "text-foreground"
                        }`}
                        strokeWidth={isFavorite ? 0 : 2.2}
                      />
                    </button>
                    <span className="sr-only" aria-live="polite">{favoriteFeedback}</span>

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

              {/* Reviews under the gallery thumbnails — compact, 3 shown + "Ver mais" */}
              {dbProduct?.id && (
                <div className="hidden lg:block">
                  <ProductReviews productId={dbProduct.id} variant="compact" initialLimit={3} />
                </div>
              )}
            </div>

            {/* Info Section - Reference Style */}
            <div className="flex flex-col">
              {/* Product Name & Rating + Social Proof (Q2) */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="font-display text-2xl md:text-3xl text-foreground leading-tight">
                  {product.name}
                </h1>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1 bg-amber-400 text-white px-2 py-1 rounded-md">
                    <Star className="h-4 w-4 fill-white" />
                    <span className="font-bold text-sm">
                      {reviewStats?.avg_rating ? Number(reviewStats.avg_rating).toFixed(1) : product.rating.toFixed(1)}
                    </span>
                  </div>
                  {reviewStats?.review_count ? (
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {reviewStats.review_count} {reviewStats.review_count === 1 ? "avaliação" : "avaliações"}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Quick trust row — mínimo + prazo (Q3) */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <Package className="h-3.5 w-3.5" />
                  Mínimo {product.minQuantity} un.
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  <Clock className="h-3.5 w-3.5" />
                  Pronto em {product.productionDays} dias úteis
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  <Truck className="h-3.5 w-3.5" />
                  Envio Brasil
                </span>
              </div>


              {/* Category, Occasions & Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {/* Category Badge - using SLUG for friendly URLs */}
                {dbProduct?.category && (
                  <Link
                    to={`/produtos?categoria=${dbProduct.category.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-full text-sm font-medium text-primary transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {dbProduct.category.name}
                  </Link>
                )}
                
                {/* Occasion Badges - using SLUG for friendly URLs */}
                {dbProduct?.occasions && dbProduct.occasions.length > 0 && (
                  dbProduct.occasions.map((occasion) => (
                    <Link
                      key={occasion.id}
                      to={`/produtos?ocasiao=${occasion.slug}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-full text-sm font-medium text-accent-foreground transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {occasion.name}
                    </Link>
                  ))
                )}

                {/* Tags */}
                {dbProduct?.tags && dbProduct.tags.length > 0 && (
                  dbProduct.tags.slice(0, 3).map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/produtos?search=${encodeURIComponent(tag.name)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-xs font-medium text-muted-foreground transition-colors"
                    >
                      <Tag className="h-3 w-3" />
                      {tag.name}
                    </Link>
                  ))
                )}
              </div>

              {/* Price Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor unitário</p>
                  <p className="text-lg font-semibold text-primary">
                    R$ {product.price.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Compra mínima</p>
                  <p className="text-lg font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
                    {product.minQuantity} unidades
                  </p>
                </div>
              </div>

              {/* Total Price Section */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">Valor total</p>
                <p className="text-3xl font-bold text-foreground">
                  R$ {totalPrice.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ou {installments}x sem juros de R$ {installmentValue.toFixed(2).replace('.', ',')} no cartão
                </p>
              </div>

              {/* PIX Discount */}
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                  -{pixDiscountPercent}% no Pix
                </span>
                <span className="text-lg font-semibold text-green-600">
                  R$ {pixPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>

              {/* Production Time */}
              <div className="border-t border-border pt-4 mb-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="h-5 w-5" />
                  <span className="text-sm">Feito sob encomenda</span>
                </div>
                <p className="text-foreground">
                  Produto pronto em até <span className="font-semibold text-amber-600">{product.productionDays} dias úteis</span>
                </p>
              </div>

              {/* Description */}
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {product.description || `Lembrancinha especial com sabonete artesanal. Perfeito para lembrancinhas de maternidade, batizado e eventos especiais.`}
              </p>

              {/* Personalization Field - only show if enabled */}
              {dbProduct?.personalization_enabled !== false && (
                <div className="bg-card rounded-xl border border-border p-5 mb-6">
                  <h3 className="font-semibold text-foreground mb-3">
                    {dbProduct?.personalization_label || 'Personalização'}
                  </h3>
                  <Textarea
                    placeholder={dbProduct?.personalization_placeholder || 'Digite o nome, data ou mensagem para personalização...'}
                    value={personalization}
                    onChange={(e) => setPersonalization(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-foreground">Quantidade</span>
                  <span className="text-sm text-muted-foreground">(Mínimo: {product.minQuantity})</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
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
                        const next = Number.isFinite(parsed) && parsed >= product.minQuantity ? parsed : product.minQuantity;
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

              {/* Resumo rápido + CTA WhatsApp com qty/personalização selecionadas */}
              <QuickQuoteSummary
                minQuantity={product.minQuantity}
                productionDays={product.productionDays}
                quantity={quantity}
                personalization={personalization}
                onWhatsApp={() => openWhatsApp("quick_summary")}
                productSlug={product.slug}
                enabled={ctaConfig?.quickSummary?.enabled !== false}
                title={ctaConfig?.quickSummary?.title}
                minLabel={ctaConfig?.quickSummary?.minLabel}
                prazoLabel={ctaConfig?.quickSummary?.prazoLabel}
                shippingLabel={ctaConfig?.quickSummary?.shippingLabel}
                shippingValue={ctaConfig?.quickSummary?.shippingValue}
                ctaLabel={ctaConfig?.quickSummary?.ctaLabel}
              />

              {/* Note about shipping */}
              <div className="bg-primary-light/50 rounded-xl border border-primary/20 p-4 mb-6">
                <p className="text-sm text-foreground/80 text-center">
                  <span className="font-semibold text-primary">📦 Frete:</span> O valor do frete é calculado via WhatsApp.
                </p>
              </div>


              {/* Sprint 4 — CTA primário decidido por resolvePrimaryAction(product) */}
              {(() => {
                const action = resolvePrimaryAction(dbProduct);
                const isWaPrimary = action.primary === "whatsapp";
                const cartBtn = (primary: boolean) => (
                  <Button
                    size="lg"
                    className={`flex-1 rounded-lg py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all ${
                      addedToCart
                        ? "bg-green-500 hover:bg-green-600 text-white"
                        : primary
                          ? "bg-primary hover:bg-primary-dark text-primary-foreground"
                          : "bg-card border-2 border-primary text-primary hover:bg-primary/10"
                    }`}
                    variant={primary ? "default" : "outline"}
                    onClick={handleAddToCart}
                  >
                    {addedToCart ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Adicionado!
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        {primary ? "Adicionar ao Carrinho" : "Adicionar ao carrinho"}
                      </>
                    )}
                  </Button>
                );
                return (
                  <>
                    <div className="flex gap-3 mb-4">
                      {isWaPrimary ? null : cartBtn(true)}
                      {/* Favorite */}
                      <Button
                        variant="outline"
                        size="lg"
                        className="px-4"
                        onClick={() => setIsFavorite(!isFavorite)}
                      >
                        <Heart className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                      </Button>
                      {/* Share */}
                      <Button variant="outline" size="lg" className="px-4" onClick={handleShare}>
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Para WhatsApp-first (personalizado): carrinho aparece como secundário sutil */}
                    {isWaPrimary && (
                      <div className="mb-4">{cartBtn(false)}</div>
                    )}

                    {/* Go to Cart Button - Shows after adding to cart */}
                    {addedToCart && (
                      <Button
                        size="lg"
                        className="w-full bg-primary hover:bg-primary-dark text-primary-foreground rounded-lg py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all mb-4"
                        onClick={() => navigate("/carrinho")}
                      >
                        Finalizar Compra Agora
                        <ChevronRight className="h-5 w-5 ml-2" />
                      </Button>
                    )}
                  </>
                );
              })()}


              {/* Payment Methods */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3">Formas de pagamento:</p>
                <div className="flex flex-wrap gap-2">
                  {paymentConfig?.accepted_methods?.pix && (
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      PIX
                    </span>
                  )}
                  {paymentConfig?.accepted_methods?.credit_card && (
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      Cartão de Crédito
                    </span>
                  )}
                  {paymentConfig?.accepted_methods?.boleto && (
                    <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      Boleto Bancário
                    </span>
                  )}
                </div>
              </div>

              {/* Trust Badges - Horizontal */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="flex flex-col items-center text-center p-3 bg-card rounded-lg border border-border/50">
                  <Send className="h-5 w-5 text-primary mb-2" />
                  <span className="text-xs font-medium text-foreground">Envio todo Brasil</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-card rounded-lg border border-border/50">
                  <Shield className="h-5 w-5 text-primary mb-2" />
                  <span className="text-xs font-medium text-foreground">Hipoalergênico</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-card rounded-lg border border-border/50">
                  <Heart className="h-5 w-5 text-primary mb-2" />
                  <span className="text-xs font-medium text-foreground">100% Artesanal</span>
                </div>
              </div>

              {/* Tags Section */}
              {product.keywords && product.keywords.length > 0 && (
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

              {/* WhatsApp — CTA inteligente (mensagem enriquecida via buildWhatsAppMessage) */}
              {(() => {
                const { url } = buildWhatsAppMessage();
                return (
                  <div ref={ctaAnchorRef}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        openWhatsApp("product_page");
                      }}
                      className="flex items-center justify-center gap-3 p-4 mt-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-bold shadow-lg hover:shadow-green-200 transition-all duration-300 transform hover:-translate-y-1"
                    >
                      <MessageCircle className="h-6 w-6" />
                      Fazer Orçamento no WhatsApp
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>


          {/* Seções gerenciadas via /admin/pdp-sections (ordem + visibilidade) */}
          {(pdpSections ?? []).map((s) => {
            const renderer = pdpSectionRegistry[s.section_key];
            if (!renderer) return null;
            return renderer({ product, dbProduct, canonicalUrl });
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
              }
            )
              .filter((l) => !usedPaths.has(l.path))
              .slice(0, 8); // hard cap absoluto

            if (links.length < 3) return null;
            return (
              <div className="container mx-auto">
                <SemanticLinkingBlock title="Explore mais ideias relacionadas" links={links} />
              </div>
            );
          })()}
        </div>
      </main>

      <TrustBadges />
      <FAQSection />

      <Footer />
      <WhatsAppButton />
      <Chatbot />

      {/* Sticky CTA mobile — aparece quando o CTA principal sai do viewport */}
      <StickyAddToCart
        productName={product.name}
        productSlug={product.slug}
        price={`R$ ${product.price.toFixed(2).replace('.', ',')}`}
        isVisible={showStickyCta}
        onWhatsApp={() => openWhatsApp("sticky_cta")}
        onAddToCart={handleAddToCart}
        enabled={ctaConfig?.sticky?.enabled !== false}
        buttonLabel={ctaConfig?.sticky?.buttonLabel}
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

export default ProductPage;