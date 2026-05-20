import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { optimizeImage } from "@/lib/image";
import { BlurImage } from "@/components/BlurImage";

interface ProductGalleryProps {
  images: string[];
  productName: string;
  badge?: string;
  layout?: 'horizontal' | 'vertical';
}

const ProductGallery = ({ images, productName, badge, layout = 'vertical' }: ProductGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Tira horizontal de miniaturas — refs e estado de bordas
  const thumbsRef = useRef<HTMLDivElement>(null);
  const thumbItemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateThumbEdges = useCallback(() => {
    const el = thumbsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Vibração tátil sutil ao trocar de slide (mobile, quando disponível)
  const hapticTick = useCallback(() => {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
    }
    try { navigator.vibrate?.(8); } catch { /* noop */ }
  }, []);

  const goToPrevious = () => {
    hapticTick();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    hapticTick();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex((prev) => {
      if (prev !== index) hapticTick();
      return index;
    });
  };

  // Touch handlers para swipe — discriminam intenção horizontal vs scroll vertical,
  // sem bloquear a rolagem da página.
  const touchAxisRef = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided');
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchAxisRef.current = 'undecided';
    setTouchStart(e.touches[0].clientX);
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    if (touchAxisRef.current !== 'undecided') {
      if (touchAxisRef.current === 'horizontal' && e.cancelable) {
        e.preventDefault(); // mantém o swipe sem permitir scroll horizontal acidental
      }
      return;
    }
    const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartYRef.current);
    if (dx < 8 && dy < 8) return;
    touchAxisRef.current = dx > dy ? 'horizontal' : 'vertical';
    if (touchAxisRef.current === 'horizontal' && e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) {
      setIsPaused(false);
      touchAxisRef.current = 'undecided';
      return;
    }

    const wasHorizontal = touchAxisRef.current === 'horizontal';
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (wasHorizontal && Math.abs(diff) > 40) {
      if (diff > 0) goToNext();
      else goToPrevious();
    }
    setTouchStart(null);
    touchAxisRef.current = 'undecided';
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    window.setTimeout(() => setIsPaused(false), 1500);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') setIsZoomed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autoplay suave (fade já aplicado via transition-opacity).
  // Pausa em: zoom aberto, hover/touch/focus, aba oculta, prefers-reduced-motion, <2 imagens.
  useEffect(() => {
    if (images.length < 2 || isZoomed || isPaused) return;
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => window.clearInterval(id);
  }, [images.length, isZoomed, isPaused]);

  // Pausa autoplay quando a aba fica oculta
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => setIsPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Bordas da tira de thumbs (mostra/oculta setas)
  useEffect(() => {
    if (layout !== 'horizontal') return;
    const el = thumbsRef.current;
    if (!el) return;
    updateThumbEdges();
    el.addEventListener('scroll', updateThumbEdges, { passive: true });
    window.addEventListener('resize', updateThumbEdges);
    return () => {
      el.removeEventListener('scroll', updateThumbEdges);
      window.removeEventListener('resize', updateThumbEdges);
    };
  }, [layout, images.length, updateThumbEdges]);

  // Centraliza a thumb ativa suavemente ao trocar de slide
  useEffect(() => {
    if (layout !== 'horizontal') return;
    const el = thumbsRef.current;
    const node = thumbItemsRef.current[currentIndex];
    if (!el || !node) return;
    const target = node.offsetLeft - el.clientWidth / 2 + node.offsetWidth / 2;
    el.scrollTo({ left: target, behavior: 'smooth' });
  }, [currentIndex, layout]);

  const scrollThumbs = (dir: -1 | 1) => {
    const el = thumbsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.7, 240), behavior: 'smooth' });
  };



  return (
    <div className={cn(
      "relative w-full max-w-full min-w-0 overflow-hidden transition-all duration-500",
      isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      layout === 'vertical' && "flex gap-4"
    )}>
      {/* Vertical Thumbnails - Left Side */}
      {layout === 'vertical' && images.length > 1 && (
        <div className="hidden md:flex flex-col gap-3 w-20 shrink-0">
          {images.slice(0, 5).map((image, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-20 h-20 rounded-lg overflow-hidden transition-all duration-300 relative border-2",
                index === currentIndex
                  ? "border-primary shadow-md"
                  : "border-transparent opacity-70 hover:opacity-100 hover:border-muted-foreground/30"
              )}
            >
              <img
                src={optimizeImage(image, { width: 160, resize: "contain" })}
                alt={`${productName} - Miniatura ${index + 1}`}
                className="w-full h-full object-contain bg-muted p-1"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            </button>
          ))}
          {images.length > 5 && (
            <button
              onClick={() => setIsZoomed(true)}
              className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              +{images.length - 5}
            </button>
          )}
        </div>
      )}

      {/* Main Image Container */}
      <div className="flex-1 min-w-0 max-w-full">
        <div
          className="relative aspect-square w-full max-w-full rounded-xl sm:rounded-2xl overflow-hidden bg-muted shadow-card sm:shadow-lg group cursor-pointer touch-pan-y select-none"
          data-testid="pdp-gallery-main"
          onClick={() => setIsZoomed(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={() => setIsPaused(false)}
          role="region"
          aria-roledescription="carrossel"
          aria-label={`Galeria de imagens de ${productName}`}
        >
          {/* Image with fade transition */}
          <div className="relative w-full h-full">
            {images.map((image, index) => (
              <div
                key={index}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none",
                  index === currentIndex ? "opacity-100" : "opacity-0"
                )}
              >
                <BlurImage
                  src={image}
                  alt={`${productName} - Imagem ${index + 1}`}
                  width={800}
                  resize="contain"
                  responsiveWidths={[400, 600, 800, 1200]}
                  priority={index === 0}
                  sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1024px) 100vw, 600px"
                  wrapperClassName="w-full h-full"
                  className="object-contain transition-transform duration-700 ease-out sm:group-hover:scale-105"
                />
              </div>
            ))}
          </div>

          {/* Zoom Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(true);
            }}
            className="absolute bottom-4 right-4 hidden sm:flex p-2.5 bg-background/90 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-background hover:scale-110 active:scale-95 shadow-md"
            aria-label="Ampliar imagem"
          >
            <ZoomIn className="h-5 w-5 text-foreground" />
          </button>

          {/* Navigation Arrows — visíveis em mobile, hover-reveal em desktop. Tap target ≥44px (min-h/min-w-11). */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-11 min-w-11 sm:p-2.5 bg-background/90 backdrop-blur-sm rounded-full opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 hover:bg-background hover:scale-110 active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:opacity-100"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-11 min-w-11 sm:p-2.5 bg-background/90 backdrop-blur-sm rounded-full opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 hover:bg-background hover:scale-110 active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:opacity-100"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </button>
            </>
          )}


          {/* Image Counter (mobile) — canto inferior direito, fora da área do favorito */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 md:hidden px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-[11px] font-medium text-foreground/80 pointer-events-none shadow-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Badge */}
          {badge && (
            <span className="absolute top-4 left-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold shadow-lg">
              {badge}
            </span>
          )}

          {/* Dots Navigation (mobile) — minimal, sem pill, tap target ≥44px via wrapper invisível */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden" role="tablist" aria-label="Selecionar imagem">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(index);
                  }}
                  role="tab"
                  aria-selected={index === currentIndex}
                  aria-label={`Ver imagem ${index + 1} de ${images.length}`}
                  className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block h-1.5 rounded-full transition-all duration-500 ease-out",
                      index === currentIndex
                        ? "bg-foreground/70 w-4"
                        : "bg-foreground/25 w-1.5"
                    )}
                  />
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Horizontal Thumbnails - Below (for horizontal layout) */}
        {layout === 'horizontal' && images.length > 1 && (
          <div className="relative mt-3 sm:mt-4">
            {/* Edge fade masks (somem suavemente quando não há mais conteúdo no lado) */}
            <div
              className={cn(
                "pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300",
                canScrollLeft ? "opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            />
            <div
              className={cn(
                "pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300",
                canScrollRight ? "opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            />

            {/* Mini-seta esquerda — só aparece se houver conteúdo à esquerda */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollThumbs(-1)}
                aria-label="Rolar miniaturas para a esquerda"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm text-foreground/70 shadow-sm hover:text-foreground hover:bg-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Mini-seta direita — só aparece se houver conteúdo à direita */}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollThumbs(1)}
                aria-label="Rolar miniaturas para a direita"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm text-foreground/70 shadow-sm hover:text-foreground hover:bg-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            <div
              ref={thumbsRef}
              role="tablist"
              aria-label="Miniaturas do produto"
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  const next = Math.min(currentIndex + 1, images.length - 1);
                  goToSlide(next);
                  thumbItemsRef.current[next]?.focus({ preventScroll: true });
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prev = Math.max(currentIndex - 1, 0);
                  goToSlide(prev);
                  thumbItemsRef.current[prev]?.focus({ preventScroll: true });
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  goToSlide(0);
                  thumbItemsRef.current[0]?.focus({ preventScroll: true });
                } else if (e.key === 'End') {
                  e.preventDefault();
                  goToSlide(images.length - 1);
                  thumbItemsRef.current[images.length - 1]?.focus({ preventScroll: true });
                }
              }}
              className="flex w-full max-w-full gap-4 sm:gap-5 overflow-x-auto overscroll-x-contain pb-3 px-8 scrollbar-hide snap-x snap-mandatory scroll-px-8 touch-pan-x"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {images.map((image, index) => {
                const isActive = index === currentIndex;
                return (
                  <button
                    key={index}
                    ref={(el) => { thumbItemsRef.current[index] = el; }}
                    onClick={() => goToSlide(index)}
                    aria-label={`Ver imagem ${index + 1} de ${images.length}`}
                    aria-current={isActive ? "true" : undefined}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className="group flex-shrink-0 flex flex-col items-center snap-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                  >
                    <div
                      className={cn(
                        "w-14 h-14 sm:w-16 sm:h-16 overflow-hidden rounded-sm transition-opacity duration-500 ease-out",
                        isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"
                      )}
                    >
                      <img
                        src={optimizeImage(image, { width: 160, resize: "contain" })}
                        alt=""
                        className="w-full h-full object-contain bg-muted/30 pointer-events-none"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                    </div>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-2 h-px rounded-full transition-all duration-500 ease-out",
                        isActive ? "w-5 bg-primary/80" : "w-5 bg-transparent"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Zoom Dialog - Fullscreen Gallery */}
      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-none overflow-hidden">
          <div className="relative h-full flex flex-col">
            {/* Close Button */}
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 z-50 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image Counter */}
            <div className="absolute top-4 left-4 z-50 px-3 py-1.5 bg-background/80 rounded-full text-sm font-medium">
              {currentIndex + 1} / {images.length}
            </div>

            {/* Main Zoomed Image */}
            <div 
              className="flex-1 flex items-center justify-center p-3 sm:p-8 overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={optimizeImage(images[currentIndex], { width: 1600, quality: 85, resize: "contain" })}
                alt={`${productName} - Imagem ampliada`}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-background/90 rounded-full hover:bg-background hover:scale-110 active:scale-95 transition-all duration-300 shadow-lg"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-background/90 rounded-full hover:bg-background hover:scale-110 active:scale-95 transition-all duration-300 shadow-lg"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex max-w-full justify-start sm:justify-center gap-2 p-4 bg-background/50 overflow-x-auto overscroll-x-contain">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={cn(
                      "w-16 h-16 rounded-lg overflow-hidden transition-opacity duration-300 bg-muted",
                      index === currentIndex
                        ? "ring-2 ring-primary opacity-100"
                        : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <img
                      src={optimizeImage(image, { width: 128, resize: "contain" })}
                      alt={`Miniatura ${index + 1}`}
                      className="w-full h-full object-contain bg-muted p-1"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductGallery;