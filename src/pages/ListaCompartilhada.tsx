import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Heart, ArrowRight, Lock } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import DynamicSEO from '@/components/DynamicSEO';
import { ProductSkeleton } from '@/components/ProductSkeleton';
import { Button } from '@/components/ui/button';
import { useSharedWishlist } from '@/hooks/useWishlistShare';
import { optimizeImage, buildSrcSet } from '@/lib/image';
import { urls } from '@/lib/urls';

const formatPrice = (value: number | null) =>
  value === null || Number.isNaN(value)
    ? 'Sob consulta'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Lista de favoritos compartilhada por link público. */
const ListaCompartilhada = () => {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = useSharedWishlist(token);
  const share = data?.share ?? null;
  const products = data?.products ?? [];

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title={`${share?.title || 'Lista de favoritos'} | Empório LeleCute`}
        description="Lista de lembrancinhas personalizadas compartilhada por um cliente."
      />
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <Header />

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <header className="mb-6 sm:mb-10 text-center">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold flex items-center justify-center gap-2">
            <Heart className="h-6 w-6 text-primary" strokeWidth={1.5} />
            {share?.title || 'Lista de favoritos'}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Seleção de lembrancinhas compartilhada com você.
          </p>
        </header>

        {isLoading ? (
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : !share ? (
          <div className="text-center py-16 border border-dashed rounded-2xl">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.25} />
            <p className="text-muted-foreground mb-6">
              Esta lista não está disponível ou foi definida como privada pelo dono.
            </p>
            <Button asChild>
              <Link to="/produtos">
                Explorar catálogo <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const image = product.images?.[0] ?? '/placeholder.svg';
              return (
                <article
                  key={product.id}
                  className="group min-w-0 bg-card rounded-xl sm:rounded-2xl overflow-hidden border border-border/40"
                >
                  <Link
                    to={urls.product(product.slug)}
                    className="block relative aspect-square overflow-hidden bg-muted"
                  >
                    <img
                      src={optimizeImage(image, { width: 600, resize: 'contain' })}
                      srcSet={buildSrcSet(image, [300, 450, 600], 75, 'contain')}
                      sizes="(max-width: 640px) 50vw, 300px"
                      alt={`${product.name} — lembrancinha personalizada`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      width={600}
                      height={600}
                    />
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

export default ListaCompartilhada;
