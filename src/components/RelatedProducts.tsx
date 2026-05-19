import { Link } from 'react-router-dom';
import { DbProduct, useDbProducts } from '@/hooks/useProducts';
import ProductCard from './ProductCard';
import type { Product } from '@/data/products';

interface RelatedProductsProps {
  currentProduct: DbProduct;
  maxProducts?: number;
}

const RelatedProducts = ({ currentProduct, maxProducts = 4 }: RelatedProductsProps) => {
  const { data: allProducts } = useDbProducts();

  // Find related products based on category and occasions
  const relatedProducts = (allProducts || [])
    .filter(p => {
      // Exclude current product and inactive products
      if (p.id === currentProduct.id || !p.is_active) return false;

      // Check if same category
      const sameCategory = p.category_id && p.category_id === currentProduct.category_id;

      // Check if shares any occasion
      const currentOccasionIds = currentProduct.occasions?.map(o => o.id) || [];
      const productOccasionIds = p.occasions?.map(o => o.id) || [];
      const sharedOccasions = currentOccasionIds.some(id => productOccasionIds.includes(id));

      return sameCategory || sharedOccasions;
    })
    // Sort by relevance (same category + shared occasions first)
    .sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (a.category_id === currentProduct.category_id) scoreA += 2;
      if (b.category_id === currentProduct.category_id) scoreB += 2;

      const currentOccasionIds = currentProduct.occasions?.map(o => o.id) || [];
      const aOccasionIds = a.occasions?.map(o => o.id) || [];
      const bOccasionIds = b.occasions?.map(o => o.id) || [];

      scoreA += currentOccasionIds.filter(id => aOccasionIds.includes(id)).length;
      scoreB += currentOccasionIds.filter(id => bOccasionIds.includes(id)).length;

      return scoreB - scoreA;
    })
    .slice(0, maxProducts);

  // Convert to display format
  const displayProducts: Product[] = relatedProducts.map(p => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description || '',
    price: `R$ ${p.price.toFixed(2).replace('.', ',')}`,
    priceValue: Number(p.price),
    originalPrice: p.original_price ? `R$ ${p.original_price.toFixed(2).replace('.', ',')}` : undefined,
    image: p.images[0] || '/placeholder.svg',
    images: p.images,
    link: '',
    badge: p.badge || undefined,
    rating: Math.round(p.rating),
    category: 'outros' as const,
    occasions: [],
    keywords: p.keywords || [],
    min_quantity: p.min_quantity || undefined,
  }));

  if (displayProducts.length === 0) return null;

  return (
    <section className="mt-16 pt-12 border-t border-border">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl text-foreground">
            Produtos Relacionados
          </h2>
          <p className="text-muted-foreground mt-1">
            Você também pode gostar
          </p>
        </div>
        <Link 
          to="/produtos" 
          className="text-primary hover:text-primary-dark font-medium text-sm transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {displayProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};

export default RelatedProducts;
