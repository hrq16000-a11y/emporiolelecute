import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sortByFeatured } from "@/lib/catalogFilter";
import { optimizeImage } from "@/lib/image";
import { urls } from "@/lib/urls";

interface MiniTax { id: string; name: string; slug: string }

interface Props {
  currentProductId: string;
  occasions?: MiniTax[];
  limit?: number;
}

const FIELDS = "id, slug, name, price, images, is_active, featured_weight, rating, created_at, category_id";

interface Row {
  id: string; slug: string; name: string; price: number; images: string[]; is_active: boolean;
  featured_weight: number | null; rating: number; created_at: string; category_id: string | null;
}

/**
 * "Fica lindo combinado com" — moodboard visual.
 * Pega produtos da mesma coleção/ocasião, priorizando estética (imagens),
 * sem CTA por item — convida à navegação.
 */
export default function VisualComposition({ currentProductId, occasions, limit = 6 }: Props) {
  const occIds = (occasions || []).map((o) => o.id);

  const { data } = useQuery({
    queryKey: ["visual-composition", currentProductId, occIds, limit],
    staleTime: 60_000,
    queryFn: async () => {
      const collected = new Map<string, Row>();

      // 1) Coleções compartilhadas
      const { data: colRows } = await (supabase as any)
        .from("collection_products")
        .select("collection_id")
        .eq("product_id", currentProductId);
      const collectionIds = ((colRows as any[]) || []).map((r) => r.collection_id).filter(Boolean);
      if (collectionIds.length) {
        const { data: siblings } = await (supabase as any)
          .from("collection_products")
          .select(`product:products(${FIELDS})`)
          .in("collection_id", collectionIds);
        const items = ((siblings as Array<{ product: Row | null }> | null) || [])
          .map((r) => r.product)
          .filter((p): p is Row => !!p && p.is_active && p.id !== currentProductId && (p.images?.length ?? 0) > 0);
        for (const p of sortByFeatured(items)) {
          if (collected.size >= limit) break;
          collected.set(p.id, p);
        }
      }

      // 2) Ocasiões compartilhadas
      if (occIds.length && collected.size < limit) {
        const { data: rows } = await (supabase as any)
          .from("product_occasions")
          .select(`product:products(${FIELDS})`)
          .in("occasion_id", occIds);
        const items = ((rows as Array<{ product: Row | null }> | null) || [])
          .map((r) => r.product)
          .filter((p): p is Row => !!p && p.is_active && p.id !== currentProductId && (p.images?.length ?? 0) > 0);
        for (const p of sortByFeatured(items)) {
          if (collected.size >= limit) break;
          if (!collected.has(p.id)) collected.set(p.id, p);
        }
      }

      return [...collected.values()].slice(0, limit);
    },
    enabled: !!currentProductId,
  });

  const items = data ?? [];
  if (items.length < 3) return null; // não vale mostrar moodboard pequeno

  return (
    <section className="mb-12" aria-labelledby="visual-comp-title">
      <h2 id="visual-comp-title" className="font-display text-xl text-foreground mb-1">
        Fica lindo combinado com
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Composição visual sugerida para a mesma ocasião.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
        {items.map((p, i) => (
          <Link
            key={p.id}
            to={urls.product(p.slug)}
            className="group relative block aspect-square rounded-xl overflow-hidden bg-muted"
            title={p.name}
          >
            <img
              src={optimizeImage(p.images[0], { width: 400 })}
              alt={p.name}
              width={400}
              height={400}
              className="absolute inset-0 m-auto max-w-full max-h-full w-auto h-auto object-contain group-hover:scale-[1.04] transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
              <span className="text-white text-xs font-medium line-clamp-2 drop-shadow">{p.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
