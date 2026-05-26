import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { urls } from "@/lib/urls";
import { optimizeImage } from "@/lib/image";

/**
 * Prova social flutuante: exibe avaliações reais (product_reviews) com
 * miniatura do produto. 100% gerenciável via /admin/prova-social.
 */

type Review = {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  review_date: string | null;
  is_verified: boolean;
  product: { name: string; slug: string; images: string[] | null } | null;
};

type Settings = {
  is_enabled: boolean;
  initial_delay_ms: number;
  visible_ms: number;
  interval_ms: number;
  position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  show_on_mobile: boolean;
  show_on_desktop: boolean;
  min_rating: number;
  pool_size: number;
  require_verified: boolean;
  excluded_paths: string[];
  included_paths: string[];
  dismiss_persistence: "session" | "never";
};

const DEFAULTS: Settings = {
  is_enabled: true,
  initial_delay_ms: 6000,
  visible_ms: 9000,
  interval_ms: 18000,
  position: "bottom-left",
  show_on_mobile: true,
  show_on_desktop: true,
  min_rating: 4,
  pool_size: 60,
  require_verified: false,
  excluded_paths: ["/admin", "/acesso-restrito", "/rastrear"],
  included_paths: [],
  dismiss_persistence: "session",
};

const STORAGE_KEY_SESSION = "lc_social_proof_dismissed";
const STORAGE_KEY_PERSIST = "lc_social_proof_dismissed_forever";

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

function pathMatches(path: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    const pat = p.trim();
    if (!pat) return false;
    if (pat.endsWith("*")) return path.startsWith(pat.slice(0, -1));
    return path === pat || path.startsWith(pat + "/") || path.startsWith(pat);
  });
}

function useIsMobile() {
  const [m, setM] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const onR = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return m;
}

export default function SocialProofToast() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hoverRef = useRef(false);

  // Carrega settings + escuta updates em tempo real
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("social_proof_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (mounted) setSettings({ ...DEFAULTS, ...(data ?? {}) } as Settings);
    })();

    const channel = supabase
      .channel("social_proof_settings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_proof_settings" },
        (payload) => {
          const next = payload.new as Settings | undefined;
          if (next) setSettings({ ...DEFAULTS, ...next });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Persistência do dismiss
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY_PERSIST) === "1") {
      setDismissed(true);
      return;
    }
    if (sessionStorage.getItem(STORAGE_KEY_SESSION) === "1") setDismissed(true);
  }, []);

  const path = location.pathname;
  const blocked = (() => {
    if (!settings) return true;
    if (!settings.is_enabled) return true;
    if (isMobile && !settings.show_on_mobile) return true;
    if (!isMobile && !settings.show_on_desktop) return true;
    if (pathMatches(path, settings.excluded_paths)) return true;
    if (
      settings.included_paths.length > 0 &&
      !pathMatches(path, settings.included_paths)
    )
      return true;
    return false;
  })();

  // Busca avaliações reais
  useEffect(() => {
    if (!settings || blocked || dismissed) return;
    let mounted = true;

    (async () => {
      let q = supabase
        .from("product_reviews")
        .select(
          `id, author_name, rating, comment, review_date, is_verified,
           product:products!inner(name, slug, images)`,
        )
        .eq("is_visible", true)
        .gte("rating", settings.min_rating)
        .not("comment", "is", null)
        .order("review_date", { ascending: false })
        .limit(Math.max(10, Math.min(settings.pool_size, 200)));

      if (settings.require_verified) q = q.eq("is_verified", true);

      const { data, error } = await q;
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
        .map((r) => ({ ...r, product: r.product })) as Review[];

      setReviews(shuffle(cleaned).slice(0, 20));
      setIndex(0);
    })();

    return () => {
      mounted = false;
    };
  }, [settings, blocked, dismissed]);

  // Ciclo de exibição (usa timings do settings)
  useEffect(() => {
    if (!settings || blocked || dismissed || reviews.length === 0) return;

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
        cycleTimer = window.setTimeout(showOne, Math.max(2000, settings.interval_ms));
      }, Math.max(2000, settings.visible_ms));
    };

    showTimer = window.setTimeout(showOne, Math.max(0, settings.initial_delay_ms));

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(cycleTimer);
    };
  }, [reviews, settings, blocked, dismissed]);

  if (!settings || blocked || dismissed || reviews.length === 0) return null;

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
      if (settings.dismiss_persistence === "never")
        localStorage.setItem(STORAGE_KEY_PERSIST, "1");
      else sessionStorage.setItem(STORAGE_KEY_SESSION, "1");
    } catch {
      /* noop */
    }
  };

  // No carrinho, há CTA fixo "Finalizar pelo WhatsApp" embaixo — sobe o toast
  const isCart = path.startsWith("/carrinho");
  const bottomOffset = isCart ? "bottom-24 md:bottom-28" : "bottom-3 md:bottom-5";
  const positionClass: Record<Settings["position"], string> = {
    "bottom-left": `left-3 md:left-5 ${bottomOffset}`,
    "bottom-right": `right-3 md:right-5 ${bottomOffset}`,
    "top-left": "left-3 top-20 md:left-5 md:top-24",
    "top-right": "right-3 top-20 md:right-5 md:top-24",
  };

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
      className={[
        "fixed z-40",
        positionClass[settings.position],
        "max-w-[19rem] md:max-w-[22rem]",
        "transition-all duration-500 ease-out",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
    >
      <div className="relative flex items-stretch gap-3 rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg p-2.5 pr-9">
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
          className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-foreground text-background shadow-md ring-2 ring-background flex items-center justify-center hover:scale-110 transition-transform"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
