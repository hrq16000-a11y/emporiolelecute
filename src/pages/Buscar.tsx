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
import { useSearchSynonyms, expandWithSynonyms } from "@/hooks/useSearchSynonyms";
import { normalizeSearch, suggestClosest } from "@/lib/searchNormalize";
import SearchEmptyState from "@/components/SearchEmptyState";
import type { Product } from "@/data/products";

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
  const { data: dbProducts, isLoading } = useDbProducts();
  const { data: dbCategories } = useDbCategories({ publicOnly: true });
  const { data: synonyms } = useSearchSynonyms();

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
        _occasionNames: (p.occasions || []).map((o) => o.name),
        _tagNames: (p.tags || []).map((t) => t.name),
      })) as any;
  }, [dbProducts]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const range = PRICE_RANGES.find((r) => r.id === selectedPrice);
    return products.filter((p: any) => {
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p._categoryName.toLowerCase().includes(q) ||
        p._occasionNames.some((n: string) => n.toLowerCase().includes(q)) ||
        p._tagNames.some((n: string) => n.toLowerCase().includes(q)) ||
        p.keywords.some((k: string) => k.toLowerCase().includes(q));
      const matchesCat = !selectedCategory || p._categoryId === selectedCategory;
      const matchesPrice =
        !range || (p._priceNum >= range.min && p._priceNum < range.max);
      return matchesQ && matchesCat && matchesPrice;
    });
  }, [products, debouncedQuery, selectedCategory, selectedPrice]);

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
              {isLoading
                ? "Carregando…"
                : `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`}
            </p>
            <Link to="/produtos" className="text-xs text-primary hover:underline">
              Ver catálogo completo
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-foreground font-medium mb-2">
                Nenhum produto encontrado
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Tente outra palavra-chave ou remova os filtros.
              </p>
              {activeCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {filtered.slice(0, 60).map((p) => (
                <ProductCard key={p.id} product={p as Product} />
              ))}
            </div>
          )}

          {filtered.length > 60 && (
            <div className="text-center mt-6">
              <Link to={`/produtos?busca=${encodeURIComponent(debouncedQuery)}`}>
                <Button variant="outline" size="sm">
                  Ver todos os {filtered.length} resultados
                </Button>
              </Link>
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
