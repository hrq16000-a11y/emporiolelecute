import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/ProductCard";
import { sortByFeatured } from "@/lib/catalogFilter";
import type { Product } from "@/data/products";

interface MiniTax { id: string; name: string; slug: string }

interface Props {
  currentProductId: string;
  occasions?: MiniTax[];
  tags?: MiniTax[];
  category?: MiniTax | null;
  limit?: number;
}

const PRODUCT_FIELDS =
  "id, slug, name, description, price, original_price, images, badge, rating, min_quantity, keywords, is_active, created_at, featured_weight, production_days, personalization_enabled, category_id";

interface Row {
  id: string; slug: string; name: string; description: string | null; price: number;
  original_price: number | null; images: string[]; badge: string | null; rating: number;
  min_quantity: number; keywords: string[]; is_active: boolean; created_at: string;
  featured_weight: number | null; production_days: number | null;
  personalization_enabled: boolean | null; category_id: string | null;
}

function toCardProduct(p: Row): Product {
  return {
    id: p.id, slug: p.slug, name: p.name, description: p.description || "",
    price: `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`,
    priceValue: Number(p.price),
    originalPrice: p.original_price ? `R$ ${Number(p.original_price).toFixed(2).replace(".", ",")}` : undefined,
    image: p.images?.[0] || "/placeholder.svg",
    images: p.images ?? [], link: "", badge: p.badge || undefined,
    rating: Math.round(p.rating ?? 5), category: "outros" as const,
    occasions: [], keywords: p.keywords ?? [], min_quantity: p.min_quantity || undefined,
    personalization_enabled: p.personalization_enabled ?? undefined,
    production_days: p.production_days ?? undefined,
  };
}

/**
 * Smart related products with cascade priority:
 *   1. ocasião  →  2. tags  →  3. categoria  →  4. deterministic fallback (recent active)
 * Always excludes current product. Orders by featured_weight (then rating, then id).
 */
const RelatedSmart = ({ currentProductId, occasions, tags, category, limit = 8 }: Props) => {
  const occIds = (occasions || []).map((o) => o.id);
  const tagIds = (tags || []).map((t) => t.id);
  const categoryId = category?.id || null;

  type Reason = "ocasiao" | "tags" | "categoria" | "popular";
  const REASON_LABEL: Record<Reason, string> = {
    ocasiao: "Mesma ocasião",
    tags: "Combina com este produto",
    categoria: "Mesma categoria",
    popular: "Clientes também pediram",
  };

  const { data } = useQuery({
    queryKey: ["related-smart", currentProductId, occIds, tagIds, categoryId, limit],
    staleTime: 60_000,
    queryFn: async () => {
      const collected = new Map<string, Row & { _reason: Reason }>();
      const perCategoryCount = new Map<string, number>();
      const MAX_PER_CATEGORY = Math.max(2, Math.ceil(limit / 2));

      const tryAdd = (p: Row, reason: Reason) => {
        if (collected.has(p.id)) return false;
        if (collected.size >= limit) return false;
        const cat = p.category_id || "_none";
        const used = perCategoryCount.get(cat) || 0;
        // Aplicar limite por categoria apenas enquanto ainda há outras categorias possíveis
        if (used >= MAX_PER_CATEGORY && collected.size + (limit - collected.size) > MAX_PER_CATEGORY) {
          return false;
        }
        collected.set(p.id, { ...p, _reason: reason });
        perCategoryCount.set(cat, used + 1);
        return true;
      };

      const need = () => limit - collected.size;

      // 1) Ocasiões
      if (occIds.length && need() > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows } = await (supabase.from("product_occasions") as any)
          .select(`product:products(${PRODUCT_FIELDS})`)
          .in("occasion_id", occIds);
        const items = ((rows as Array<{ product: Row | null }> | null) ?? [])
          .map((r) => r.product)
          .filter((p): p is Row => !!p && p.is_active && p.id !== currentProductId);
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "ocasiao");
        }
      }

      // 2) Tags
      if (tagIds.length && need() > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows } = await (supabase.from("product_tags") as any)
          .select(`product:products(${PRODUCT_FIELDS})`)
          .in("tag_id", tagIds);
        const items = ((rows as Array<{ product: Row | null }> | null) ?? [])
          .map((r) => r.product)
          .filter((p): p is Row => !!p && p.is_active && p.id !== currentProductId);
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "tags");
        }
      }

      // 3) Categoria
      if (categoryId && need() > 0) {
        const { data: rows } = await supabase
          .from("products")
          .select(PRODUCT_FIELDS)
          .eq("is_active", true)
          .eq("category_id", categoryId)
          .neq("id", currentProductId);
        const items = ((rows as Row[] | null) ?? []);
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "categoria");
        }
      }

      // 4) Fallback determinístico
      if (need() > 0) {
        const { data: rows } = await supabase
          .from("products")
          .select(PRODUCT_FIELDS)
          .eq("is_active", true)
          .neq("id", currentProductId)
          .order("featured_weight", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit * 3);
        const items = ((rows as Row[] | null) ?? []);
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "popular");
        }
      }

      return { items: [...collected.values()].slice(0, limit), reasonLabel: REASON_LABEL };
    },
  });

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  // Pick the strongest taxonomy for the "ver todos" link
  const primary = occasions?.[0]
    ? { prefix: "/ocasiao", t: occasions[0], label: "Mais para esta ocasião" }
    : tags?.[0]
    ? { prefix: "/tag", t: tags[0], label: "Produtos relacionados" }
    : category
    ? { prefix: "/categoria", t: category, label: "Mais nesta categoria" }
    : null;

  return (
    <section className="mb-12 max-w-full overflow-hidden">
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div className="space-y-1">
          <h2 className="font-display text-2xl text-foreground">
            {primary?.label ?? "Você também pode gostar"}
          </h2>
          {primary && (
            <p className="text-sm text-muted-foreground">
              Selecionados a partir de{" "}
              <Link to={`${primary.prefix}/${primary.t.slug}`} className="text-primary hover:underline font-medium">
                {primary.t.name}
              </Link>
            </p>
          )}
        </div>
        {primary && (
          <Link
            to={`${primary.prefix}/${primary.t.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {items.map((p) => (
          <div key={p.id} className="relative min-w-0">
            <span className="absolute z-10 top-2 left-2 max-w-[calc(100%-1rem)] truncate text-[10px] uppercase bg-background/90 backdrop-blur text-foreground/80 px-2 py-0.5 rounded-full border shadow-sm">
              {data!.reasonLabel[p._reason]}
            </span>
            <ProductCard product={toCardProduct(p)} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default RelatedSmart;
