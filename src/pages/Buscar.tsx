import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search, X, Loader2, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/ProductCard";
import { useDbProducts, useDbCategories } from "@/hooks/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchCacheVersion } from "@/hooks/useSearchCacheVersion";
import { supabase } from "@/integrations/supabase/client";
import SearchEmptyState from "@/components/SearchEmptyState";
import DataErrorState from "@/components/DataErrorState";
import type { Product } from "@/data/products";

// Fase 2 (refactor server-side) — Toda a busca tolerante (acento, typo,
// sinônimos) acontece no Postgres via RPC `search_products`. O frontend
// apenas envia o termo e recebe IDs ordenados por relevância + sugestão.
// Fase 3 — paginação real (offset/limit) para não trazer o bloco inteiro.
const PAGE_SIZE = 24;

interface SearchRpcPage {
  ids: string[];
  suggestion: string | null;
  total: number;
  offset: number;
  hasMore: boolean;
}

interface ServerSearchFilters {
  categoryId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}

function useServerSearch(term: string, filters: ServerSearchFilters) {
  const q = term.trim();
  const categoryId = filters.categoryId ?? null;
  const minPrice = filters.minPrice ?? null;
  const maxPrice =
    filters.maxPrice != null && Number.isFinite(filters.maxPrice) ? filters.maxPrice : null;

  // Invalidação automática: a versão sobe no banco quando produtos, categorias,
  // boosts ou sinônimos mudam no admin — os resultados nunca ficam obsoletos.
  const cacheVersion = useSearchCacheVersion();

  return useInfiniteQuery({
    queryKey: ["search_products", q, categoryId, minPrice, maxPrice, cacheVersion],
    enabled: q.length >= 2,
    initialPageParam: 0,
    // Cache por termo + filtros: digitar de volta um termo já buscado não gera request.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (prev) => prev,
    getNextPageParam: (last: SearchRpcPage) =>
      last.hasMore ? last.offset + last.ids.length : undefined,
    queryFn: async ({ pageParam }): Promise<SearchRpcPage> => {
      const offset = Number(pageParam) || 0;
      const { data, error } = await supabase.rpc("search_products" as never, {
        _q: q,
        _limit: PAGE_SIZE,
        _offset: offset,
        _category_id: categoryId,
        _min_price: minPrice,
        _max_price: maxPrice,
      } as never);
      if (error) throw error;
      const payload = (data ?? {}) as {
        ids?: string[];
        suggestion?: string | null;
        total?: number;
        offset?: number;
        has_more?: boolean;
      };
      return {
        ids: Array.isArray(payload.ids) ? payload.ids : [],
        suggestion: payload.suggestion ?? null,
        total: Number(payload.total ?? 0),
        offset: Number(payload.offset ?? offset),
        hasMore: Boolean(payload.has_more),
      };
    },
  });
}



const PRICE_RANGES: { id: string; label: string; min: number; max: number }[] = [
  { id: "lt50", label: "Até R$ 50", min: 0, max: 50 },
  { id: "50-100", label: "R$ 50–100", min: 50, max: 100 },
  { id: "100-200", label: "R$ 100–200", min: 100, max: 200 },
  { id: "gt200", label: "Acima de R$ 200", min: 200, max: Infinity },
];

const Buscar = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || searchParams.get("busca") || "";
  const initialCat = searchParams.get("categoria");
  const initialPrice = searchParams.get("preco");

  const [query, setQuery] = useState(initialQ);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCat);
  const [selectedPrice, setSelectedPrice] = useState<string | null>(initialPrice);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);
  const {
    data: dbProducts,
    isLoading,
    error: productsError,
    refetch: refetchProducts,
    isRefetching: isRefetchingProducts,
  } = useDbProducts();
  const { data: dbCategories } = useDbCategories({ publicOnly: true });

  // Filtros aplicados no Postgres (categoria/preço) — o frontend só ordena o resultado.
  const selectedCategoryId = useMemo(
    () => (dbCategories || []).find((c) => c.slug === selectedCategory)?.id ?? null,
    [dbCategories, selectedCategory],
  );
  const selectedRange = useMemo(
    () => PRICE_RANGES.find((r) => r.id === selectedPrice) ?? null,
    [selectedPrice],
  );

  const {
    data: searchPages,
    isFetching: isSearching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error: searchError,
    refetch: refetchSearch,
  } = useServerSearch(debouncedQuery, {
    categoryId: selectedCategoryId,
    minPrice: selectedRange ? selectedRange.min : null,
    maxPrice: selectedRange && Number.isFinite(selectedRange.max) ? selectedRange.max : null,
  });

  const searchResult = useMemo(() => {
    const pages = searchPages?.pages ?? [];
    return {
      ids: pages.flatMap((p) => p.ids),
      suggestion: pages[0]?.suggestion ?? null,
      total: pages[0]?.total ?? 0,
    };
  }, [searchPages]);

  // Autofoco no campo ao abrir a página (UX mobile)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80);
    return () => clearTimeout(t);
  }, []);

  // Sync URL → state quando navegar de volta
  useEffect(() => {
    setQuery(searchParams.get("q") || searchParams.get("busca") || "");
    setSelectedCategory(searchParams.get("categoria"));
    setSelectedPrice(searchParams.get("preco"));
  }, [searchParams]);

  // Persistir filtros na URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQuery) next.set("q", debouncedQuery);
    if (selectedCategory) next.set("categoria", selectedCategory);
    if (selectedPrice) next.set("preco", selectedPrice);
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, selectedCategory, selectedPrice, setSearchParams]);

  // A RPC `search_products` já registra a consulta (log_search) na primeira
  // página, alimentando o cockpit administrativo sem request extra do cliente.



  const products: Product[] = useMemo(() => {
    return (dbProducts || [])
      .filter((p) => p.is_active)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description || "",
        longDescription: p.long_description || undefined,
        price: `R$ ${p.price.toFixed(2).replace(".", ",")}`,
        priceValue: Number(p.price),
        originalPrice: p.original_price
          ? `R$ ${p.original_price.toFixed(2).replace(".", ",")}`
          : undefined,
        image: p.images[0] || "/placeholder.svg",
        images: p.images,
        link: "",
        badge: p.badge || undefined,
        rating: Math.round(p.rating),
        category: "outros" as const,
        occasions: [],
        keywords: p.keywords,
        min_quantity: p.min_quantity || undefined,
        // augment privado p/ filtro:
        _categoryId: p.category_id || undefined,
        _priceNum: Number(p.price) || 0,
        _categoryName: p.category?.name || "",
        _categorySlug: p.category?.slug || "",

        _occasionNames: (p.occasions || []).map((o) => o.name),
        _tagNames: (p.tags || []).map((t) => t.name),
      })) as any;
  }, [dbProducts]);

  const filtered = useMemo(() => {
    // Busca textual + filtros de categoria/preço rodam no Postgres (RPC `search_products`).
    // O frontend só reordena pelo ranking recebido. Sem termo, filtra o catálogo local.
    const rawQuery = debouncedQuery.trim();

    if (rawQuery.length >= 2) {
      const ids = searchResult?.ids ?? [];
      const order = new Map(ids.map((id, idx) => [id, idx]));
      return products
        .filter((p: any) => order.has(p.id))
        .sort((a: any, b: any) => (order.get(a.id)! - order.get(b.id)!));
    }

    return (products as any[]).filter((p: any) => {
      const matchesCat = !selectedCategory || p._categorySlug === selectedCategory;
      const matchesPrice =
        !selectedRange ||
        (p._priceNum >= selectedRange.min && p._priceNum < selectedRange.max);
      return matchesCat && matchesPrice;
    });
  }, [products, debouncedQuery, selectedCategory, selectedRange, searchResult]);


  // "Você quis dizer..." vem direto da RPC (similaridade trigram no servidor).
  const suggestion = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q || filtered.length > 0) return null;
    return searchResult?.suggestion ?? null;
  }, [debouncedQuery, filtered.length, searchResult]);

  const hasSearchTerm = debouncedQuery.trim().length >= 2;
  const totalResults = hasSearchTerm ? searchResult.total : filtered.length;
  const [visibleLocal, setVisibleLocal] = useState(PAGE_SIZE);

  // Ao trocar termo/filtros, volta a fatia local ao tamanho de uma página.
  useEffect(() => {
    setVisibleLocal(PAGE_SIZE);
  }, [debouncedQuery, selectedCategory, selectedPrice]);

  const activeCount =
    (debouncedQuery ? 1 : 0) + (selectedCategory ? 1 : 0) + (selectedPrice ? 1 : 0);


  const clearAll = () => {
    setQuery("");
    setSelectedCategory(null);
    setSelectedPrice(null);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Buscar produtos | Empório LeleCute</title>
        <meta name="robots" content="noindex,follow" />
        <meta
          name="description"
          content="Busque sabonetes, velas e lembrancinhas personalizadas no catálogo do Empório LeleCute."
        />
      </Helmet>

      <Header />

      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-2xl md:text-3xl text-foreground mb-4">
            Buscar produtos
          </h1>

          {/* Campo de busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="O que você procura?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.blur();
                }
              }}
              className="pl-9 pr-10 h-12 rounded-full bg-secondary/40 border-border/60 text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtros rápidos */}
          <div className="space-y-3 mb-5">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Categoria
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    !selectedCategory
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground/80 border-border hover:border-primary/50"
                  }`}
                >
                  Todas
                </button>
                {(dbCategories || []).map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      setSelectedCategory((cur) => (cur === c.slug ? null : c.slug))
                    }
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedCategory === c.slug
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground/80 border-border hover:border-primary/50"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Faixa de preço
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {PRICE_RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() =>
                      setSelectedPrice((cur) => (cur === r.id ? null : r.id))
                    }
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedPrice === r.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground/80 border-border hover:border-primary/50"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-primary underline underline-offset-2"
              >
                Limpar filtros ({activeCount})
              </button>
            )}
          </div>

          {/* Resultados */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {productsError || searchError
                ? "Busca indisponível no momento"
                : isLoading || (isSearching && !isFetchingNextPage)
                ? "Buscando…"
                : hasSearchTerm
                  ? `${filtered.length} de ${totalResults} ${totalResults === 1 ? "resultado" : "resultados"}`
                  : `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`}
            </p>
            <Link to="/produtos" className="text-xs text-primary hover:underline">
              Ver catálogo completo
            </Link>
          </div>

          {productsError || searchError ? (
            <DataErrorState
              scope="catalog"
              error={productsError || searchError}
              onRetry={() => {
                if (productsError) void refetchProducts();
                if (searchError) void refetchSearch();
              }}
              isRetrying={isRefetchingProducts || isSearching}
            />
          ) : isLoading || (isSearching && !isFetchingNextPage) ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <SearchEmptyState
              query={debouncedQuery}
              suggestion={suggestion}
              onApplySuggestion={(term) => setQuery(term)}
              onClearFilters={clearAll}
              hasActiveFilters={activeCount > 0}
            />
          ) : (
            <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 [&>*]:stagger-item">
              {(hasSearchTerm ? filtered : filtered.slice(0, visibleLocal)).map((p) => (
                <ProductCard key={p.id} product={p as Product} />
              ))}
            </div>
          )}

          {/* Paginação: busca server-side usa offset/limit; catálogo local incrementa a fatia */}
          {!productsError && !searchError && hasSearchTerm && hasNextPage && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
                  </>
                ) : (
                  `Carregar mais (${totalResults - filtered.length} restantes)`
                )}
              </Button>
            </div>
          )}

          {!productsError && !searchError && !hasSearchTerm && filtered.length > visibleLocal && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => setVisibleLocal((v) => v + PAGE_SIZE)}
              >
                Carregar mais
              </Button>
            </div>
          )}

        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Buscar;
