import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Star, ArrowRight, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/data/products";
import { optimizeImage, buildSrcSet } from "@/lib/image";
import { getProductionSpeed, speedLabel } from "@/lib/productMeta";
import { urls } from "@/lib/urls";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

const ProductCard = ({ product, priority = false }: ProductCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: ""
  });
  const { toast } = useToast();

  // Sprint 2 — Badge neutra e silenciosa (editorial). Mantém apenas tipografia,
  // sem competir cromaticamente com a PDP refinada.
  const getBadgeStyles = (_badge?: string) =>
    "bg-background/90 backdrop-blur-sm text-foreground border border-border/50";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.functions.invoke("send-order-email", {
        body: {
          ...formData,
          product: product.name,
          type: "product"
        }
      });

      if (error) throw error;

      toast({
        title: "Pedido enviado! 🎉",
        description: "Entraremos em contato em breve pelo WhatsApp.",
      });
      setIsOpen(false);
      setFormData({ name: "", email: "", whatsapp: "" });
    } catch (error) {
      console.error("Error sending order:", error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente ou entre em contato pelo WhatsApp.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <article
      className="min-w-0 max-w-full bg-card rounded-xl sm:rounded-2xl overflow-hidden border border-border/40 product-card group transition-colors duration-300 hover:border-border"
      itemScope
      itemType="https://schema.org/Product"
    >
      {/* Product Image */}
      <Link to={urls.product(product.slug)} className="block relative aspect-[4/5] max-w-full overflow-hidden bg-muted">
        <img 
          src={optimizeImage(product.image, { width: 600, resize: "contain" })}
          srcSet={buildSrcSet(product.image, [300, 450, 600, 800], 75, "contain")}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
          alt={`${product.name} - Lembrancinha artesanal personalizada Empório LeleCute`}
          className="w-full h-full object-contain p-2 opacity-0 [&.loaded]:opacity-100"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          // @ts-expect-error fetchpriority is a valid HTML attribute
          fetchpriority={priority ? "high" : "auto"}
          itemProp="image"
          width="600"
          height="750"
          onLoad={(e) => e.currentTarget.classList.add('loaded')}
          onError={(e) => {
            e.currentTarget.src = '/placeholder.svg';
            e.currentTarget.removeAttribute('srcset');
          }}
          style={{ transition: 'opacity 400ms ease' }}
        />
        
        {/* Badge — pílula neutra, sem cor saturada */}
        {product.badge && (
          <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-medium ${getBadgeStyles(product.badge)}`}>
            {product.badge}
          </span>
        )}

        {/* Favorite Button — sem shadow, sem hover coral agressivo */}
        <button
          onClick={(e) => e.preventDefault()}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 w-9 h-9 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Adicionar aos favoritos"
        >
          <Heart className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
        </button>
      </Link>
      
      {/* Product Info */}
      <div className="p-3 md:p-5">
        {/* Rating — inline discreto, sem amarelo marketplace */}
        <div className="flex items-center gap-1 mb-2 text-muted-foreground" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
          <meta itemProp="ratingValue" content={String(product.rating)} />
          <meta itemProp="ratingCount" content="1" />
          <meta itemProp="reviewCount" content="1" />
          <meta itemProp="bestRating" content="5" />
          <Star className="h-3 w-3 fill-current" strokeWidth={0} />
          <span className="text-[10px] md:text-xs">{product.rating.toFixed(1)}</span>
        </div>

        {/* Name — peso leve, sem hover coral */}
        <Link to={urls.product(product.slug)}>
          <h3 className="font-display text-sm md:text-lg font-normal text-foreground mb-2 line-clamp-2 leading-snug" itemProp="name">
            {product.name}
          </h3>
        </Link>

        {/* Price — foreground calmo, sem coral saturado */}
        <div className="flex flex-wrap items-baseline gap-2 mb-1" itemProp="offers" itemScope itemType="https://schema.org/Offer">
          <span className="text-base md:text-xl font-display font-normal text-foreground">{product.price}</span>
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">{product.originalPrice}</span>
          )}
          {typeof product.priceValue === "number" && (
            <meta itemProp="price" content={Number(product.priceValue).toFixed(2)} />
          )}
          <meta itemProp="priceCurrency" content="BRL" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
        </div>

        {/* Quick info row */}
        {(() => {
          const speed = getProductionSpeed({
            production_days: product.production_days,
            production_speed: product.production_speed,
          });
          const minQty = product.min_quantity && product.min_quantity > 1 ? product.min_quantity : null;
          const personalizable = !!product.personalization_enabled;
          if (!speed && !minQty && !personalizable) return null;
          return (
            <ul className="mt-2 mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] md:text-xs text-muted-foreground">
              {minQty && (
                <li className="inline-flex items-center gap-1">
                  <span aria-hidden>•</span> Mín. {minQty} un.
                </li>
              )}
              {speed && (
                <li className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden /> {speedLabel(speed)}
                </li>
              )}
              {personalizable && (
                <li className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" aria-hidden /> Personalizável
                </li>
              )}
            </ul>
          );
        })()}

        {/* CTA — link editorial, sem affordance ecommerce */}
        <Link
          to={urls.product(product.slug)}
          className="inline-flex items-center gap-1 mt-3 text-xs md:text-sm text-foreground/80 hover:text-foreground border-b border-border/60 hover:border-foreground/60 pb-0.5 transition-colors"
        >
          Ver detalhes
          <ArrowRight className="h-3 w-3 md:h-3.5 md:w-3.5" strokeWidth={1.5} />
        </Link>

        {/* Hidden order dialog (kept for backward compat, triggered elsewhere) */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Encomendar {product.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-foreground">Nome completo</label>
                <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Seu nome" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="seu@email.com" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">WhatsApp</label>
                <Input required value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(41) 99999-9999" className="mt-1" />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary-dark text-primary-foreground rounded-full" disabled={isLoading}>
                {isLoading ? "Enviando..." : "Enviar Pedido"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Entraremos em contato para confirmar os detalhes</p>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </article>
  );
};

// Wrap with memo to prevent unnecessary re-renders when filtering products
const ProductCardMemo = React.memo(ProductCard);
export default ProductCardMemo;
