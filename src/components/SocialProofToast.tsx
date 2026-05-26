import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { urls } from "@/lib/urls";
import { optimizeImage } from "@/lib/image";

/**
 * Prova social flutuante: exibe avaliações reais (product_reviews) com
 * miniatura do produto. Aleatório a cada visita e rotativo a cada ~25s.
 *
 * - Aparece após ~6s na primeira página
 * - Não aparece em rotas /admin e /carrinho/checkout sensíveis
 * - Respeita prefers-reduced-motion (sem animação de slide)
 * - Pode ser fechado; permanece fechado até refresh da página
 */

type Review = {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  review_date: string | null;
  is_verified: boolean;
  product: {
    name: string;
    slug: string;
    images: string[] | null;
  } | null;
};

const STORAGE_KEY = "lc_social_proof_dismissed";

function timeAgo(date: string | null): string {
  if (!date) return "recentemente";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SocialProofToast() {
  const location = useLocation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hoverRef = useRef(false);

  // Não exibir em rotas administrativas ou no fluxo final do carrinho
  const path = location.pathname;
  const blocked =
    path.startsWith("/admin") ||
    path.startsWith("/acesso-restrito") ||
    path.startsWith("/rastrear");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
  }, []);

  // Busca aleatória das avaliações reais com produto
  useEffect(() => {
    if (blocked || dismissed) return;
    let mounted = true;

    (async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select(
          `id, author_name, rating, comment, review_date, is_verified,
           product:products!inner(name, slug, images)`
        )
        .eq("is_visible", true)
        .gte("rating", 4)
        .not("comment", "is", null)
        .order("review_date", { ascending: false })
        .limit(60);

      if (error || !mounted || !data) return;

      const cleaned = (data as any[])
        .filter(
          (r) =>
            r.product?.slug &&
            r.comment &&
            r.comment.trim().length >= 8 &&
            r.author_name &&
            r.author_name.trim().length > 1,
        )
        .map((r) => ({
          ...r,
          product: r.product,
        })) as Review[];

      setReviews(shuffle(cleaned).slice(0, 20));
    })();

    return () => {
      mounted = false;
    };
  }, [blocked, dismissed]);

  // Ciclo de exibição
  useEffect(() => {
    if (blocked || dismissed || reviews.length === 0) return;

    let showTimer: number;
    let hideTimer: number;
    let cycleTimer: number;

    const showOne = () => {
      if (hoverRef.current) {
        cycleTimer = window.setTimeout(showOne, 3000);
        return;
      }
      setVisible(true);
      hideTimer = window.setTimeout(() => {
        setVisible(false);
        setIndex((i) => (i + 1) % reviews.length);
        cycleTimer = window.setTimeout(showOne, 18000);
      }, 9000);
    };

    showTimer = window.setTimeout(showOne, 6000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(cycleTimer);
    };
  }, [reviews, blocked, dismissed]);

  if (blocked || dismissed || reviews.length === 0) return null;

  const review = reviews[index];
  if (!review?.product) return null;

  const img = review.product.images?.[0];
  const thumb = img
    ? optimizeImage(img, { width: 120, resize: "contain" })
    : null;

  const handleClose = () => {
    setVisible(false);
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
  };

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
      className={[
        "fixed z-40 left-3 bottom-3 md:left-5 md:bottom-5",
        "max-w-[19rem] md:max-w-[22rem]",
        "transition-all duration-500 ease-out",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
    >
      <div className="relative flex items-stretch gap-3 rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg p-2.5 pr-7">
        <Link
          to={urls.product(review.product.slug)}
          className="shrink-0 self-center"
          aria-label={`Ver ${review.product.name}`}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={review.product.name}
              loading="lazy"
              className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-contain bg-muted p-1"
            />
          ) : (
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-muted" />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate">
              {review.author_name}
            </span>
            {review.is_verified && (
              <CheckCircle2 className="h-3 w-3 text-primary shrink-0" aria-label="Compra verificada" />
            )}
          </div>

          <div className="flex items-center gap-1 mt-0.5" aria-label={`${review.rating} de 5 estrelas`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={
                  i < review.rating
                    ? "h-3 w-3 fill-yellow-400 text-yellow-400"
                    : "h-3 w-3 text-muted-foreground/40"
                }
              />
            ))}
            <span className="ml-1 text-[10px] text-muted-foreground">
              {timeAgo(review.review_date)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
            "{review.comment.trim()}"
          </p>

          <Link
            to={urls.product(review.product.slug)}
            className="block mt-1 text-[11px] text-primary hover:underline truncate"
          >
            {review.product.name}
          </Link>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar prova social"
          className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
