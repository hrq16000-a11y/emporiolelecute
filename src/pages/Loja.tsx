import { Link } from "react-router-dom";
import { MessageCircle, Heart, Shield, Truck, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/ProductCard";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import ItemListStructuredData from "@/components/ItemListStructuredData";
import TrustBadges from "@/components/TrustBadges";
import FAQSection from "@/components/FAQSection";
import { useDbProducts } from "@/hooks/useProducts";
import { urls } from "@/lib/urls";
import logoImg from "@/assets/logo.webp";
import { useContactInfo } from "@/hooks/useContactInfo";

const WHATSAPP_MESSAGE = "Olá! Vim pelo site e gostaria de saber mais sobre as lembrancinhas personalizadas.";

const benefits = [
  { icon: Heart, title: "Feito à Mão", description: "Cada peça é produzida artesanalmente com carinho" },
  { icon: Shield, title: "Qualidade Premium", description: "Matéria-prima hipoalergênica de alta qualidade" },
  { icon: Sparkles, title: "Personalização", description: "Cores, aromas e embalagens personalizáveis" },
  { icon: Truck, title: "Envio para Todo Brasil", description: "Entregamos em todo o território nacional" },
];

const Loja = () => {
  const { data: dbProducts, isLoading } = useDbProducts();
  const { buildWhatsappUrl } = useContactInfo();
  const WHATSAPP_URL = buildWhatsappUrl(WHATSAPP_MESSAGE);

  // Get top 8 active products sorted by rating
  const featuredProducts = (dbProducts || [])
    .filter(p => p.is_active)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 8)
    .map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description || "",
      price: `R$ ${p.price.toFixed(2).replace(".", ",")}`,
      priceValue: Number(p.price),
      originalPrice: p.original_price ? `R$ ${p.original_price.toFixed(2).replace(".", ",")}` : undefined,
      image: p.images?.[0] || "/placeholder.svg",
      images: p.images || [],
      link: urls.product(p.slug),
      badge: p.badge || undefined,
      rating: p.rating || 5,
      category: "outros" as const,
      occasions: [] as never[],
      keywords: p.keywords || [],
      min_quantity: p.min_quantity || undefined,
    }));

  const itemListProducts = featuredProducts.map(p => ({
    name: p.name,
    description: p.description,
    image: p.image,
    price: parseFloat(p.price.replace("R$ ", "").replace(",", ".")),
    slug: p.slug,
  }));

  return (
    <>
      <DynamicSEO
        title="Loja - Lembrancinhas Personalizadas | Empório LeleCute"
        description="Lembrancinhas artesanais personalizadas para maternidade, chá de bebê, batizado e casamento. Sabonetes, velas e kits feitos à mão com carinho."
        url="https://emporiolelecute.com.br/loja"
      />
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: "https://emporiolelecute.com.br" },
          { name: "Loja", url: "https://emporiolelecute.com.br/loja" },
        ]}
      />
      {itemListProducts.length > 0 && (
        <ItemListStructuredData products={itemListProducts} listName="Produtos em Destaque - Loja" />
      )}

      <Header />

      <main>
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-accent via-background to-muted py-16 md:py-24">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <img
              src={logoImg}
              alt="Empório LeleCute - Lembrancinhas Personalizadas"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full mx-auto mb-6 shadow-lg object-cover"
              width="128"
              height="128"
            />
            <h1 className="font-display text-3xl md:text-5xl text-foreground mb-4 leading-tight">
              Lembrancinhas que encantam
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              Sabonetes artesanais, velas decorativas e kits personalizados feitos à mão para tornar seus momentos especiais ainda mais memoráveis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,38%)] text-primary-foreground rounded-full px-8 text-lg gap-2 w-full sm:w-auto">
                  <MessageCircle className="h-5 w-5" />
                  Fale Conosco
                </Button>
              </a>
              <Link to="/produtos">
                <Button size="lg" variant="outline" className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-full px-8 text-lg w-full sm:w-auto">
                  Ver Todos os Produtos
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits Bar */}
        <section className="bg-card border-y border-border py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {benefits.map((b) => (
                <div key={b.title} className="flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <b.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-display text-sm md:text-base font-semibold text-foreground">{b.title}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground hidden md:block">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="font-display text-2xl md:text-4xl text-foreground mb-3">Nossos Destaques</h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
                As lembrancinhas mais amadas pelos nossos clientes
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-muted animate-pulse rounded-2xl aspect-square" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {featuredProducts.map((product, idx) => (
                  <ProductCard key={product.id} product={product} priority={idx < 2} />
                ))}
              </div>
            )}

            <div className="text-center mt-10">
              <Link to="/produtos">
                <Button variant="outline" size="lg" className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-full px-10">
                  Ver Catálogo Completo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-16 bg-accent/50">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">O que nossos clientes dizem</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { name: "Ana Paula", text: "As lembrancinhas ficaram perfeitas para a maternidade da minha filha! Todos amaram.", stars: 5 },
                { name: "Camila R.", text: "Qualidade incrível e atendimento maravilhoso. Super recomendo a Empório LeleCute!", stars: 5 },
                { name: "Juliana M.", text: "Encomendei para o chá de bebê e superou todas as expectativas. Lindo demais!", stars: 5 },
              ].map((t) => (
                <div key={t.name} className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm mb-4 italic">"{t.text}"</p>
                  <p className="font-display font-semibold text-foreground text-sm">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-20 bg-gradient-to-r from-primary to-primary-dark text-primary-foreground">
          <div className="container mx-auto px-4 text-center max-w-2xl">
            <h2 className="font-display text-2xl md:text-4xl mb-4">Pronta para encantar seus convidados?</h2>
            <p className="text-primary-foreground/80 text-lg mb-8">
              Entre em contato e receba um orçamento personalizado sem compromisso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-background text-primary hover:bg-background/90 rounded-full px-8 text-lg gap-2 w-full sm:w-auto font-semibold">
                  <MessageCircle className="h-5 w-5" />
                  Peça seu Orçamento
                </Button>
              </a>
              <Link to="/orcamento">
              <Button size="lg" variant="ctaOnDark" className="rounded-full px-8 w-full sm:w-auto">
                  Formulário de Orçamento
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <TrustBadges />
        <FAQSection />
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default Loja;
