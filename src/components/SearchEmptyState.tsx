// Fase 2 SAFE — Tela de recuperação de zero-resultados na busca.
// Substitui a "tela morta" anterior por: sugestão "você quis dizer…",
// um grid dos 4 mais vendidos e CTA WhatsApp contextual.
//
// Self-contained: não depende do componente BestSellers (que assume contexto
// de home + registry). Aqui usamos diretamente os produtos ordenados por
// featured_weight para evitar acoplamento com o registry da Home.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard';
import { useDbProducts } from '@/hooks/useProducts';
import { useContactInfo } from '@/hooks/useContactInfo';
import type { Product } from '@/data/products';

interface Props {
  query: string;
  suggestion?: string | null;
  onApplySuggestion?: (term: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

const SearchEmptyState = ({
  query,
  suggestion,
  onApplySuggestion,
  onClearFilters,
  hasActiveFilters,
}: Props) => {
  const { data: dbProducts } = useDbProducts();
  const { buildWhatsappUrl } = useContactInfo();

  const fallback: Product[] = useMemo(() => {
    const active = (dbProducts ?? []).filter((p) => p.is_active);
    const sorted = [...active].sort(
      (a, b) =>
        ((b as { featured_weight?: number }).featured_weight ?? 0) -
        ((a as { featured_weight?: number }).featured_weight ?? 0),
    );
    return sorted.slice(0, 4).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description || '',
      price: `R$ ${p.price.toFixed(2).replace('.', ',')}`,
      priceValue: Number(p.price),
      originalPrice: p.original_price
        ? `R$ ${p.original_price.toFixed(2).replace('.', ',')}`
        : undefined,
      image: p.images?.[0] || '/placeholder.svg',
      images: p.images ?? [],
      link: '',
      badge: p.badge || 'Mais Vendido',
      rating: Math.round(p.rating ?? 5),
      category: 'outros' as const,
      occasions: [],
      keywords: p.keywords ?? [],
      min_quantity: p.min_quantity || undefined,
    })) as unknown as Product[];
  }, [dbProducts]);

  const trimmedQuery = query.trim();
  const waMessage = trimmedQuery
    ? `Olá! Procurei por "${trimmedQuery}" no site e não encontrei. Vocês têm algo parecido?`
    : 'Olá! Não encontrei o que procurava no site. Podem me ajudar?';
  const waUrl = buildWhatsappUrl(waMessage);

  return (
    <section className="py-10" aria-live="polite">
      <div className="text-center max-w-md mx-auto mb-8">
        <p className="text-foreground font-medium mb-1">
          {trimmedQuery
            ? <>Nada encontrado para <span className="text-primary">"{trimmedQuery}"</span>.</>
            : 'Nenhum produto encontrado.'}
        </p>

        {suggestion && onApplySuggestion ? (
          <p className="text-sm text-muted-foreground mb-4">
            Você quis dizer{' '}
            <button
              type="button"
              onClick={() => onApplySuggestion(suggestion)}
              className="inline-flex items-center gap-1 text-primary font-medium underline underline-offset-2 hover:no-underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {suggestion}
            </button>
            ?
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">
            Tente outra palavra-chave, remova os filtros ou veja algumas sugestões abaixo.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {hasActiveFilters && onClearFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          )}
          <Button asChild size="sm" className="gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Falar no WhatsApp sobre o que procuro"
            >
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </Button>
        </div>
      </div>

      {fallback.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Enquanto isso, os preferidos da loja
            </p>
            <Link to="/produtos" className="text-xs text-primary hover:underline">
              Ver tudo
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {fallback.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default SearchEmptyState;
