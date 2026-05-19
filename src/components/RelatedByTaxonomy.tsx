import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/data/products";

type Kind = "categoria" | "ocasiao" | "segmento";

interface Props {
  kind: Kind;
  taxonomyId: string;
  taxonomySlug: string;
  taxonomyName: string;
  excludeProductId: string;
  /** Optional editorial mini description (from category/occasion/segment.description) */
  description?: string | null;
  limit?: number;
}

const CONFIG: Record<Kind, { hub: string; label: string; routePrefix: string }> = {
  categoria: { hub: "Categoria",  label: "Mais nesta categoria",          routePrefix: "/categoria" },
  ocasiao:   { hub: "Ocasião",    label: "Mais para esta ocasião",         routePrefix: "/ocasiao"   },
  segmento:  { hub: "Segmento",   label: "Produtos relacionados neste segmento", routePrefix: "/segmento"  },
};

const PRODUCT_FIELDS =
  "id, slug, name, description, price, original_price, images, badge, rating, min_quantity, keywords, is_active, created_at";

const RelatedByTaxonomy = ({
  kind, taxonomyId, taxonomySlug, taxonomyName, excludeProductId, description, limit = 4,
}: Props) => {
  const { data: products } = useQuery({
    queryKey: ["related-by-taxonomy", kind, taxonomyId, excludeProductId],
    enabled: !!taxonomyId,
    queryFn: async (): Promise<Product[]> => {
      let rows: Array<{
        id: string; slug: string; name: string; description: string | null; price: number;
        original_price: number | null; images: string[]; badge: string | null; rating: number;
        min_quantity: number; keywords: string[]; is_active: boolean; created_at: string;
      }> = [];

      if (kind === "categoria") {
        const { data, error } = await supabase
          .from("products")
          .select(PRODUCT_FIELDS)
          .eq("is_active", true)
          .eq("category_id", taxonomyId)
          .neq("id", excludeProductId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        rows = data ?? [];
      } else {
        const joinTable = kind === "ocasiao" ? "product_occasions" : "product_segments";
        const joinCol = kind === "ocasiao" ? "occasion_id" : "segment_id";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from(joinTable) as any)
          .select(`product:products(${PRODUCT_FIELDS})`)
          .eq(joinCol, taxonomyId);
        if (error) throw error;
        rows = ((data as Array<{ product: typeof rows[number] | null }> | null) ?? [])
          .map((r) => r.product)
          .filter((p): p is NonNullable<typeof rows[number]> => !!p && p.is_active && p.id !== excludeProductId)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, limit);
      }

      return rows.map((p) => ({
        id: p.id, slug: p.slug, name: p.name, description: p.description || "",
        price: `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`,
        priceValue: Number(p.price),
        originalPrice: p.original_price ? `R$ ${Number(p.original_price).toFixed(2).replace(".", ",")}` : undefined,
        image: p.images?.[0] || "/placeholder.svg",
        images: p.images ?? [], link: "", badge: p.badge || undefined,
        rating: Math.round(p.rating ?? 5), category: "outros" as const,
        occasions: [], keywords: p.keywords ?? [], min_quantity: p.min_quantity || undefined,
      }));
    },
  });

  if (!products || products.length === 0) return null;
  const cfg = CONFIG[kind];

  return (
    <section className="mb-12">
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div className="space-y-1">
          <h2 className="font-display text-2xl text-foreground">{cfg.label}</h2>
          <p className="text-sm text-muted-foreground">
            {description ? description : `${cfg.hub}: `}
            {description && " "}
            <Link to={`${cfg.routePrefix}/${taxonomySlug}`} className="text-primary hover:underline font-medium">
              {taxonomyName}
            </Link>
          </p>
        </div>
        <Link
          to={`${cfg.routePrefix}/${taxonomySlug}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Ver todos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
};

export default RelatedByTaxonomy;
