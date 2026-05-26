import { Star } from "lucide-react";
import { useProductReviewStats } from "@/hooks/useProductReviews";
import { cn } from "@/lib/utils";

interface Props {
  productId?: string;
  /** id do alvo (default: product-reviews) — usado para scroll suave */
  targetId?: string;
  className?: string;
}

/**
 * Badge compacto de prova social acima da dobra (PDP).
 * - Exibe estrelas em tom âmbar + nota + nº de avaliações.
 * - Clique faz scroll suave até a seção completa de reviews.
 * - Não renderiza nada quando não há avaliações reais (evita ruído).
 */
const ProductRatingBadge = ({ productId, targetId = "product-reviews", className }: Props) => {
  const { data: stats } = useProductReviewStats(productId);

  const count = stats?.review_count ?? 0;
  const avg = stats?.avg_rating ? Number(stats.avg_rating) : 0;

  if (!productId || !count || !avg) return null;

  const handleClick = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Foco acessível na seção alvo após o scroll
    el.setAttribute("tabindex", "-1");
    (el as HTMLElement).focus({ preventScroll: true });
  };

  // 5 estrelas; preenche conforme a média (com fracionamento por máscara de largura).
  const fullPercent = Math.max(0, Math.min(100, (avg / 5) * 100));

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Ver ${count} ${count === 1 ? "avaliação" : "avaliações"} — média ${avg.toFixed(1)} de 5 estrelas`}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-sm transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
        className,
      )}
    >
      <span className="relative inline-flex" aria-hidden="true">
        {/* Camada base (vazias) */}
        <span className="inline-flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={`b-${i}`} className="h-4 w-4 text-amber-500/30" strokeWidth={1.5} />
          ))}
        </span>
        {/* Camada preenchida com clip por largura */}
        <span
          className="pointer-events-none absolute inset-y-0 left-0 inline-flex overflow-hidden"
          style={{ width: `${fullPercent}%` }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={`f-${i}`} className="h-4 w-4 fill-amber-500 text-amber-500" strokeWidth={1.5} />
          ))}
        </span>
      </span>
      <span className="tabular-nums font-medium text-foreground">{avg.toFixed(1)}</span>
      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
        ({count} {count === 1 ? "avaliação" : "avaliações"})
      </span>
    </button>
  );
};

export default ProductRatingBadge;
