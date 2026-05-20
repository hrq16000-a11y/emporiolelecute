import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageCircle, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sortByFeatured } from "@/lib/catalogFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useContactInfo } from "@/hooks/useContactInfo";
import { buildWhatsAppUrl, trackWhatsAppClick } from "@/lib/analytics";
import { optimizeImage } from "@/lib/image";
import { urls } from "@/lib/urls";
import { toast } from "@/hooks/use-toast";

interface MiniTax { id: string; name: string; slug: string }

interface Props {
  currentProductId: string;
  currentProductSlug: string;
  occasions?: MiniTax[];
  tags?: MiniTax[];
  categoryId?: string | null;
  limit?: number;
}

const FIELDS =
  "id, slug, name, price, original_price, images, min_quantity, is_active, featured_weight, rating, created_at, category_id";

interface Row {
  id: string; slug: string; name: string; price: number; original_price: number | null;
  images: string[]; min_quantity: number; is_active: boolean; featured_weight: number | null;
  rating: number; created_at: string; category_id: string | null;
}

type Reason = "collection" | "occasion" | "tags" | "popular";
const REASON_LABEL: Record<Reason, string> = {
  collection: "Combina com este produto",
  occasion: "Muito pedido junto",
  tags: "Kit complementar",
  popular: "Clientes também pediram",
};

/**
 * "Complete o kit" — cross-sell contextual.
 * Cascata de prioridade:
 *   1. Coleções a que o produto pertence (siblings da mesma coleção)
 *   2. Ocasiões compartilhadas (de outra categoria, evitando duplicar mesmo tipo)
 *   3. Tags compartilhadas
 *   4. Fallback determinístico (featured_weight)
 * Sempre exclui o produto atual e tenta diversificar por categoria.
 */
export default function CrossSellComplete({
  currentProductId,
  currentProductSlug,
  occasions,
  tags,
  categoryId,
  limit = 4,
}: Props) {
  const { addItem } = useCart();
  const { whatsappNumber } = useContactInfo();
  const phone = (whatsappNumber || "5541992214299").replace(/\D/g, "");

  const occIds = (occasions || []).map((o) => o.id);
  const tagIds = (tags || []).map((t) => t.id);

  const { data } = useQuery({
    queryKey: ["cross-sell-complete", currentProductId, occIds, tagIds, categoryId, limit],
    staleTime: 60_000,
    queryFn: async () => {
      const collected = new Map<string, Row & { _reason: Reason }>();
      const tryAdd = (p: Row, reason: Reason, preferDifferentCategory = false) => {
        if (collected.has(p.id)) return;
        if (collected.size >= limit) return;
        if (preferDifferentCategory && categoryId && p.category_id === categoryId) {
          // Pula no primeiro passo; pode ser readicionado depois
          return;
        }
        collected.set(p.id, { ...p, _reason: reason });
      };
      const need = () => limit - collected.size;

      // 1) Coleções que contêm o produto atual → outros itens dessas coleções
      const { data: colRows } = await (supabase as any)
        .from("collection_products")
        .select("collection_id")
        .eq("product_id", currentProductId);
      const collectionIds = ((colRows as any[]) || []).map((r) => r.collection_id).filter(Boolean);
      if (collectionIds.length && need() > 0) {
        const { data: siblings } = await (supabase as any)
          .from("collection_products")
          .select(`product:products(${FIELDS})`)
          .in("collection_id", collectionIds);
        const items = ((siblings as Array<{ product: Row | null }> | null) || [])
          .map((r) => r.product)
          .filter((p): p is Row => !!p && p.is_active && p.id !== currentProductId);
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "collection");
        }
      }

      // 2) Ocasiões compartilhadas, preferindo categoria diferente
      if (occIds.length && need() > 0) {
        const { data: rows } = await (supabase as any)
          .from("product_occasions")
          .select(`product:products(${FIELDS})`)
          .in("occasion_id", occIds);
        const items = ((rows as Array<{ product: Row | null }> | null) || [])
          .map((r) => r.product)
          .filter((p): p is Row => !!p && p.is_active && p.id !== currentProductId);
        // primeiro passo: categoria diferente
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "occasion", true);
        }
        // segundo passo: completa com mesma categoria, se faltar
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "occasion");
        }
      }

      // 3) Tags compartilhadas
      if (tagIds.length && need() > 0) {
        const { data: rows } = await (supabase as any)
          .from("product_tags")
          .select(`product:products(${FIELDS})`)
          .in("tag_id", tagIds);
        const items = ((rows as Array<{ product: Row | null }> | null) || [])
          .map((r) => r.product)
          .filter((p): p is Row => !!p && p.is_active && p.id !== currentProductId);
        for (const p of sortByFeatured(items)) {
          if (need() <= 0) break;
          tryAdd(p, "tags");
        }
      }

      // 4) Fallback determinístico
      if (need() > 0) {
        const { data: rows } = await supabase
          .from("products")
          .select(FIELDS)
          .eq("is_active", true)
          .neq("id", currentProductId)
          .order("featured_weight", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit * 3);
        for (const p of sortByFeatured((rows as Row[] | null) || [])) {
          if (need() <= 0) break;
          tryAdd(p, "popular");
        }
      }

      return [...collected.values()].slice(0, limit);
    },
    enabled: !!currentProductId,
  });

  const items = data ?? [];
  if (items.length === 0) return null;

  const handleAdd = (p: Row) => {
    addItem({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: Number(p.price),
      image: p.images?.[0] || "/placeholder.svg",
      minQuantity: p.min_quantity || 1,
    });
  };

  const handleWhatsAppItem = (p: Row) => {
    const msg =
      `Olá! Estou montando um kit a partir do produto *${currentProductSlug}* e gostaria de incluir também: *${p.name}* (qtd ${p.min_quantity || 1}).\n\n` +
      `🔗 ${urls.productShare(p.slug)}\n\n` +
      `Poderia me passar valor e frete?`;
    const url = buildWhatsAppUrl({
      phone,
      message: msg,
      utm_source: "pdp",
      utm_medium: "cross_sell",
      utm_campaign: `complete_kit_${currentProductSlug}`,
      utm_content: p.slug,
    });
    trackWhatsAppClick({ source: "cross_sell" as any, context: p.slug, utm_campaign: `complete_kit_${currentProductSlug}` });
    window.open(url, "_blank", "noopener,noreferrer");
    toast({ title: "Abrindo WhatsApp", description: `Item: ${p.name}` });
  };

  return (
    <section className="mb-10 max-w-full overflow-hidden" aria-labelledby="cross-sell-title">
      <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 id="cross-sell-title" className="font-display text-xl text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Complete o kit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestões que combinam — monte uma composição completa para a ocasião.
          </p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((p) => (
          <div key={p.id} className="group min-w-0 rounded-xl border bg-card overflow-hidden flex flex-col">
            <Link to={urls.product(p.slug)} className="block relative max-w-full overflow-hidden">
              <img
                src={optimizeImage(p.images?.[0] || "/placeholder.svg", { width: 320 })}
                alt={p.name}
                className="w-full max-w-full aspect-[4/5] object-cover bg-muted sm:group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <Badge
                variant="secondary"
                className="absolute top-2 left-2 max-w-[calc(100%-1rem)] truncate text-[10px] bg-background/90 backdrop-blur border"
              >
                {REASON_LABEL[p._reason]}
              </Badge>
            </Link>
            <div className="p-3 flex-1 flex flex-col gap-2">
              <Link to={urls.product(p.slug)} className="block hover:text-primary transition-colors">
                <p className="text-sm font-medium line-clamp-2 leading-snug">{p.name}</p>
              </Link>
              <p className="text-sm font-semibold text-foreground">
                R$ {Number(p.price).toFixed(2).replace(".", ",")}
              </p>
              <div className="mt-auto flex min-w-0 gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-w-0 flex-1 h-8 px-2 text-xs"
                  onClick={() => handleAdd(p)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-2 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleWhatsAppItem(p)}
                  aria-label="Enviar junto no WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
