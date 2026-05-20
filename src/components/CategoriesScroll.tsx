import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDbCategories } from "@/hooks/useProducts";
import { useAccessibleCarousel } from "@/hooks/useAccessibleCarousel";
import { usePauseAnimationsOffscreen } from "@/hooks/usePauseAnimationsOffscreen";
import { LucideIcon } from "@/components/LucideIcon";
import { LazyImage } from "@/components/LazyImage";
import { cn } from "@/lib/utils";

/** Lightweight static skeleton — shimmer is disabled on mobile via CSS. */
const ShimmerBlock = ({ className }: { className?: string }) => (
  <div className={cn("relative overflow-hidden bg-muted/70 skeleton-light", className)}>
    <div
      className="absolute inset-0 shimmer"
      style={{
        background:
          "linear-gradient(115deg, transparent 30%, hsl(var(--background) / 0.7) 50%, transparent 70%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s linear infinite",
      }}
      aria-hidden
    />
  </div>
);

const CategoriesScroll = () => {
  const { data: categories, isLoading } = useDbCategories({ publicOnly: true });
  const visible = (categories ?? []).filter((c) => c.is_indexed !== false);

  const {
    scrollerRef, itemsRef, activeIdx, canLeft, canRight, isDragging,
    scrollBy, onKeyDown, pointerHandlers,
  } = useAccessibleCarousel({
    storageKey: "categoriesScroll:left",
    total: visible.length,
    isLoading,
    haptic: true,
  });

  // Pause continuous animations when the carousel leaves the viewport.
  const sectionRef = usePauseAnimationsOffscreen<HTMLElement>();

  const activeName = visible[activeIdx]?.name ?? "";
  const total = visible.length;

  return (
    <section ref={sectionRef} className="py-10 md:py-16 bg-background" aria-label="Categorias">
      <div className="container mx-auto px-4">
        <h1 className="sr-only">Empório LeleCute - Lembrancinhas Artesanais Personalizadas</h1>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {activeName ? `Categoria em foco: ${activeName}. Item ${activeIdx + 1} de ${total}.` : ""}
        </div>

        <div className="relative group">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 md:w-12 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 md:w-12 bg-gradient-to-l from-background to-transparent z-10" />

          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Categoria anterior"
            disabled={!canLeft}
            className={cn(
              "hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/95 backdrop-blur shadow-medium items-center justify-center text-foreground transition-all",
              "hover:bg-primary hover:text-primary-foreground hover:scale-110",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary",
              !canLeft && "!opacity-0 pointer-events-none"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Próxima categoria"
            disabled={!canRight}
            className={cn(
              "hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/95 backdrop-blur shadow-medium items-center justify-center text-foreground transition-all",
              "hover:bg-primary hover:text-primary-foreground hover:scale-110",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary",
              !canRight && "!opacity-0 pointer-events-none"
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div
            ref={scrollerRef}
            {...pointerHandlers}
            onKeyDown={onKeyDown}
            role="listbox"
            tabIndex={0}
            data-testid="categories-carousel"
            aria-label="Lista de categorias — use as setas do teclado para navegar"
            aria-activedescendant={visible[activeIdx]?.id ? `cat-item-${visible[activeIdx].id}` : undefined}
            className={cn(
              "flex gap-3 md:gap-7 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 md:pb-4 px-1 md:px-2",
              "justify-start md:justify-center",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "[-webkit-overflow-scrolling:touch] [touch-action:pan-x] [overscroll-behavior-x:contain]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl",
              isDragging ? "cursor-grabbing select-none" : "md:cursor-grab"
            )}
          >
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 shrink-0 snap-start">
                    <ShimmerBlock className="w-16 h-16 md:w-32 md:h-32 rounded-full" />
                    <ShimmerBlock className="w-12 h-3 rounded-full" />
                  </div>
                ))
              : visible.map((category, i) => {
                  const isActive = i === activeIdx;
                  return (
                    <Link
                      key={category.id}
                      id={`cat-item-${category.id}`}
                      ref={(el) => { itemsRef.current[i] = el; }}
                      to={`/categoria/${category.slug}`}
                      role="option"
                      data-testid="category-item"
                      data-active={isActive ? "true" : "false"}
                      aria-selected={isActive}
                      aria-label={`${category.name} — categoria ${i + 1} de ${total}${isActive ? ", em foco" : ""}`}
                      aria-current={isActive ? "true" : undefined}
                      aria-setsize={total}
                      aria-posinset={i + 1}
                      tabIndex={isActive ? 0 : -1}
                      draggable={false}
                      className={cn(
                        "group/item flex flex-col items-center gap-1.5 md:gap-3 shrink-0 snap-start outline-none",
                        "focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:rounded-2xl",
                        "animate-fade-in"
                      )}
                      style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
                    >
                      <div
                        className={cn(
                          "relative w-16 h-16 md:w-32 md:h-32 transition-transform duration-500 animate-pingpong",
                          isActive && "scale-105 md:scale-110"
                        )}
                        style={{ animationDelay: `${(i % 5) * 0.6}s`, animationDuration: `${7 + (i % 4) * 1.5}s` }}
                      >
                        {/* Static gradient ring — no spin (removed animate-spin-slow). */}
                        <div
                          className={cn(
                            "absolute -inset-[2px] rounded-full transition-opacity duration-500",
                            isActive ? "opacity-100" : "opacity-60 group-hover/item:opacity-100"
                          )}
                          style={{
                            background:
                              "conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary-light, var(--primary))), hsl(var(--primary)))",
                          }}
                          aria-hidden
                        />

                        <div className="relative w-full h-full rounded-full bg-gradient-to-tr from-primary via-primary-light to-accent p-[2px] md:p-[3px] transition-transform duration-300 group-hover/item:scale-105">
                          <div className="w-full h-full rounded-full bg-background p-0.5 md:p-1">
                            <div className="relative w-full h-full rounded-full overflow-hidden bg-muted">
                              {category.image_url ? (
                                <LazyImage
                                  src={category.image_url}
                                  alt={category.name}
                                  className="transition-transform duration-500 group-hover/item:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/20">
                                  <LucideIcon
                                    name={category.icon}
                                    className="w-6 h-6 md:w-10 md:h-10 text-primary transition-transform duration-300 group-hover/item:scale-105"
                                  />
                                </div>
                              )}
                              {/* Subtle hover overlay (removed continuous shimmer). */}
                              <div className="absolute inset-0 bg-foreground/0 group-hover/item:bg-foreground/10 transition-colors duration-300" />
                            </div>
                          </div>
                        </div>

                        {category.icon && category.image_url && (
                          <div className="hidden md:flex absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-background shadow-medium items-center justify-center ring-2 ring-primary/20 transition-transform duration-300 group-hover/item:scale-105">
                            <LucideIcon name={category.icon} className="w-4 h-4 text-primary" />
                          </div>
                        )}

                        {/* Soft static halo — only on active item, no pulse. */}
                        {isActive && (
                          <div
                            className="absolute inset-0 rounded-full bg-primary/25 blur-2xl -z-10 opacity-50"
                            aria-hidden
                          />
                        )}
                      </div>

                      <span
                        className={cn(
                          "text-[10px] md:text-sm font-medium text-center max-w-[5rem] md:max-w-[7rem] truncate transition-colors",
                          isActive ? "text-primary" : "text-foreground group-hover/item:text-primary"
                        )}
                      >
                        {category.name}
                      </span>
                      <span
                        className={cn(
                          "block h-0.5 rounded-full bg-primary transition-all duration-300",
                          isActive ? "w-6 opacity-100" : "w-0 opacity-0"
                        )}
                        aria-hidden
                      />
                    </Link>
                  );
                })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoriesScroll;
