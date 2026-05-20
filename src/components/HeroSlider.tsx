import { useState, useEffect, useLayoutEffect, useRef, useCallback, type TouchEvent } from "react";
import { Heart, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

import TrustBadges from "@/components/TrustBadges";
import { Button } from "@/components/ui/button";
import { useHeroSlides, type HeroSlide } from "@/hooks/useHeroSlides";
import sabonetesImg from "@/assets/category-sabonetes.webp";
import lembrancinhasImg from "@/assets/category-lembrancinhas.webp";
import kitsImg from "@/assets/category-kits.webp";

// ---------------------------------------------------------------------------
// Fallback slides — usados apenas quando não há slides cadastrados no banco
// ---------------------------------------------------------------------------
const fallbackSlides: HeroSlide[] = [
  {
    id: 'f1',
    display_mode: 'text_image',
    tagline: "Para qualquer idade e ocasião",
    title: "Lembrancinhas de qualidade premium",
    subtitle: "Cada produto é feito sob encomenda com ingredientes naturais e embalagem especial.",
    image_url: sabonetesImg,
    image_mobile_url: null,
    image_desktop_url: null,
    image_alt: "Sabonetes artesanais personalizados Empório LeleCute",
    cta_label: null,
    cta_url: null,
    position: 0,
    is_visible: true,
  },
  {
    id: 'f2',
    display_mode: 'text_image',
    tagline: "Ateliê Criativo",
    title: "Lembrancinhas Artesanais que Perfumam seus Momentos",
    subtitle: "Sabonetes artesanais, velas perfumadas e presentes personalizados feitos com amor e carinho.",
    image_url: lembrancinhasImg,
    image_mobile_url: null,
    image_desktop_url: null,
    image_alt: "Lembrancinhas artesanais personalizadas Empório LeleCute",
    cta_label: null,
    cta_url: null,
    position: 1,
    is_visible: true,
  },
  {
    id: 'f3',
    display_mode: 'text_image',
    tagline: "100% Personalizado",
    title: "Sua celebração com um toque especial",
    subtitle: "Cores, aromas, embalagens e tags personalizadas para seu evento perfeito.",
    image_url: kitsImg,
    image_mobile_url: null,
    image_desktop_url: null,
    image_alt: "Kits de lembrancinhas personalizados Empório LeleCute",
    cta_label: null,
    cta_url: null,
    position: 2,
    is_visible: true,
  },
];

// Resolve asset paths that may have been stored as dev-time paths
const fallbackImageMap: Record<string, string> = {
  '/src/assets/category-sabonetes.webp': sabonetesImg,
  '/src/assets/category-lembrancinhas.webp': lembrancinhasImg,
  '/src/assets/category-kits.webp': kitsImg,
};

const resolveImageSrc = (src?: string | null) =>
  (src && fallbackImageMap[src]) || src || "";

const resolveSlideDisplay = (slide: HeroSlide, isMobile: boolean) => {
  const mobileSrc = resolveImageSrc(slide.image_mobile_url);
  const desktopSrc = resolveImageSrc(slide.image_desktop_url);

  if (isMobile && mobileSrc) {
    return { mode: "banner_mobile" as const, imgSrc: mobileSrc };
  }

  if (!isMobile && desktopSrc) {
    return { mode: "banner_desktop" as const, imgSrc: desktopSrc };
  }

  return {
    mode: "text_image" as const,
    imgSrc: resolveImageSrc(slide.image_url) || sabonetesImg,
  };
};

// ---------------------------------------------------------------------------
// Sub-components for each display mode
// ---------------------------------------------------------------------------

/** Modo 1 — texto à esquerda + imagem quadrada à direita */
function SlideTextImage({
  slide,
  isPriority,
  imgSrc,
}: {
  slide: HeroSlide;
  isPriority: boolean;
  imgSrc: string;
}) {
  const alt = slide.image_alt || slide.title;

  return (
    <div className="container mx-auto px-4 relative z-10 py-10 md:py-16 lg:py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Text column */}
        <div className="max-w-xl">
          <div className="animate-fade-in">
            {slide.tagline && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-light rounded-full mb-6">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">{slide.tagline}</span>
              </div>
            )}
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-6 leading-tight">
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                {slide.subtitle}
              </p>
            )}
            {slide.cta_label && slide.cta_url && (
              <a
                href={slide.cta_url}
                className="inline-flex items-center gap-2 mb-8 text-sm text-foreground border-b border-foreground/30 hover:border-foreground pb-1 transition-colors"
              >
                {slide.cta_label}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
            )}
          </div>
        </div>

        {/* Image column */}
        <div className="relative flex justify-center items-center">
          <div className="absolute -bottom-4 right-8 lg:right-16 text-primary z-10">
            <Heart className="h-10 w-10 fill-primary/20 animate-float" />
          </div>
          <div className="relative rounded-3xl overflow-hidden shadow-2xl animate-scale-in max-w-md lg:max-w-lg w-full">
            <img
              src={imgSrc}
              alt={alt}
              width={600}
              height={600}
              loading={isPriority ? "eager" : "lazy"}
              // @ts-expect-error fetchpriority is valid HTML
              fetchpriority={isPriority ? "high" : "auto"}
              decoding="async"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modo 2 — banner full-width, visível apenas em mobile/tablet (< md) */
function SlideBannerMobile({
  slide,
  isPriority,
  imgSrc,
}: {
  slide: HeroSlide;
  isPriority: boolean;
  imgSrc: string;
}) {
  const alt = slide.image_alt || slide.title;

  if (!imgSrc) return null;

  return (
    // hidden on md+ (desktop)
    <div className="block md:hidden w-full animate-fade-in pt-2">
      <img
        src={imgSrc}
        alt={alt}
        loading={isPriority ? "eager" : "lazy"}
        // @ts-expect-error fetchpriority is valid HTML
        fetchpriority={isPriority ? "high" : "auto"}
        decoding="async"
        className="w-full h-auto block"
        style={{ maxWidth: "100%", display: "block" }}
      />
    </div>
  );
}

/** Modo 3 — banner full-width, visível apenas em desktop (≥ md) */
function SlideBannerDesktop({
  slide,
  isPriority,
  imgSrc,
}: {
  slide: HeroSlide;
  isPriority: boolean;
  imgSrc: string;
}) {
  const alt = slide.image_alt || slide.title;

  if (!imgSrc) return null;

  return (
    // hidden on mobile (< md)
    <div className="hidden md:block w-full animate-fade-in md:pt-3 lg:pt-16 xl:pt-20">
      <img
        src={imgSrc}
        alt={alt}
        loading={isPriority ? "eager" : "lazy"}
        // @ts-expect-error fetchpriority is valid HTML
        fetchpriority={isPriority ? "high" : "auto"}
        decoding="async"
        className="w-full h-auto block"
        style={{ maxWidth: "100%", display: "block" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main HeroSlider
// ---------------------------------------------------------------------------

// Renders the right variant for a given slide (responsive via CSS).
function SlideRenderer({ slide, isPriority }: { slide: HeroSlide; isPriority: boolean }) {
  const mobileBannerSrc = resolveImageSrc(slide.image_mobile_url);
  const desktopBannerSrc = resolveImageSrc(slide.image_desktop_url);
  const fallbackSrc = resolveImageSrc(slide.image_url) || sabonetesImg;
  const hasAnyBanner = Boolean(mobileBannerSrc || desktopBannerSrc);

  if (!hasAnyBanner) {
    return (
      <div className="pt-28 md:pt-32 pb-10 md:pb-14">
        <SlideTextImage slide={slide} isPriority={isPriority} imgSrc={fallbackSrc} />
      </div>
    );
  }

  return (
    <>
      {mobileBannerSrc ? (
        <SlideBannerMobile slide={slide} isPriority={isPriority} imgSrc={mobileBannerSrc} />
      ) : (
        <div className="block md:hidden pt-28 pb-10">
          <SlideTextImage slide={slide} isPriority={isPriority} imgSrc={fallbackSrc} />
        </div>
      )}
      {desktopBannerSrc ? (
        <SlideBannerDesktop slide={slide} isPriority={isPriority} imgSrc={desktopBannerSrc} />
      ) : (
        <div className="hidden md:block pt-32 pb-10 md:pb-14">
          <SlideTextImage slide={slide} isPriority={isPriority} imgSrc={fallbackSrc} />
        </div>
      )}
    </>
  );
}

const HeroSlider = () => {
  const { data: dbSlides } = useHeroSlides();
  const slides: HeroSlide[] =
    dbSlides && dbSlides.length > 0 ? dbSlides : fallbackSlides;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [stageHeight, setStageHeight] = useState<number | "auto">("auto");

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (currentSlide >= slides.length) setCurrentSlide(0);
  }, [slides.length, currentSlide]);

  // Trigger cross-fade: track previous slide, then clear after transition.
  // In reduced-motion mode, swap instantly (no previous overlay).
  const goTo = useCallback(
    (next: number) => {
      setCurrentSlide((cur) => {
        if (next === cur) return cur;
        if (!reducedMotion) setPrevSlide(cur);
        return next;
      });
    },
    [reducedMotion]
  );

  useEffect(() => {
    if (prevSlide === null) return;
    const t = setTimeout(() => setPrevSlide(null), 720);
    return () => clearTimeout(t);
  }, [prevSlide, currentSlide]);

  // Animate stage height to match the active slide.
  // Stable observer (deps []), rAF-coalesced, no-op when value unchanged.
  // Skipped entirely in reduced-motion mode (height: auto).
  useLayoutEffect(() => {
    if (reducedMotion) {
      setStageHeight("auto");
      return;
    }
    const el = activeRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = Math.round(el.offsetHeight);
        if (h < 1) return;
        setStageHeight((prev) => (typeof prev === "number" && Math.abs(prev - h) < 1 ? prev : h));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [currentSlide, reducedMotion]);

  const slide = slides[currentSlide] ?? slides[0];
  if (!slide) return null;
  const previous = !reducedMotion && prevSlide !== null ? slides[prevSlide] : null;

  const nextSlideFn = useCallback(
    () => goTo((currentSlide + 1) % slides.length),
    [goTo, currentSlide, slides.length]
  );
  const prevSlideFn = useCallback(
    () => goTo((currentSlide - 1 + slides.length) % slides.length),
    [goTo, currentSlide, slides.length]
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || (typeof window !== "undefined" && window.innerWidth >= 768)) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    if (deltaX < 0) nextSlideFn();
    else prevSlideFn();
  }, [nextSlideFn, prevSlideFn]);

  const isPriority = currentSlide === 0;
  const hasAnyBanner = Boolean(
    resolveImageSrc(slide.image_mobile_url) || resolveImageSrc(slide.image_desktop_url)
  );
  const isBanner = hasAnyBanner;

  return (
    <section
      id="inicio"
      className="relative flex flex-col justify-center overflow-hidden bg-background"
      style={isBanner ? { paddingTop: "var(--header-height, 80px)" } : undefined}
      aria-label="Seção principal - Empório LeleCute"
    >
      {/* Decorative background — only for text_image mode */}
      {!hasAnyBanner && (
        <>
          <div className="absolute inset-0 bg-dotted-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-32 right-[15%] text-amber-400 pointer-events-none">
            <Sparkles className="h-8 w-8 animate-pulse-slow" fill="currentColor" />
          </div>
        </>
      )}

      {/* Cross-fade stage: previous + current slide stacked, opacity transition */}
      <div
        ref={stageRef}
        className="relative w-full touch-pan-y motion-safe:transition-[height] motion-safe:duration-700 motion-safe:ease-in-out"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          height: stageHeight === "auto" ? undefined : stageHeight,
          minHeight: hasAnyBanner ? undefined : 280,
        }}
      >
        {previous && (
          <div
            key={`prev-${previous.id}-${prevSlide}`}
            className="absolute inset-0 w-full hero-fade-out motion-reduce:hidden pointer-events-none"
            aria-hidden="true"
          >
            <SlideRenderer slide={previous} isPriority={false} />
          </div>
        )}
        <div
          ref={activeRef}
          key={`active-${slide.id}`}
          className={
            reducedMotion
              ? "relative w-full"
              : "relative w-full opacity-0 hero-fade-in motion-reduce:opacity-100"
          }
        >
          <SlideRenderer slide={slide} isPriority={isPriority} />
        </div>
      </div>

      {/* Navigation dots + arrows — shown when there are multiple slides */}
      {slides.length > 1 && (
        <>
          {/* Dots */}
          <div
            className={`flex items-center justify-center gap-2 md:gap-3 ${
              isBanner ? "pt-1.5 pb-0 md:pt-3 md:pb-2" : "pb-3"
            } relative z-10`}
          >
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full transition-all duration-500 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`Slide ${index + 1}`}
              >
                <span className="sr-only">Slide {index + 1}</span>
                <span
                  className={`block h-2.5 rounded-full transition-all duration-500 ease-in-out ${
                    index === currentSlide
                      ? "w-8 bg-primary md:w-10"
                      : "w-2.5 bg-primary/30 hover:bg-primary/50 md:w-3"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Prev / Next arrows */}
          <button
            onClick={prevSlideFn}
            className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 bg-transparent md:bg-background/80 md:backdrop-blur-sm md:shadow-md rounded-full flex items-center justify-center hover:bg-primary/10 md:hover:bg-primary hover:text-primary md:hover:text-primary-foreground active:scale-95 transition-all"
            aria-label="Slide anterior"
          >
            <span className="flex h-8 w-8 md:h-auto md:w-auto items-center justify-center rounded-full bg-background/85 shadow-sm md:bg-transparent md:shadow-none">
              <ChevronLeft className="h-4 w-4 md:h-6 md:w-6" />
            </span>
          </button>
          <button
            onClick={nextSlideFn}
            className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 bg-transparent md:bg-background/80 md:backdrop-blur-sm md:shadow-md rounded-full flex items-center justify-center hover:bg-primary/10 md:hover:bg-primary hover:text-primary md:hover:text-primary-foreground active:scale-95 transition-all"
            aria-label="Próximo slide"
          >
            <span className="flex h-8 w-8 md:h-auto md:w-auto items-center justify-center rounded-full bg-background/85 shadow-sm md:bg-transparent md:shadow-none">
              <ChevronRight className="h-4 w-4 md:h-6 md:w-6" />
            </span>
          </button>
        </>
      )}

      <TrustBadges className="mt-1 md:mt-4" />
    </section>
  );
};

export default HeroSlider;
