import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search, Grid, List, ShoppingBag, Loader2, Tag, ChevronRight, ChevronLeft, MessageCircle, Sparkles, Heart, Truck, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/ProductCard";
import Chatbot from "@/components/Chatbot";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import CatalogFilters, { useCatalogFiltersFromUrl } from "@/components/CatalogFilters";
import { applyCatalogFilters, sortByFeatured, priceBoundsFrom } from "@/lib/catalogFilter";
import { useDbProducts, useDbCategories, useDbOccasions } from "@/hooks/useProducts";
import { useTags } from "@/hooks/useTags";
import { useSegments } from "@/hooks/useSegments";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Product } from "@/data/products";

const PRODUCTS_PER_PAGE = 12;

const Produtos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dbProducts, isLoading: loadingProducts } = useDbProducts();
  const { data: dbCategories } = useDbCategories({ publicOnly: true });
  const { data: dbOccasions } = useDbOccasions({ publicOnly: true });
  const { data: dbTags } = useTags();
  const { data: dbSegments } = useSegments({ publicOnly: true });

  const [search, setSearch] = useState(searchParams.get('busca') || searchParams.get('search') || "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get('categoria') || null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(searchParams.get('ocasiao') || null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(searchParams.get('segmento') || null);
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get('tag') || null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // Filters: persist user preference in localStorage; auto-open if URL has active filter
  const initialFiltersOpen = (() => {
    const hasUrlFilter = Boolean(
      searchParams.get('categoria') || searchParams.get('ocasiao') ||
      searchParams.get('segmento')  || searchParams.get('tag')
    );
    if (hasUrlFilter) return true;
    try {
      const stored = localStorage.getItem('produtos:filtersOpen');
      if (stored !== null) return stored === '1';
    } catch { /* ignore */ }
    return false;
  })();
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  useEffect(() => {
    try { localStorage.setItem('produtos:filtersOpen', filtersOpen ? '1' : '0'); } catch { /* ignore */ }
  }, [filtersOpen]);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('pagina')) || 1);

  // Debounce search for better performance
  const debouncedSearch = useDebounce(search, 300);

  // Sync URL params with state
  useEffect(() => {
    const urlSearch = searchParams.get('busca') || searchParams.get('search');
    const urlCategoria = searchParams.get('categoria');
    const urlOcasiao = searchParams.get('ocasiao');
    const urlSegmento = searchParams.get('segmento');
    const urlTag = searchParams.get('tag');
    const urlPage = searchParams.get('pagina');

    setSearch(urlSearch ?? "");
    setSelectedCategory(urlCategoria);
    setSelectedOccasion(urlOcasiao);
    setSelectedSegment(urlSegmento);
    setSelectedTag(urlTag);
    setCurrentPage(urlPage ? Number(urlPage) || 1 : 1);
  }, [searchParams]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, selectedOccasion, selectedSegment, selectedTag]);

  // Helper to find category/occasion/tag by slug or ID
  const findCategoryBySlugOrId = (value: string | null) => {
    if (!value || !dbCategories) return null;
    return dbCategories.find(c => c.slug === value || c.id === value) || null;
  };

  const findOccasionBySlugOrId = (value: string | null) => {
    if (!value || !dbOccasions) return null;
    return dbOccasions.find(o => o.slug === value || o.id === value) || null;
  };

  const findTagBySlugOrId = (value: string | null) => {
    if (!value || !dbTags) return null;
    return dbTags.find(t => t.slug === value || t.id === value) || null;
  };

  const findSegmentBySlugOrId = (value: string | null) => {
    if (!value || !dbSegments) return null;
    return dbSegments.find(s => s.slug === value || s.id === value) || null;
  };

  // Get resolved filters from URL params
  const resolvedCategory = findCategoryBySlugOrId(selectedCategory);
  const resolvedOccasion = findOccasionBySlugOrId(selectedOccasion);
  const resolvedSegment = findSegmentBySlugOrId(selectedSegment);
  const resolvedTag = findTagBySlugOrId(selectedTag);

  // Update URL when filters change - use SLUG for friendly URLs
  const handleCategoryChange = (categorySlug: string | null) => {
    setSelectedCategory(categorySlug);
    const newParams = new URLSearchParams(searchParams);
    if (categorySlug) {
      newParams.set('categoria', categorySlug);
    } else {
      newParams.delete('categoria');
    }
    newParams.delete('pagina');
    setSearchParams(newParams);
  };

  const handleOccasionChange = (occasionSlug: string | null) => {
    setSelectedOccasion(occasionSlug);
    const newParams = new URLSearchParams(searchParams);
    if (occasionSlug) {
      newParams.set('ocasiao', occasionSlug);
    } else {
      newParams.delete('ocasiao');
    }
    newParams.delete('pagina');
    setSearchParams(newParams);
  };

  const handleTagChange = (tagSlug: string | null) => {
    setSelectedTag(tagSlug);
    const newParams = new URLSearchParams(searchParams);
    if (tagSlug) {
      newParams.set('tag', tagSlug);
    } else {
      newParams.delete('tag');
    }
    newParams.delete('pagina');
    setSearchParams(newParams);
  };

  const handleSegmentChange = (segmentSlug: string | null) => {
    setSelectedSegment(segmentSlug);
    const newParams = new URLSearchParams(searchParams);
    if (segmentSlug) {
      newParams.set('segmento', segmentSlug);
    } else {
      newParams.delete('segmento');
    }
    newParams.delete('pagina');
    setSearchParams(newParams);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const newParams = new URLSearchParams(searchParams);
    if (page > 1) {
      newParams.set('pagina', String(page));
    } else {
      newParams.delete('pagina');
    }
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedCategory(null);
    setSelectedOccasion(null);
    setSelectedSegment(null);
    setSelectedTag(null);
    setCurrentPage(1);
    setSearchParams({});
  };

  // Count active filters (for UI)
  const activeFiltersCount = [resolvedCategory, resolvedOccasion, resolvedSegment, resolvedTag, debouncedSearch].filter(Boolean).length;

  // Structural filters count (cat + occ + seg) — drives SEO canonical/robots
  const structuralFilters = [resolvedCategory, resolvedOccasion, resolvedSegment].filter(Boolean);
  const structuralCount = structuralFilters.length;

  // Convert db products to Product format with relations
  const products: (Product & {
    priceNum: number;
    categoryId?: string;
    categoryName?: string;
    categorySlug?: string;
    longDescriptionRaw?: string;
    occasionIds: string[];
    occasionNames: string[];
    occasionSlugs: string[];
    tagIds: string[];
    tagNames: string[];
    tagSlugs: string[];
    segmentIds: string[];
    segmentNames: string[];
    segmentSlugs: string[];
  })[] = useMemo(() => {
    return (dbProducts || [])
      .filter(p => p.is_active)
      .map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description || '',
        longDescription: p.long_description || undefined,
        longDescriptionRaw: p.long_description || '',
        price: `R$ ${p.price.toFixed(2).replace('.', ',')}`,
        priceNum: Number(p.price),
        originalPrice: p.original_price ? `R$ ${p.original_price.toFixed(2).replace('.', ',')}` : undefined,
        image: p.images[0] || '/placeholder.svg',
        images: p.images,
        link: '',
        badge: p.badge || undefined,
        rating: Math.round(p.rating),
        category: 'outros' as const,
        occasions: [],
        keywords: p.keywords,
        min_quantity: p.min_quantity || undefined,
        production_days: p.production_days ?? null,
        production_speed: p.production_speed ?? null,
        personalization_enabled: p.personalization_enabled ?? null,
        featured_weight: p.featured_weight ?? 0,
        categoryId: p.category_id || undefined,
        categoryName: p.category?.name,
        categorySlug: p.category?.slug,
        occasionIds: (p.occasions || []).map(o => o.id),
        occasionNames: (p.occasions || []).map(o => o.name),
        occasionSlugs: (p.occasions || []).map(o => o.slug),
        tagIds: (p.tags || []).map(t => t.id),
        tagNames: (p.tags || []).map(t => t.name),
        tagSlugs: (p.tags || []).map(t => t.slug),
        segmentIds: (p.segments || []).map(s => s.id),
        segmentNames: (p.segments || []).map(s => s.name),
        segmentSlugs: (p.segments || []).map(s => s.slug),
      }));
  }, [dbProducts]);

  // Sidebar filter state (URL-synced)
  const [sideFilters, setSideFilters] = useCatalogFiltersFromUrl();
  const priceBounds = useMemo(() => priceBoundsFrom(products.map(p => ({ price: p.priceNum }))), [products]);

  // Filter products — text search + structural badges + sidebar filters (price/prazo/personalizável/tags-multi)
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const matchesText = (product: typeof products[number]) => !q ||
      product.name.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q) ||
      (product.longDescriptionRaw?.toLowerCase().includes(q) ?? false) ||
      product.keywords.some(k => k.toLowerCase().includes(q)) ||
      (product.categoryName?.toLowerCase().includes(q) ?? false) ||
      product.occasionNames.some(n => n.toLowerCase().includes(q)) ||
      product.tagNames.some(n => n.toLowerCase().includes(q)) ||
      product.segmentNames.some(n => n.toLowerCase().includes(q));

    const base = products.filter((product) => {
      const matchesCategory = !resolvedCategory || product.categoryId === resolvedCategory.id;
      const matchesOccasion = !resolvedOccasion || product.occasionIds.includes(resolvedOccasion.id);
      const matchesSegment = !resolvedSegment || product.segmentIds.includes(resolvedSegment.id);
      const matchesTag = !resolvedTag || product.tagIds.includes(resolvedTag.id);
      return matchesText(product) && matchesCategory && matchesOccasion && matchesSegment && matchesTag;
    });

    const sideAdapted = base.map((p) => ({
      id: p.id,
      price: p.priceNum,
      is_active: true,
      personalization_enabled: p.personalization_enabled,
      production_days: p.production_days,
      production_speed: p.production_speed,
      featured_weight: p.featured_weight,
      rating: p.rating,
      category: p.categorySlug ? { slug: p.categorySlug } : null,
      occasions: p.occasionSlugs.map((slug) => ({ slug })),
      tags: p.tagSlugs.map((slug) => ({ slug })),
      segments: p.segmentSlugs.map((slug) => ({ slug })),
      _orig: p,
    }));
    const filtered = applyCatalogFilters(sideAdapted, sideFilters);
    return sortByFeatured(filtered).map((x) => x._orig);
  }, [products, debouncedSearch, resolvedCategory, resolvedOccasion, resolvedSegment, resolvedTag, sideFilters]);

  // Counts per taxonomy (over all active products, not the filtered list — keeps UI predictable)
  const counts = useMemo(() => {
    const cat: Record<string, number> = {};
    const occ: Record<string, number> = {};
    const seg: Record<string, number> = {};
    for (const p of products) {
      if (p.categoryId) cat[p.categoryId] = (cat[p.categoryId] || 0) + 1;
      for (const id of p.occasionIds) occ[id] = (occ[id] || 0) + 1;
      for (const id of p.segmentIds) seg[id] = (seg[id] || 0) + 1;
    }
    return { cat, occ, seg };
  }, [products]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Generate pagination numbers
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    
    return pages;
  };

  // Build breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items = [
      { name: 'Início', url: 'https://emporiolelecute.com.br/' },
      { name: 'Produtos', url: 'https://emporiolelecute.com.br/produtos' },
    ];
    
    if (resolvedCategory) {
      items.push({ 
        name: resolvedCategory.name, 
        url: `https://emporiolelecute.com.br/produtos?categoria=${resolvedCategory.slug}` 
      });
    }
    
    if (resolvedOccasion) {
      items.push({ 
        name: resolvedOccasion.name, 
        url: `https://emporiolelecute.com.br/produtos?ocasiao=${resolvedOccasion.slug}` 
      });
    }
    
    return items;
  }, [resolvedCategory, resolvedOccasion]);

  // FAQ otimizada para keyword "sabonete personalizado lembrancinha"
  const faqItems = [
    {
      q: "Quanto custa um sabonete personalizado para lembrancinha?",
      a: "Nossos sabonetes personalizados para lembrancinha começam a partir de R$ 4,60 a unidade, dependendo do modelo, tamanho da embalagem e quantidade pedida. Quanto maior a quantidade, melhor o preço por unidade. Faça uma simulação no WhatsApp.",
    },
    {
      q: "Qual o pedido mínimo de sabonetes personalizados?",
      a: "Cada modelo tem um pedido mínimo (geralmente entre 10 e 30 unidades), informado na página do produto. Esse mínimo garante que conseguimos manter a qualidade artesanal e os preços acessíveis.",
    },
    {
      q: "Posso personalizar a embalagem com o nome do bebê ou tema da festa?",
      a: "Sim! Toda lembrancinha de sabonete pode ser personalizada com nome, data, cor da fita, aroma e tema (chá de bebê, maternidade, batizado, casamento, aniversário). Você envia as informações no checkout ou pelo WhatsApp.",
    },
    {
      q: "Qual o prazo de produção e envio das lembrancinhas?",
      a: "O prazo de produção é de 10 a 25 dias úteis após a confirmação do pagamento, dependendo da quantidade. O envio é feito pelos Correios (PAC ou Sedex) para todo o Brasil — você escolhe o frete no checkout.",
    },
    {
      q: "Os sabonetes artesanais usam ingredientes naturais?",
      a: "Sim. Trabalhamos com bases glicerinadas vegetais, essências importadas e corantes próprios para sabonetes. São produtos seguros para a pele, ideais para presentear convidados de qualquer idade.",
    },
    {
      q: "Vocês enviam para todo o Brasil?",
      a: "Sim, enviamos para todos os estados do Brasil. O cálculo do frete é feito automaticamente pelo CEP no momento do checkout, com opções de PAC e Sedex.",
    },
  ];

  // SEO copy otimizada (visível, indexável) — só na visão sem nenhum filtro
  const seoCopyVisible = !resolvedCategory && !resolvedOccasion && !resolvedSegment && !resolvedTag && !debouncedSearch;

  // === Anti-canibalização SEO ===
  // 0 filtros estruturais (+ sem tag/busca) -> indexável, canonical /produtos
  // 1 filtro estrutural (sem outros)        -> canonical para taxonomia oficial (não duplica)
  // 2+ filtros / tag / busca / paginação    -> noindex,follow + canonical /produtos
  const SITE = 'https://emporiolelecute.com.br';
  let canonicalUrl = `${SITE}/produtos`;
  let isIndexable = true;

  if (structuralCount === 1 && !resolvedTag && !debouncedSearch && currentPage === 1) {
    const only = structuralFilters[0]!;
    if (resolvedCategory) canonicalUrl = `${SITE}/categoria/${only.slug}`;
    else if (resolvedOccasion) canonicalUrl = `${SITE}/ocasiao/${only.slug}`;
    else if (resolvedSegment) canonicalUrl = `${SITE}/segmento/${only.slug}`;
  } else if (structuralCount >= 2 || resolvedTag || debouncedSearch || currentPage > 1) {
    isIndexable = false;
    canonicalUrl = `${SITE}/produtos`;
  }

  // Dynamic title/description
  const seoTitle = (() => {
    if (structuralCount >= 2 || resolvedTag) return "Produtos Personalizados | Empório LeleCute";
    if ((resolvedCategory as any)?.meta_title) return (resolvedCategory as any).meta_title;
    if ((resolvedOccasion as any)?.meta_title) return (resolvedOccasion as any).meta_title;
    if (resolvedSegment?.meta_title) return resolvedSegment.meta_title;
    if (resolvedCategory) return `${resolvedCategory.name} | Empório LeleCute`;
    if (resolvedOccasion) return `${resolvedOccasion.name} | Empório LeleCute`;
    if (resolvedSegment) return `${resolvedSegment.name} | Empório LeleCute`;
    if (debouncedSearch) return `Busca: ${debouncedSearch} | Empório LeleCute`;
    return "Produtos Artesanais Personalizados | Empório LeleCute";
  })();

  const seoDescription = (() => {
    if (structuralCount >= 2 || resolvedTag) return "Explore produtos artesanais personalizados por categoria, ocasião e segmento.";
    if ((resolvedCategory as any)?.meta_description) return (resolvedCategory as any).meta_description;
    if ((resolvedOccasion as any)?.meta_description) return (resolvedOccasion as any).meta_description;
    if (resolvedSegment?.meta_description) return resolvedSegment.meta_description;
    return "Sabonetes, lembrancinhas, brindes e presentes artesanais personalizados para maternidade, casamento, chá de bebê, batizado e eventos especiais.";
  })();

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO title={seoTitle} description={seoDescription} url={canonicalUrl} />
      {!isIndexable && (
        <Helmet>
          <meta name="robots" content="noindex,follow" />
        </Helmet>
      )}
      <BreadcrumbStructuredData items={breadcrumbItems} />

      {/* FAQPage JSON-LD para rich snippet no Google */}
      {seoCopyVisible && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            })}
          </script>
        </Helmet>
      )}

      <Header />

      <main className="pt-24 pb-16">
        {/* Hero Banner */}
        <section className="bg-gradient-to-r from-primary-light via-cream to-primary-light py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-dotted-pattern opacity-30" />
          <div className="container mx-auto px-4 relative z-10 text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-4">
              <ShoppingBag className="h-4 w-4" />
              {resolvedCategory ? resolvedCategory.name : "Catálogo Completo"}
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-4">
              {resolvedCategory ? (
                <>{resolvedCategory.name} <span className="text-primary">Artesanais</span></>
              ) : (
                <>Sabonete Personalizado <span className="text-primary">Lembrancinha</span></>
              )}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {resolvedCategory
                ? `Explore nossa coleção de ${resolvedCategory.name.toLowerCase()} artesanais, feitos à mão e personalizados para a sua ocasião.`
                : "Lembrancinhas artesanais com sabonetes, velas perfumadas e kits sob medida. Personalize com nome, tema e cores para chá de bebê, maternidade, batizado, casamento e aniversário."}
            </p>
          </div>
        </section>

        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link to="/" className="hover:text-primary transition-colors">Início</Link>
            <ChevronRight className="h-4 w-4" />
            {resolvedCategory || resolvedOccasion ? (
              <>
                <Link to="/produtos" className="hover:text-primary transition-colors">Produtos</Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">
                  {resolvedCategory?.name || resolvedOccasion?.name}
                </span>
              </>
            ) : (
              <span className="text-foreground">Produtos</span>
            )}
          </nav>
        </div>

        {/* Search + view toggle */}
        <div className="container mx-auto px-4 pt-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar lembrancinhas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="rounded-full"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-full"
              >
                <List className="h-4 w-4" />
              </Button>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-muted-foreground"
                >
                  Limpar ({activeFiltersCount})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Ocasiões — sempre visíveis (mobile + desktop), scroll horizontal no mobile */}
        <div className="container mx-auto px-4 mt-6">
          <h3 className="text-sm font-medium text-foreground mb-2">Ocasiões</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x scrollbar-thin">
            <Badge
              variant={!resolvedOccasion ? "default" : "outline"}
              className="cursor-pointer px-4 py-2 text-sm whitespace-nowrap snap-start flex-shrink-0"
              onClick={() => handleOccasionChange(null)}
            >
              Todas
            </Badge>
            {(dbOccasions || []).map((occasion) => (
              <Badge
                key={occasion.id}
                variant={resolvedOccasion?.id === occasion.id ? "default" : "outline"}
                className="cursor-pointer px-4 py-2 text-sm whitespace-nowrap snap-start flex-shrink-0"
                onClick={() => handleOccasionChange(occasion.slug)}
              >
                {occasion.slug === 'maternidade' ? '👶' :
                 occasion.slug === 'cha-bebe' ? '🍼' :
                 occasion.slug === 'batizado' ? '⛪' :
                 occasion.slug === 'casamento' ? '💒' :
                 occasion.slug === 'aniversario' ? '🎂' : '🏢'} {occasion.name}
                {counts.occ[occasion.id] ? <span className="ml-1 opacity-70">({counts.occ[occasion.id]})</span> : null}
              </Badge>
            ))}
          </div>
        </div>

        {/* Layout 2 colunas: aside (sidebar de filtros) + grid de produtos */}
        <div className="container mx-auto px-4 mt-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ASIDE — filtros (sidebar no desktop, encolhido no mobile/tablet) */}
            <aside className="lg:w-64 lg:flex-shrink-0">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="produtos-filtros-taxonomia"
                className="w-full inline-flex items-center justify-between gap-2 px-4 py-2 rounded-full
                           border border-border bg-card hover:bg-muted/60 text-sm font-medium
                           text-foreground transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5
                                     rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
                      {activeFiltersCount}
                    </span>
                  )}
                </span>
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {filtersOpen && (
                <div
                  id="produtos-filtros-taxonomia"
                  className="mt-4 space-y-6 lg:sticky lg:top-24
                             animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  {/* Categorias */}
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-3">Categorias</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={!resolvedCategory ? "default" : "outline"}
                        className="cursor-pointer px-3 py-1.5 text-xs"
                        onClick={() => handleCategoryChange(null)}
                      >
                        Todas
                      </Badge>
                      {(dbCategories || []).map((category) => (
                        <Badge
                          key={category.id}
                          variant={resolvedCategory?.id === category.id ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5 text-xs"
                          onClick={() => handleCategoryChange(category.slug)}
                        >
                          {category.slug === 'sabonetes' ? '🧼' : category.slug === 'velas' ? '🕯️' : category.slug === 'kits' ? '🎁' : '✨'} {category.name}
                          {counts.cat[category.id] ? <span className="ml-1 opacity-70">({counts.cat[category.id]})</span> : null}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Segmentos */}
                  {dbSegments && dbSegments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-3">Segmentos</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={!resolvedSegment ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5 text-xs"
                          onClick={() => handleSegmentChange(null)}
                        >
                          Todos
                        </Badge>
                        {dbSegments.map((segment) => (
                          <Badge
                            key={segment.id}
                            variant={resolvedSegment?.id === segment.id ? "default" : "outline"}
                            className="cursor-pointer px-3 py-1.5 text-xs"
                            onClick={() => handleSegmentChange(segment.slug)}
                          >
                            {segment.name}
                            {counts.seg[segment.id] ? <span className="ml-1 opacity-70">({counts.seg[segment.id]})</span> : null}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {dbTags && dbTags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={!resolvedTag ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5 text-xs"
                          onClick={() => handleTagChange(null)}
                        >
                          Todas
                        </Badge>
                        {dbTags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant={resolvedTag?.id === tag.id ? "default" : "outline"}
                            className="cursor-pointer px-3 py-1.5 text-xs"
                            onClick={() => handleTagChange(tag.slug)}
                          >
                            #{tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filtros avançados (preço, prazo, personalizável, multi-tags) */}
                  <div className="pt-2 border-t border-border">
                    <CatalogFilters
                      values={sideFilters}
                      onChange={setSideFilters}
                      occasions={dbOccasions}
                      categories={dbCategories}
                      tags={dbTags}
                      segments={dbSegments}
                      priceBounds={priceBounds}
                      totalCount={filteredProducts.length}
                    />
                  </div>
                </div>
              )}
            </aside>

            {/* MAIN — grid de produtos */}
            <div className="flex-1 min-w-0">
              {loadingProducts ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredProducts.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
                    {totalPages > 1 && ` • Página ${currentPage} de ${totalPages}`}
                  </p>
                  <div className={`grid gap-3 sm:gap-4 md:gap-6 ${
                    viewMode === "grid"
                      ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                      : "grid-cols-1 max-w-3xl mx-auto"
                  }`}>
                    {paginatedProducts.map((product, idx) => (
                      <ProductCard key={product.id} product={product} priority={idx < 2} />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-12">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            >
                              <ChevronLeft className="h-4 w-4" />
                              <span>Anterior</span>
                            </PaginationPrevious>
                          </PaginationItem>

                          {getPageNumbers().map((page, index) => (
                            <PaginationItem key={index}>
                              {page === 'ellipsis' ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  onClick={() => handlePageChange(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              )}
                            </PaginationItem>
                          ))}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            >
                              <span>Próxima</span>
                              <ChevronRight className="h-4 w-4" />
                            </PaginationNext>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16">
                  <p className="text-muted-foreground mb-4">
                    Nenhum produto encontrado
                    {(() => {
                      const parts = [
                        resolvedCategory?.name,
                        resolvedOccasion?.name,
                        resolvedSegment?.name,
                        resolvedTag?.name,
                        debouncedSearch ? `"${debouncedSearch}"` : null,
                      ].filter(Boolean);
                      return parts.length ? ` para: ${parts.join(' + ')}` : '';
                    })()}
                  </p>
                  <Button onClick={handleClearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEO Copy + FAQ — só na visão padrão (sem filtros) para evitar conteúdo duplicado */}
        {seoCopyVisible && (
          <>
            <section className="container mx-auto px-4 mt-20">
              <div className="max-w-4xl mx-auto">
                <h2 className="font-display text-3xl md:text-4xl text-foreground mb-6 text-center">
                  Por que escolher um sabonete personalizado como lembrancinha?
                </h2>
                <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
                  <p>
                    O <strong>sabonete personalizado lembrancinha</strong> se tornou um dos
                    presentes mais queridos por mães, noivas e anfitriãs que buscam algo
                    além do óbvio. Útil, perfumado e com embalagem feita à mão, ele
                    transforma uma simples lembrança em um detalhe que os convidados
                    levam para casa e realmente usam.
                  </p>
                  <p>
                    No Empório LeleCute, cada sabonete é produzido artesanalmente com
                    base glicerinada vegetal, essências importadas e moldes exclusivos
                    em formatos como margarida, balão, fundo do mar, ursinho e muitos
                    outros. Você escolhe o aroma, a cor da fita, o texto da tag e o tema
                    da embalagem — perfeito para <em>chá de bebê</em>, <em>maternidade</em>,
                    <em> batizado</em>, <em>casamento</em> e <em>aniversário</em>.
                  </p>

                  <div className="grid md:grid-cols-3 gap-6 not-prose mt-10">
                    <div className="text-center p-6 rounded-2xl bg-cream/50">
                      <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="font-display text-lg text-foreground mb-2">100% Personalizado</h3>
                      <p className="text-sm text-muted-foreground">Nome, tema, cor e aroma escolhidos por você.</p>
                    </div>
                    <div className="text-center p-6 rounded-2xl bg-cream/50">
                      <Heart className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="font-display text-lg text-foreground mb-2">Feito à mão</h3>
                      <p className="text-sm text-muted-foreground">Cada peça produzida com carinho no nosso ateliê.</p>
                    </div>
                    <div className="text-center p-6 rounded-2xl bg-cream/50">
                      <Truck className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="font-display text-lg text-foreground mb-2">Envio Brasil</h3>
                      <p className="text-sm text-muted-foreground">PAC e Sedex para todos os estados.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="container mx-auto px-4 mt-20">
              <div className="max-w-3xl mx-auto">
                <h2 className="font-display text-3xl md:text-4xl text-foreground mb-8 text-center">
                  Perguntas frequentes sobre sabonetes personalizados
                </h2>
                <div className="space-y-4">
                  {faqItems.map((f, i) => (
                    <details
                      key={i}
                      className="group bg-card border border-border rounded-2xl p-5 transition-all hover:border-primary/40"
                    >
                      <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-foreground">
                        <span className="pr-4">{f.q}</span>
                        <ChevronRight className="h-5 w-5 text-primary shrink-0 transition-transform group-open:rotate-90" />
                      </summary>
                      <p className="mt-4 text-muted-foreground leading-relaxed">{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* INTERLINK SILO — Explore por ocasião */}
        {seoCopyVisible && (
          <section className="container mx-auto px-4 mt-20">
            <div className="max-w-5xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl text-foreground mb-3 text-center">
                Explore lembrancinhas por ocasião
              </h2>
              <p className="text-center text-muted-foreground mb-10">
                Páginas dedicadas com modelos, dicas e prazos por evento.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { slug: "maternidade", title: "Maternidade", desc: "Kits para visitas ao bebê" },
                  { slug: "cha-de-bebe", title: "Chá de Bebê", desc: "Sabonetes personalizados" },
                  { slug: "cha-revelacao", title: "Chá Revelação", desc: "Azul, rosa ou neutro" },
                  { slug: "batizado", title: "Batizado", desc: "Lembranças religiosas" },
                  { slug: "aniversario-infantil", title: "Aniversário Infantil", desc: "Por tema da festa" },
                  { slug: "formatura", title: "Formatura", desc: "Kits elegantes" },
                ].map((item) => (
                  <Link
                    key={item.slug}
                    to={`/lembrancinhas-${item.slug}`}
                    className="group block bg-card rounded-2xl p-5 border border-border/50 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <h3 className="font-display text-base text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    <span className="inline-flex items-center gap-1 text-primary text-xs font-medium mt-3 group-hover:gap-2 transition-all">
                      Ver página
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-8">
                <Link
                  to="/blog"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Leia também tutoriais e dicas no blog →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* HUB SEMÂNTICO — interlinking para páginas canônicas */}
        <section className="container mx-auto px-4 mt-20">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            {(dbCategories || []).length > 0 && (
              <div>
                <h2 className="font-display text-xl text-foreground mb-4">Comprar por categoria</h2>
                <ul className="space-y-2">
                  {(dbCategories || []).slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <Link to={`/categoria/${c.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {c.name}{counts.cat[c.id] ? <span className="ml-1 opacity-60">({counts.cat[c.id]})</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(dbOccasions || []).length > 0 && (
              <div>
                <h2 className="font-display text-xl text-foreground mb-4">Comprar por ocasião</h2>
                <ul className="space-y-2">
                  {(dbOccasions || []).slice(0, 8).map((o) => (
                    <li key={o.id}>
                      <Link to={`/ocasiao/${o.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {o.name}{counts.occ[o.id] ? <span className="ml-1 opacity-60">({counts.occ[o.id]})</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(dbSegments || []).length > 0 && (
              <div>
                <h2 className="font-display text-xl text-foreground mb-4">Comprar por segmento</h2>
                <ul className="space-y-2">
                  {(dbSegments || []).slice(0, 8).map((s) => (
                    <li key={s.id}>
                      <Link to={`/segmento/${s.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {s.name}{counts.seg[s.id] ? <span className="ml-1 opacity-60">({counts.seg[s.id]})</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* WhatsApp CTA — otimizado para conversão */}
        <div className="container mx-auto px-4 mt-20">
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-3xl p-8 md:p-12 text-center text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 bg-dotted-pattern opacity-10" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-foreground/15 rounded-full text-primary-foreground text-sm font-medium mb-4">
                <MessageCircle className="h-4 w-4" />
                Atendimento direto com a artesã
              </span>
              <h2 className="font-display text-3xl md:text-4xl mb-4">
                Quer um sabonete personalizado lembrancinha do seu jeito?
              </h2>
              <p className="text-primary-foreground/85 mb-8 max-w-xl mx-auto text-lg">
                Tema exclusivo, cor da fita, aroma especial ou quantidade fora do padrão —
                fale agora pelo WhatsApp e receba seu orçamento em minutos.
              </p>
              <a
                href="https://wa.me/5541992214299?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20quero%20um%20or%C3%A7amento%20de%20sabonete%20personalizado%20lembrancinha."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Button
                  size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full text-base font-semibold px-8 h-12 shadow-lg"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Falar no WhatsApp agora
                </Button>
              </a>
              <p className="text-primary-foreground/70 text-sm mt-4">
                Resposta em até 1 hora • Seg a Sex, 9h–18h
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
      <WhatsAppButton />
      <Chatbot />
    </div>
  );
};

export default Produtos;
