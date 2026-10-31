// Fase 2 SAFE — Tela de recuperação de zero-resultados na busca.
// Substitui a "tela morta" anterior por: sugestão "você quis dizer…",
// sinônimos sugeridos, campanhas de boost ativas, ações rápidas,
// um grid dos 4 mais vendidos e CTA WhatsApp contextual.
//
// Self-contained: não depende do componente BestSellers (que assume contexto
// de home + registry). Aqui usamos diretamente os produtos ordenados por
// featured_weight para evitar acoplamento com o registry da Home.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Sparkles, Tag, Flame, LayoutGrid, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard';
import { useDbProducts, useDbCategories } from '@/hooks/useProducts';
import { useSearchSynonyms } from '@/hooks/useSearchSynonyms';
import { useContactInfo } from '@/hooks/useContactInfo';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/data/products';

interface Props {
  query: string;
  suggestion?: string | null;
  onApplySuggestion?: (term: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

interface BoostCampaign {
  term: string;
  product_slug: string | null;
  product_name: string | null;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Campanhas de boost ativas — leitura pública (`is_active`). */
function useActiveBoostCampaigns() {
  return useQuery({
    queryKey: ['search_boosts', 'public-active'],
    staleTime: 5 * 60 * 1000,
    meta: { silent: true },
    queryFn: async (): Promise<BoostCampaign[]> => {
      const { data, error } = await supabase
        .from('search_boosts' as never)
        .select('term, weight, products:product_id(name, slug)')
        .eq('is_active', true)
        .order('weight', { ascending: false })
        .limit(24);
      if (error) return [];
      const seen = new Set<string>();
      const rows: BoostCampaign[] = [];
      for (const r of (data ?? []) as any[]) {
        const term = String(r.term ?? '').trim();
        if (!term || seen.has(normalize(term))) continue;
        seen.add(normalize(term));
        rows.push({
          term,
          product_slug: r.products?.slug ?? null,
          product_name: r.products?.name ?? null,
        });
      }
      return rows.slice(0, 6);
    },
  });
}

const SearchEmptyState = ({
  query,
  suggestion,
  onApplySuggestion,
  onClearFilters,
  hasActiveFilters,
}: Props) => {
  const { data: dbProducts } = useDbProducts();
  const { data: dbCategories } = useDbCategories({ publicOnly: true });
  const { data: synonyms } = useSearchSynonyms();
  const { data: campaigns } = useActiveBoostCampaigns();
  const { buildWhatsappUrl } = useContactInfo();

  const trimmedQuery = query.trim();

  // Sinônimos sugeridos: termos canônicos cujo canônico ou aliases se
  // aproximam do que a cliente digitou (substring em ambas as direções).
  const synonymSuggestions = useMemo(() => {
    const q = normalize(trimmedQuery);
    if (q.length < 2) return [];
    const out: string[] = [];
    for (const s of synonyms ?? []) {
      const pool = [s.canonical_term, ...(s.aliases ?? [])].map(normalize);
      const hit = pool.some((t) => t && (t.includes(q) || q.includes(t)));
      if (hit && s.canonical_term && !out.includes(s.canonical_term)) {
        out.push(s.canonical_term);
      }
    }
    return out.slice(0, 5);
  }, [synonyms, trimmedQuery]);

  const quickCategories = useMemo(
    () => (dbCategories ?? []).slice(0, 6),
    [dbCategories],
  );

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

  const waMessage = trimmedQuery
    ? `Olá! Procurei por "${trimmedQuery}" no site e não encontrei. Vocês têm algo parecido?`
    : 'Olá! Não encontrei o que procurava no site. Podem me ajudar?';
  const waUrl = buildWhatsappUrl(waMessage);

  const chipClass =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border ' +
    'text-xs font-medium text-foreground/80 bg-background hover:border-primary/50 ' +
    'hover:text-primary transition-colors';

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

      {/* Sinônimos sugeridos (curadoria do admin) */}
      {synonymSuggestions.length > 0 && onApplySuggestion && (
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Talvez você procure por
          </p>
          <div className="flex flex-wrap gap-2">
            {synonymSuggestions.map((term) => (
              <button
                key={term}
                type="button"
                className={chipClass}
                onClick={() => onApplySuggestion(term)}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Campanhas de boost ativas */}
      {(campaigns?.length ?? 0) > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Em destaque agora
          </p>
          <div className="flex flex-wrap gap-2">
            {campaigns!.map((c) =>
              c.product_slug ? (
                <Link key={`${c.term}-${c.product_slug}`} to={`/produto/${c.product_slug}`} className={chipClass}>
                  <Flame className="h-3.5 w-3.5 text-primary" />
                  {c.product_name || c.term}
                </Link>
              ) : (
                <button
                  key={c.term}
                  type="button"
                  className={chipClass}
                  onClick={() => onApplySuggestion?.(c.term)}
                >
                  <Flame className="h-3.5 w-3.5 text-primary" />
                  {c.term}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="mb-8">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Ações rápidas
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/produtos" className={chipClass}>
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            Ver catálogo completo
          </Link>
          <Link to="/orcamento" className={chipClass}>
            <FileText className="h-3.5 w-3.5 text-primary" />
            Pedir orçamento personalizado
          </Link>
          {quickCategories.map((c) => (
            <Link key={c.id} to={`/produtos?categoria=${c.slug}`} className={chipClass}>
              <Tag className="h-3.5 w-3.5 text-primary" />
              {c.name}
            </Link>
          ))}
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
