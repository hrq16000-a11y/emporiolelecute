import { Link } from "react-router-dom";
import { ShoppingCart, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/stores/cartStore";
import { formatBRL } from "@/lib/format";
import { optimizeImage } from "@/lib/image";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  iconClassName?: string;
  badgeClassName?: string;
  compact?: boolean;
}

// Mini-carrinho com popover — mostra últimos itens, total e atalho para o carrinho.
const MiniCart = ({ className, iconClassName, badgeClassName, compact = false }: Props) => {
  const { items, itemCount, total, removeItem } = useCart();
  const last = items.slice(-4).reverse();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative p-2 text-foreground/80 hover:text-primary transition-colors group/cart",
            className
          )}
          aria-label={`Carrinho de compras${itemCount > 0 ? ` com ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}` : ' vazio'}`}
        >
          <ShoppingCart
            className={cn(
              "h-5 w-5 transition-transform group-hover/cart:scale-110",
              iconClassName
            )}
          />
          {itemCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center animate-in zoom-in duration-300",
                compact && "-top-0.5 -right-0.5 h-4 w-4",
                badgeClassName
              )}
              aria-hidden="true"
            >
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 z-[60]"
      >
        <div className="p-4 border-b border-border">
          <h3 className="font-display text-base text-foreground">
            Seu Carrinho
            {itemCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({itemCount} {itemCount === 1 ? 'item' : 'itens'})
              </span>
            )}
          </h3>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground mb-4">Seu carrinho está vazio</p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/loja">Explorar produtos</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="max-h-72 overflow-y-auto divide-y divide-border" aria-label="Itens no carrinho">
              {last.map((item) => (
                <li key={item.id} className="flex gap-3 p-3 hover:bg-muted/30 transition-colors">
                  <Link
                    to={`/produto/${item.slug}`}
                    className="flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted"
                  >
                    <img
                      src={optimizeImage(item.image, { width: 120, quality: 70 })}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/produto/${item.slug}`}
                      className="text-sm text-foreground line-clamp-2 hover:text-primary transition-colors"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.quantity}× {formatBRL(item.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remover ${item.name}`}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            {items.length > last.length && (
              <p className="px-4 py-2 text-xs text-muted-foreground text-center border-t border-border">
                +{items.length - last.length} {items.length - last.length === 1 ? 'item' : 'itens'} no carrinho
              </p>
            )}

            <Separator />

            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-lg font-bold text-primary">{formatBRL(total)}</span>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link to="/carrinho">Ver carrinho e finalizar</Link>
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MiniCart;
