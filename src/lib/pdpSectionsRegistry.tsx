import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Tag } from "lucide-react";
import CrossSellComplete from "@/components/CrossSellComplete";
import ProductBundleBelongsTo from "@/components/ProductBundleBelongsTo";
import VisualComposition from "@/components/VisualComposition";
import ProductReviews from "@/components/ProductReviews";
import RelatedSmart from "@/components/RelatedSmart";

export interface PdpSectionContext {
  product: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    longDescription?: string;
  };
  dbProduct: any;
  canonicalUrl: string;
}

type Renderer = (ctx: PdpSectionContext) => ReactNode;

export const pdpSectionRegistry: Record<string, Renderer> = {
  description: ({ product }) => (
    <section className="mb-14 md:mb-16" key="description" aria-labelledby="pdp-description-title">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">Sobre o produto</p>
      <h2 id="pdp-description-title" className="font-display text-2xl md:text-3xl font-light text-foreground mb-5">
        Descrição
      </h2>
      <div className="prose prose-sm md:prose-base max-w-none">
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
          {product.longDescription || product.description || `${product.name} artesanal da LeleCute.

Cada peça é feita à mão com ingredientes hipoalergênicos de alta qualidade. Perfeito para lembrancinhas de maternidade, chá de bebê, batizado, casamento, aniversário e eventos corporativos.

Personalizamos conforme o tema do seu evento com cores, aromas e papelaria exclusivos.`}
        </p>
      </div>
    </section>
  ),

  cross_sell_complete: ({ dbProduct, product }) =>
    dbProduct?.id ? (
      <CrossSellComplete
        key="cross_sell_complete"
        currentProductId={dbProduct.id}
        currentProductSlug={product.slug}
        occasions={dbProduct?.occasions ?? []}
        tags={dbProduct?.tags ?? []}
        categoryId={dbProduct?.category?.id ?? null}
        limit={4}
      />
    ) : null,

  bundle_belongs_to: ({ dbProduct }) =>
    dbProduct?.id ? <ProductBundleBelongsTo key="bundle_belongs_to" productId={dbProduct.id} /> : null,

  visual_composition: ({ dbProduct }) =>
    dbProduct?.id ? (
      <VisualComposition
        key="visual_composition"
        currentProductId={dbProduct.id}
        occasions={dbProduct?.occasions ?? []}
        limit={6}
      />
    ) : null,

  editorial: ({ dbProduct, product, canonicalUrl }) =>
    dbProduct?.editorial_content ? (
      <section key="editorial" className="mb-12" aria-labelledby="editorial-title">
        <h2 id="editorial-title" className="font-display text-2xl text-foreground mb-6">
          Sobre esta lembrancinha
        </h2>
        <div className="bg-primary/5 rounded-xl border border-primary/10 p-6 prose prose-sm md:prose-base max-w-none text-muted-foreground">
          <div className="whitespace-pre-line leading-relaxed">{dbProduct.editorial_content}</div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: `Sobre ${product.name}`,
              articleBody: dbProduct.editorial_content.slice(0, 4000),
              mainEntityOfPage: canonicalUrl,
              author: { "@type": "Organization", name: "Empório LeleCute" },
            }),
          }}
        />
      </section>
    ) : null,

  reviews: ({ dbProduct }) =>
    dbProduct?.id ? (
      <div key="reviews" className="lg:hidden">
        <ProductReviews productId={dbProduct.id} initialLimit={3} />
      </div>
    ) : null,

  related_themes: ({ dbProduct }) =>
    dbProduct?.tags && dbProduct.tags.length > 0 ? (
      <section key="related_themes" className="mb-12" aria-labelledby="themes-title">
        <h2 id="themes-title" className="font-display text-xl text-foreground mb-4">
          Temas relacionados
        </h2>
        <div className="flex flex-wrap gap-2">
          {dbProduct.tags.slice(0, 12).map((t: any) => (
            <Link
              key={t.id}
              to={`/produtos?tag=${t.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-primary/10 hover:text-primary rounded-full text-sm text-muted-foreground transition-colors"
            >
              <Tag className="h-3 w-3" />
              {t.name}
            </Link>
          ))}
        </div>
      </section>
    ) : null,

  related_smart: ({ product, dbProduct }) => (
    <RelatedSmart
      key="related_smart"
      currentProductId={product.id}
      occasions={dbProduct?.occasions ?? []}
      tags={dbProduct?.tags ?? []}
      category={dbProduct?.category ?? null}
      limit={8}
    />
  ),
};

export const PDP_SECTION_LABELS: Record<string, string> = {
  description: "Descrição do produto",
  cross_sell_complete: "Complete o kit",
  bundle_belongs_to: "Kits relacionados",
  visual_composition: "Composição visual",
  editorial: "Conteúdo editorial",
  reviews: "Avaliações (mobile)",
  related_themes: "Temas relacionados",
  related_smart: "Produtos relacionados (inteligente)",
};
