import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Loader2, Package, Tag, Calendar, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDbProducts, useDbCategories, useDbOccasions } from "@/hooks/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import { optimizeImage } from "@/lib/image";
import { urls } from "@/lib/urls";
import { highlightMatch } from "@/lib/highlightMatch";

interface SearchBarProps {
  /** Destino do "ver todos" e do Enter sem seleção. Default: /produtos */
  searchPath?: string;
  /** Nome do query param no submit. Default: busca */
  paramKey?: string;
  /** Disparado após selecionar uma sugestão (gancho de fechamento mobile) */
  onResultSelect?: () => void;
  /** Autofocus no input ao montar */
  autoFocus?: boolean;
}

type SuggestionKind = "product" | "category" | "occasion" | "page";
interface Suggestion {
  kind: SuggestionKind;
  id: string;
  label: string;
  sublabel?: string;
  to: string;
  image?: string | null;
}

// Páginas estáticas públicas — sempre buscáveis sem depender de fetch.
const STATIC_PAGES: Array<{ label: string; to: string; keywords?: string[] }> = [
  { label: "Início", to: "/", keywords: ["home", "principal"] },
  { label: "Loja", to: "/loja", keywords: ["produtos", "comprar"] },
  { label: "Sobre", to: "/sobre", keywords: ["historia", "marca"] },
  { label: "Contato", to: "/contato", keywords: ["whatsapp", "email"] },
  { label: "Blog", to: "/blog", keywords: ["artigos", "posts"] },
  { label: "Orçamento", to: "/orcamento", keywords: ["personalizado", "cotacao"] },
  { label: "Rastrear Pedido", to: "/rastrear", keywords: ["pedido", "status"] },
  { label: "Política de Privacidade", to: "/politica-de-privacidade", keywords: ["lgpd", "privacidade"] },
];

const KIND_META: Record<SuggestionKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  product: { label: "Produtos", icon: Package },
  category: { label: "Categorias", icon: Tag },
  occasion: { label: "Ocasiões", icon: Calendar },
  page: { label: "Páginas", icon: FileText },
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SearchBar = ({
  searchPath = "/produtos",
  paramKey = "busca",
  onResultSelect,
  autoFocus = false,
}: SearchBarProps = {}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Debounce 300ms — evita re-render por tecla
  const debouncedQuery = useDebounce(query, 300);

  const { data: products = [], isLoading: loadingProducts } = useDbProducts();
  const { data: categories = [] } = useDbCategories({ publicOnly: true });
  const { data: occasions = [] } = useDbOccasions({ publicOnly: true });

  // Gera sugestões agrupadas (produtos, categorias, ocasiões, páginas)
  const { suggestions, grouped } = useMemo(() => {
    const empty = { suggestions: [] as Suggestion[], grouped: [] as Array<{ kind: SuggestionKind; items: Suggestion[] }> };
    if (debouncedQuery.length < 2) return empty;

    const term = normalize(debouncedQuery);

    const productItems: Suggestion[] = products
      .filter((p) => {
        if (!p.is_active) return false;
        const hay = normalize(
          [
            p.name,
            p.description ?? "",
            p.category?.name ?? "",
            ...(p.occasions?.map((o) => o.name) ?? []),
            ...(p.tags?.map((t) => t.name) ?? []),
            ...(p.keywords ?? []),
          ].join(" ")
        );
        return hay.includes(term);
      })
      .slice(0, 5)
      .map((p) => ({
        kind: "product" as const,
        id: p.id,
        label: p.name,
        sublabel: `${p.category?.name ?? ""}${p.category?.name ? " • " : ""}${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.price)}`,
        to: urls.product(p.slug),
        image: p.images?.[0],
      }));

    const categoryItems: Suggestion[] = categories
      .filter((c) => normalize(c.name).includes(term))
      .slice(0, 3)
      .map((c) => ({
        kind: "category" as const,
        id: c.id,
        label: c.name,
        sublabel: "Categoria",
        to: `/categoria/${c.slug}`,
      }));

    const occasionItems: Suggestion[] = occasions
      .filter((o) => normalize(o.name).includes(term))
      .slice(0, 3)
      .map((o) => ({
        kind: "occasion" as const,
        id: o.id,
        label: o.name,
        sublabel: "Ocasião",
        to: `/ocasiao/${o.slug}`,
      }));

    const pageItems: Suggestion[] = STATIC_PAGES
      .filter((p) => {
        const hay = normalize([p.label, ...(p.keywords ?? [])].join(" "));
        return hay.includes(term);
      })
      .slice(0, 3)
      .map((p) => ({
        kind: "page" as const,
        id: p.to,
        label: p.label,
        sublabel: "Página",
        to: p.to,
      }));

    // Ordem dos grupos prioriza produtos (intent comercial)
    const groups: Array<{ kind: SuggestionKind; items: Suggestion[] }> = [
      { kind: "product", items: productItems },
      { kind: "category", items: categoryItems },
      { kind: "occasion", items: occasionItems },
      { kind: "page", items: pageItems },
    ].filter((g) => g.items.length > 0);

    const flat = groups.flatMap((g) => g.items);
    return { suggestions: flat, grouped: groups };
  }, [debouncedQuery, products, categories, occasions]);

  // Abre/fecha dropdown conforme query debouncada
  useEffect(() => {
    setIsOpen(debouncedQuery.length >= 2);
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (s: Suggestion) => {
    navigate(s.to);
    setQuery("");
    setIsOpen(false);
    onResultSelect?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex]);
      } else if (query.length >= 2) {
        navigate(`${searchPath}?${paramKey}=${encodeURIComponent(query)}`);
        setIsOpen(false);
        onResultSelect?.();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Autofocus (mobile open)
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const clearSearch = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Loading visível apenas enquanto debounce ainda não alcançou query
  const isSearching = query.length >= 2 && query !== debouncedQuery;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar produtos, categorias..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => debouncedQuery.length >= 2 && setIsOpen(true)}
          className="pl-9 pr-8 h-9 rounded-full bg-secondary/50 border-border/50 focus:bg-background"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-activedescendant={selectedIndex >= 0 ? `search-opt-${selectedIndex}` : undefined}
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute top-full mt-2 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-fade-in max-h-[70vh] overflow-y-auto"
        >
          {isSearching || (loadingProducts && products.length === 0) ? (
            <div className="flex items-center justify-center py-6" role="status" aria-live="polite">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
            </div>
          ) : grouped.length > 0 ? (
            <>
              {(() => {
                let flatIdx = -1;
                return grouped.map((group) => {
                  const Meta = KIND_META[group.kind];
                  const Icon = Meta.icon;
                  return (
                    <div key={group.kind} className="py-1">
                      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
                        <Icon className="h-3 w-3" />
                        {Meta.label}
                      </div>
                      <ul>
                        {group.items.map((s) => {
                          flatIdx += 1;
                          const idx = flatIdx;
                          return (
                            <li key={`${s.kind}-${s.id}`}>
                              <Link
                                id={`search-opt-${idx}`}
                                role="option"
                                aria-selected={idx === selectedIndex}
                                to={s.to}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleSelect(s);
                                }}
                                className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                                  idx === selectedIndex ? "bg-primary-light" : "hover:bg-secondary"
                                }`}
                              >
                                {s.kind === "product" ? (
                                  <img
                                    src={optimizeImage(s.image, { width: 96, resize: "contain" })}
                                    alt={s.label}
                                    className="w-10 h-10 rounded-lg object-contain bg-muted p-1 shrink-0"
                                  />
                                ) : (
                                  <span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                    <Icon className="h-4 w-4" />
                                  </span>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {highlightMatch(s.label, debouncedQuery)}
                                  </p>
                                  {s.sublabel && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {s.sublabel}
                                    </p>
                                  )}
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                });
              })()}
              <Link
                to={`${searchPath}?${paramKey}=${encodeURIComponent(query)}`}
                onClick={() => {
                  setIsOpen(false);
                  onResultSelect?.();
                }}
                className="block px-4 py-3 text-center text-sm text-primary hover:bg-secondary border-t border-border"
              >
                Ver todos os resultados para "{query}"
              </Link>
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                Nenhum resultado encontrado para "{debouncedQuery}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
