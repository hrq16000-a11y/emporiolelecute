import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Heart, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import DynamicSEO from '@/components/DynamicSEO';
import { ProductSkeleton } from '@/components/ProductSkeleton';
import WishlistButton from '@/components/WishlistButton';
import WishlistShareCard from '@/components/WishlistShareCard';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useWishlist } from '@/hooks/useWishlist';
import { optimizeImage, buildSrcSet } from '@/lib/image';
import { urls } from '@/lib/urls';

interface SavedProduct {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  images: string[] | null;
}

const formatPrice = (value: number | null) =>
  value === null || Number.isNaN(value)
    ? 'Sob consulta'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Lista de produtos salvos pelo cliente (favoritos / curtidas). */
const Favoritos = () => {
  const { items, isAuthenticated } = useWishlist();
  const ids = items.map((i) => i.product_id);


  const { data: products = [], isLoading } = useQuery({
    queryKey: ['wishlist-products', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async (): Promise<SavedProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, price, images')
        .in('id', ids)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as SavedProduct[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title="Meus favoritos | Empório LeleCute"
        description="Produtos personalizados que você salvou para retomar depois."
      />
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <Header />

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <header className="mb-6 sm:mb-10">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" strokeWidth={1.5} />
            Meus favoritos
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Salve as lembrancinhas que você gostou e retome a personalização quando quiser.
          </p>
        </header>

        {ids.length > 0 && (
          <div className="mb-6">
            <WishlistShareCard productIds={ids} isAuthenticated={isAuthenticated} />
          </div>
        )}


        {ids.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-2xl">
            <Heart className="h-10 w-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.25} />
            <p className="text-muted-foreground mb-6">Você ainda não salvou nenhum produto.</p>
            <Button asChild>
              <Link to="/produtos">
                Explorar catálogo <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: Math.min(ids.length, 8) }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const image = product.images?.[0] ?? '/placeholder.svg';
              return (
                <article
                  key={product.id}
                  className="group min-w-0 bg-card rounded-xl sm:rounded-2xl overflow-hidden border border-border/40 transition-colors hover:border-border"
                >
                  <Link
                    to={urls.product(product.slug)}
                    className="block relative aspect-square overflow-hidden bg-muted"
                  >
                    <img
                      src={optimizeImage(image, { width: 600, resize: 'contain' })}
                      srcSet={buildSrcSet(image, [300, 450, 600], 75, 'contain')}
                      sizes="(max-width: 640px) 50vw, 300px"
                      alt={`${product.name} — lembrancinha personalizada salva nos favoritos`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      width={600}
                      height={600}
                    />
                    <WishlistButton productId={product.id} productName={product.name} />
                  </Link>
                  <div className="p-2 md:p-3">
                    <Link to={urls.product(product.slug)}>
                      <h2 className="font-display text-sm md:text-base font-normal leading-snug mb-1">
                        {product.name}
                      </h2>
                    </Link>
                    <p className="text-sm text-primary font-medium">{formatPrice(product.price)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Favoritos;
