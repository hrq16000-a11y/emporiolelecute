// Fase 7 — Bloco visual de avaliações de produto (com fotos)
import { useState } from 'react';
import { Star, BadgeCheck, ExternalLink, X, ChevronDown, ChevronUp, Quote } from 'lucide-react';
import { useProductReviews, useProductReviewStats } from '@/hooks/useProductReviews';
import { optimizeImage } from '@/lib/image';
import { event as gaEvent } from '@/lib/analytics';

interface Props {
  productId: string;
  /** initial number of reviews shown; rest collapsed behind "Ver mais" */
  initialLimit?: number;
  /** compact layout (single column, tighter cards) ideal for placing under the gallery thumbnails */
  variant?: 'default' | 'compact';
}

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
};

const Stars = ({ value }: { value: number }) => (
  <div className="flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`h-4 w-4 ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
      />
    ))}
  </div>
);

const ProductReviews = ({ productId, initialLimit = 3, variant = 'default' }: Props) => {
  const { data: reviews = [], isLoading } = useProductReviews(productId);
  const { data: stats } = useProductReviewStats(productId);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return null;
  if (!reviews.length) return null;

  const openLightbox = (src: string, reviewId: string, idx: number) => {
    setLightbox(src);
    gaEvent('review_gallery_interaction', {
      product_id: productId,
      review_id: reviewId,
      image_index: idx,
      action: 'open',
    });
  };

  const isCompact = variant === 'compact';
  const visibleReviews = expanded ? reviews : reviews.slice(0, initialLimit);
  const remaining = reviews.length - visibleReviews.length;

  return (
    <section
      className={isCompact ? 'mt-6' : 'mb-16'}
      aria-labelledby={`product-reviews-title-${productId}`}
    >
      <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <h2
          id={`product-reviews-title-${productId}`}
          className={`font-display ${isCompact ? 'text-lg' : 'text-2xl'} text-foreground flex items-center gap-2`}
        >
          <Quote className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'} text-primary`} />
          O que dizem nossas clientes
        </h2>
        {stats && (
          <div className="flex items-center gap-2 text-sm">
            <Stars value={Number(stats.avg_rating)} />
            <span className="font-semibold text-foreground">
              {Number(stats.avg_rating).toFixed(1)}
            </span>
            <span className="text-muted-foreground">
              ({stats.review_count})
            </span>
          </div>
        )}
      </div>

      {/* Stack layout: vertical list — looks great under the gallery thumbnails */}
      <div className={`grid gap-3 ${isCompact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        {visibleReviews.map((r) => (
          <article
            key={r.id}
            className="group relative bg-gradient-to-br from-card to-card/60 border border-border/60
                       rounded-2xl p-4 flex flex-col gap-2.5 hover:border-primary/40
                       hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.25)] transition-all"
          >
            {/* Decorative quote mark */}
            <Quote className="absolute -top-2 -left-1 h-6 w-6 text-primary/15 -scale-x-100" aria-hidden />

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm text-foreground truncate">{r.author_name}</span>
                  {r.is_verified && (
                    <BadgeCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-label="Verificada" />
                  )}
                </div>
                <div className="mt-0.5"><Stars value={r.rating} /></div>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                {formatDate(r.review_date || r.created_at)}
              </span>
            </div>

            {r.comment && (
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "{r.comment}"
              </p>
            )}


            {r.images && r.images.length > 0 && (
              <div
                className={`grid gap-2 ${
                  r.images.length === 1 ? 'grid-cols-1' :
                  r.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                }`}
                style={{ contain: 'layout' }}
              >
                {r.images.slice(0, 6).map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => openLightbox(src, r.id, idx)}
                    className="relative aspect-square rounded-lg overflow-hidden bg-muted
                               group focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Foto ${idx + 1} da avaliação de ${r.author_name}`}
                  >
                    <img
                      src={optimizeImage(src, { width: 400, resize: 'cover' })}
                      alt={`Foto real de ${r.author_name}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </button>
                ))}
              </div>
            )}

            {r.source_url && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  Ver origem <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </article>
        ))}
      </div>

      {reviews.length > initialLimit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5
                     rounded-full border border-primary/30 text-primary text-sm font-semibold
                     hover:bg-primary/5 transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>Mostrar menos <ChevronUp className="h-4 w-4" /></>
          ) : (
            <>Ver mais {remaining} {remaining === 1 ? 'avaliação' : 'avaliações'} <ChevronDown className="h-4 w-4" /></>
          )}
        </button>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={optimizeImage(lightbox, { width: 1600, resize: 'contain' })}
            alt="Foto da avaliação"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </section>
  );
};

export default ProductReviews;
