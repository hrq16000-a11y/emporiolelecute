import { Heart } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  productId: string;
  productName?: string;
  personalization?: Record<string, unknown>;
  className?: string;
  variant?: 'floating' | 'inline';
}

/**
 * Botão de curtir/salvar produto. Funciona para visitantes (persistência local)
 * e sincroniza com o banco quando o cliente está autenticado.
 */
const WishlistButton = ({
  productId,
  productName,
  personalization,
  className,
  variant = 'floating',
}: Props) => {
  const { isSaved, toggle } = useWishlist();
  const { toast } = useToast();
  const saved = isSaved(productId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = await toggle(productId, personalization);
    toast({
      title: added ? 'Salvo nos favoritos' : 'Removido dos favoritos',
      description: added
        ? `${productName ?? 'Produto'} está na sua lista. Retome quando quiser em /favoritos.`
        : undefined,
    });
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={saved}
        aria-label={saved ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        className={cn(
          'inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full border border-border text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          saved && 'border-primary text-primary',
          className,
        )}
      >
        <Heart className={cn('h-4 w-4', saved && 'fill-current')} strokeWidth={1.5} />
        {saved ? 'Salvo' : 'Salvar'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
      className={cn(
        'absolute top-2 right-2 sm:top-3 sm:right-3 w-9 h-9 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-opacity duration-300 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        saved ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
        className,
      )}
    >
      <Heart
        className={cn('h-4 w-4', saved ? 'text-primary fill-current' : 'text-foreground/70')}
        strokeWidth={1.5}
      />
    </button>
  );
};

export default WishlistButton;
