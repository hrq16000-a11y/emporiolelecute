import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { EXECUTIVE_NAV, type NavLeaf } from "@/lib/executiveNavigation";
import { highlightMatch } from "@/lib/highlightMatch";
import { cn } from "@/lib/utils";

interface AdminHit extends NavLeaf {
  group: string;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Flatten do EXECUTIVE_NAV — fonte única para sugestões admin.
const FLAT_NAV: AdminHit[] = EXECUTIVE_NAV.flatMap((g) =>
  g.items.map((leaf) => ({ ...leaf, group: g.label }))
);

interface AdminSearchBarProps {
  onResultSelect?: () => void;
  className?: string;
}

const AdminSearchBar = ({ onResultSelect, className }: AdminSearchBarProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query, 300);

  const results = useMemo<AdminHit[]>(() => {
    if (debouncedQuery.length < 2) return [];
    const term = normalize(debouncedQuery);
    return FLAT_NAV
      .map((hit) => {
        const hay = normalize(`${hit.label} ${hit.group} ${hit.path}`);
        const idx = hay.indexOf(term);
        if (idx === -1) return null;
        // Boost: matches no label vêm primeiro
        const labelMatch = normalize(hit.label).includes(term) ? 0 : 1;
        return { hit, score: labelMatch * 100 + idx };
      })
      .filter((x): x is { hit: AdminHit; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map((x) => x.hit);
  }, [debouncedQuery]);

  useEffect(() => {
    setIsOpen(debouncedQuery.length >= 2);
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isSearching = query.length >= 2 && query !== debouncedQuery;

  const handleSelect = (hit: AdminHit) => {
    navigate(hit.path);
    setQuery("");
    setIsOpen(false);
    onResultSelect?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = selectedIndex >= 0 ? results[selectedIndex] : results[0];
      if (target) handleSelect(target);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar páginas, funções..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => debouncedQuery.length >= 2 && setIsOpen(true)}
          className="pl-8 pr-7 h-8 text-xs rounded-lg bg-muted/40 border-border/60 focus:bg-background"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="admin-search-suggestions"
          aria-activedescendant={selectedIndex >= 0 ? `admin-opt-${selectedIndex}` : undefined}
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id="admin-search-suggestions"
          role="listbox"
          className="absolute top-full mt-1.5 left-0 right-0 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-fade-in max-h-[60vh] overflow-y-auto"
        >
          {isSearching ? (
            <div className="flex items-center justify-center py-4" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Buscando...</span>
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((hit, idx) => (
                <li key={hit.path}>
                  <button
                    type="button"
                    id={`admin-opt-${idx}`}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    onClick={() => handleSelect(hit)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                      idx === selectedIndex
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {highlightMatch(hit.label, debouncedQuery)}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {hit.group} • {hit.path}
                      </p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3">
              <p className="text-xs text-muted-foreground text-center">
                Nenhuma página encontrada para "{debouncedQuery}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSearchBar;
