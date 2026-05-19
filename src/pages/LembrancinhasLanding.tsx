import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, MessageCircle, Sparkles, Truck, Heart, CheckCircle2, Star, Camera, BookOpen, ShoppingBag, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import FAQStructuredData from "@/components/FAQStructuredData";
import ItemListStructuredData from "@/components/ItemListStructuredData";
import OrganizationStructuredData from "@/components/OrganizationStructuredData";
import ProductCard from "@/components/ProductCard";
import TrustBadges from "@/components/TrustBadges";
import { trackInternalLink, buildWhatsAppUrl, trackWhatsAppClick } from "@/lib/analytics";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useDbProducts, type DbProduct } from "@/hooks/useProducts";
import { LEMBRANCINHAS_LANDINGS, getLandingByRouteSlug, type LembrancinhasLandingConfig } from "@/data/lembrancinhasLandings";
import { useOccasionLanding, usePublishedOccasionLandings, usePreviewOccasionLanding, type OccasionLanding } from "@/hooks/useOccasionLandings";
import type { Product } from "@/data/products";
import { urls, CANONICAL_ORIGIN } from "@/lib/urls";

interface Props {
  configKey: string;
}

const SITE = CANONICAL_ORIGIN;

/** Maps a DB row into the same shape the template expects (mirrors LembrancinhasLandingConfig). */
const dbToConfig = (row: OccasionLanding): LembrancinhasLandingConfig => ({
  routeSlug: row.route_slug,
  occasionSlug: row.occasion_slug,
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
  h1: row.h1,
  heroSubtitle: row.hero_subtitle,
  heroBadge: row.hero_badge,
  themeAccent: row.theme_accent,
  seoCopy: row.seo_copy,
  whatsappMessage: row.whatsapp_message,
  faqs: row.faqs,
  relatedRouteSlugs: row.related_route_slugs,
  gallery: row.gallery,
  testimonials: row.testimonials,
  socialProofStats: row.social_proof_stats,
  ogImage: row.og_image_url ?? undefined,
  ogImageAlt: row.og_image_alt ?? undefined,
});

const dbToProduct = (p: DbProduct): Product => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  description: p.description || "",
  longDescription: p.long_description || undefined,
  price: `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`,
  priceValue: Number(p.price),
  originalPrice: p.original_price ? `R$ ${Number(p.original_price).toFixed(2).replace(".", ",")}` : undefined,
  image: p.images?.[0] || "",
  images: p.images || [],
  link: urls.productAbsolute(p.slug, SITE),
  badge: p.badge || undefined,
  rating: Number(p.rating || 5),
  category: "outros" as const,
  occasions: [],
  keywords: p.keywords || [],
});

const LembrancinhasLanding = ({ configKey }: Props) => {
  // Preview mode (?preview=true) lets admins inspect drafts without publishing.
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";

  // 1) Preview (drafts incluídos, requer admin via RLS) ou DB-first (publicadas) → 2) hardcoded fallback.
  const { data: dbLanding } = useOccasionLanding(configKey);
  const { data: previewLanding } = usePreviewOccasionLanding(configKey, isPreview);
  const { data: publishedLandings } = usePublishedOccasionLandings();
  const { data: dbProducts, isLoading } = useDbProducts();

  const source = isPreview ? previewLanding : dbLanding;
  const fallback = getLandingByRouteSlug(configKey);
  const config = (source ? dbToConfig(source) : fallback) as LembrancinhasLandingConfig | undefined;

  const filteredProducts = useMemo(() => {
    if (!dbProducts || !config) return [];
    return dbProducts.filter((p) =>
      (p.occasions || []).some((o) => o.slug === config.occasionSlug)
    );
  }, [dbProducts, config?.occasionSlug]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Página não encontrada.</p>
      </div>
    );
  }

  const productsForCard = filteredProducts.map(dbToProduct);
  const pageUrl = `${SITE}/lembrancinhas-${config.routeSlug}`;

  const breadcrumbItems = [
    { name: "Início", url: `${SITE}/` },
    { name: "Lembrancinhas", url: `${SITE}/ocasioes` },
    { name: config.heroBadge, url: pageUrl },
  ];

  const itemListProducts = productsForCard.slice(0, 12).map((p) => ({
    name: p.name,
    description: p.description,
    image: p.image,
    price: Number(p.price.replace(/[^\d,]/g, "").replace(",", ".")) || 0,
    slug: p.slug,
  }));

  const { whatsappNumber } = useContactInfo();
  const phone = (whatsappNumber || "5541992214299").replace(/\D/g, "");
  const utmCampaign = `landing_${config.routeSlug}`;
  const whatsappHref = buildWhatsAppUrl({
    phone,
    message: config.whatsappMessage,
    utm_source: "landing",
    utm_medium: "cta",
    utm_campaign: utmCampaign,
    utm_content: config.routeSlug,
  });
  const handleWaClick = (position: string) => () =>
    trackWhatsAppClick({ source: "landing", context: config.routeSlug, utm_campaign: utmCampaign });
  // Related landings: prefer DB-published landings, fallback to hardcoded config.
  const relatedLandings = config.relatedRouteSlugs
    .map((s) => {
      const fromDb = publishedLandings?.find((l) => l.route_slug === s);
      if (fromDb) return dbToConfig(fromDb);
      return LEMBRANCINHAS_LANDINGS.find((l) => l.routeSlug === s);
    })
    .filter(Boolean) as LembrancinhasLandingConfig[];

  const isMaternidade = config.routeSlug === "maternidade";

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title={config.seoTitle}
        description={config.seoDescription}
        image={config.ogImage}
        url={pageUrl}
      />
      {config.ogImage && config.ogImageAlt && (
        <Helmet>
          <meta property="og:image:alt" content={config.ogImageAlt} />
          <meta name="twitter:image:alt" content={config.ogImageAlt} />
        </Helmet>
      )}
      {isPreview && (
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
      )}
      <BreadcrumbStructuredData items={breadcrumbItems} />
      <FAQStructuredData faqs={config.faqs.map((f, i) => ({ id: String(i), ...f }))} />
      <OrganizationStructuredData />
      {itemListProducts.length > 0 && (
        <ItemListStructuredData products={itemListProducts} listName={config.h1} />
      )}
      {config.testimonials && config.testimonials.length > 0 && (() => {
        const ratings = config.testimonials!.map((t) => t.rating ?? 5);
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        const aggregate = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: config.h1,
          description: config.seoDescription,
          url: pageUrl,
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avg.toFixed(1),
            reviewCount: ratings.length,
            bestRating: "5",
            worstRating: "1",
          },
          review: config.testimonials!.map((t) => ({
            "@type": "Review",
            author: { "@type": "Person", name: t.name },
            reviewRating: {
              "@type": "Rating",
              ratingValue: String(t.rating ?? 5),
              bestRating: "5",
            },
            reviewBody: t.text,
          })),
        };
        return (
          <Helmet>
            <script type="application/ld+json">{JSON.stringify(aggregate)}</script>
          </Helmet>
        );
      })()}

      <Header />

      {isPreview && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 text-sm font-medium py-2 px-4 text-center shadow-md">
          🔍 Pré-visualização — {source ? (source.is_published ? "página publicada" : "RASCUNHO") : "não encontrada no banco"}. Não indexável.
        </div>
      )}

      <main className={`pt-24 pb-16 ${isPreview ? "mt-8" : ""}`}>

        {/* HERO */}
        <section className={`bg-gradient-to-br ${config.themeAccent}`}>
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block px-4 py-1.5 bg-white/70 backdrop-blur text-foreground rounded-full text-sm font-medium mb-6">
                {config.heroBadge}
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-6 leading-tight">
                {config.h1}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
                {config.heroSubtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={handleWaClick("hero")}>
                  <Button size="lg" className="bg-primary hover:bg-primary-dark text-primary-foreground gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Orçamento via WhatsApp
                  </Button>
                </a>
                <a href="#produtos">
                  <Button size="lg" variant="outline" className="gap-2">
                    Ver modelos
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section className="container mx-auto px-4 py-10 border-b border-border/40">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto text-center">
            {[
              { icon: Sparkles, label: "Artesanal", text: "Feito à mão" },
              { icon: Heart, label: "Personalizado", text: "Com nome e data" },
              { icon: Truck, label: "Brasil inteiro", text: "Envio Correios" },
              { icon: CheckCircle2, label: "10+ anos", text: "Experiência" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <item.icon className="h-6 w-6 text-primary" />
                <p className="font-display text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PROVA SOCIAL — STATS */}
        {config.socialProofStats && config.socialProofStats.length > 0 && (
          <section className="container mx-auto px-4 py-12">
            <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {config.socialProofStats.map((stat) => (
                <div key={stat.label} className="bg-card rounded-2xl p-6 border border-border/40">
                  <p className="font-display text-2xl md:text-3xl text-primary">{stat.value}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GALERIA DE FOTOS REAIS */}
        {config.gallery && config.gallery.length > 0 && (
          <section className="container mx-auto px-4 py-12">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-medium">
                  <Camera className="h-4 w-4" />
                  Fotos reais de clientes
                </span>
                <h2 className="font-display text-3xl md:text-4xl text-foreground mt-2">
                  Veja nossas entregas
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {config.gallery.map((item, i) => {
                  const src = typeof item === "string" ? item : item.src;
                  const alt =
                    typeof item === "string"
                      ? `${config.heroBadge} — foto real ${i + 1}`
                      : item.alt || `${config.heroBadge} — foto real ${i + 1}`;
                  return (
                    <div key={i} className="aspect-square overflow-hidden rounded-xl bg-muted">
                      <img
                        src={src}
                        alt={alt}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section id="produtos" className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl md:text-4xl text-foreground mb-3">
                Modelos de {config.heroBadge}
              </h2>
              <p className="text-muted-foreground">
                Escolha o seu favorito e clique para orçar com personalização
              </p>
            </div>

            {isLoading ? (
              <p className="text-center text-muted-foreground py-12">Carregando produtos...</p>
            ) : productsForCard.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-2xl">
                <p className="text-muted-foreground mb-4">
                  Nosso catálogo para esta ocasião está em atualização.
                </p>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={handleWaClick("mid_section")}>
                  <Button>Falar com a artesã pelo WhatsApp</Button>
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {productsForCard.slice(0, 12).map((product, i) => (
                  <ProductCard key={product.id} product={product} priority={i < 3} />
                ))}
              </div>
            )}

            {productsForCard.length > 12 && (
              <div className="text-center mt-10">
                <Link to={`/produtos?ocasiao=${config.occasionSlug}`}>
                  <Button variant="outline" size="lg">
                    Ver todos os {productsForCard.length} modelos
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* PROVA SOCIAL — DEPOIMENTOS */}
        {config.testimonials && config.testimonials.length > 0 && (
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-5xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-10">
                O que as mamães dizem
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {config.testimonials.map((t, i) => (
                  <div key={i} className="bg-card rounded-2xl p-6 border border-border/40 flex flex-col">
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: t.rating ?? 5 }).map((_, idx) => (
                        <Star key={idx} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground italic flex-1 leading-relaxed">
                      "{t.text}"
                    </p>
                    <div className="mt-4 pt-4 border-t border-border/40">
                      <p className="font-display text-sm text-foreground">{t.name}</p>
                      {t.location && (
                        <p className="text-xs text-muted-foreground">{t.location}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* COMO FUNCIONA */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-12">
                Como Funciona o Pedido
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { n: "1", t: "Escolha o modelo", d: "Selecione a lembrancinha que combina com sua ocasião" },
                  { n: "2", t: "Personalize", d: "Defina nome, data, cores e quantidade" },
                  { n: "3", t: "Receba o orçamento", d: "Confirmamos prazo e calculamos o frete pelo CEP" },
                  { n: "4", t: "Aprove a arte", d: "Enviamos a arte personalizada antes da produção" },
                ].map((step) => (
                  <div key={step.n} className="bg-background rounded-2xl p-6 text-center">
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-display text-xl mx-auto mb-4">
                      {step.n}
                    </div>
                    <h3 className="font-display text-base mb-2">{step.t}</h3>
                    <p className="text-sm text-muted-foreground">{step.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SEO COPY */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto prose prose-neutral">
            <h2 className="font-display text-2xl md:text-3xl text-foreground mb-4">
              Sobre nossas {config.heroBadge.toLowerCase().includes("aniversário") ? "lembrancinhas de aniversário infantil" : `lembrancinhas de ${config.heroBadge.toLowerCase()}`}
            </h2>
            <p className="text-muted-foreground leading-relaxed">{config.seoCopy}</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-10">
              Perguntas Frequentes
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {config.faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left font-display">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className={`bg-gradient-to-br ${config.themeAccent} py-16`}>
          <div className="container mx-auto px-4 text-center max-w-2xl">
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Vamos criar a sua lembrancinha?
            </h2>
            <p className="text-muted-foreground mb-8">
              Atendimento direto com a artesã pelo WhatsApp. Resposta em até 2 horas em horário comercial.
            </p>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={handleWaClick("footer_cta")}>
              <Button size="lg" className="bg-primary hover:bg-primary-dark text-primary-foreground gap-2">
                <MessageCircle className="h-5 w-5" />
                Solicitar orçamento agora
              </Button>
            </a>
          </div>
        </section>

        {/* ROTA DE LEITURA — exclusiva da Maternidade (silo prioritário) */}
        {isMaternidade && (
          <section className="container mx-auto px-4 py-16 bg-gradient-to-br from-primary-light/30 to-cream/40 rounded-3xl my-8 mx-4 md:mx-auto max-w-6xl">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-medium">
                  <MapPin className="h-4 w-4" />
                  Rota de leitura sugerida
                </span>
                <h2 className="font-display text-2xl md:text-3xl text-foreground mt-2">
                  Sem pressa? Conheça antes, encomende depois
                </h2>
                <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
                  Selecionamos a ordem ideal para você se inspirar, comparar modelos e fechar o pedido com segurança.
                </p>
              </div>
              <ol className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  {
                    step: "1",
                    icon: BookOpen,
                    label: "Inspire-se",
                    title: "12 ideias de lembrancinhas de maternidade",
                    to: "/blog/lembrancinhas-maternidade-ideias-criativas",
                    pos: "reading_route_step_1",
                  },
                  {
                    step: "2",
                    icon: BookOpen,
                    label: "Entenda a técnica",
                    title: "Como fazer sabonete artesanal — guia completo",
                    to: "/blog/como-fazer-sabonete-artesanal-para-lembrancinhas",
                    pos: "reading_route_step_2",
                  },
                  {
                    step: "3",
                    icon: ShoppingBag,
                    label: "Veja modelos",
                    title: "Catálogo completo de sabonetes personalizados",
                    to: "/produtos",
                    pos: "reading_route_step_3",
                  },
                  {
                    step: "4",
                    icon: MessageCircle,
                    label: "Encomende",
                    title: "Falar com a artesã pelo WhatsApp",
                    to: whatsappHref,
                    external: true,
                    pos: "reading_route_step_4",
                  },
                ].map((item) => {
                  const onClick = () =>
                    trackInternalLink({
                      from: pageUrl,
                      to: item.to,
                      label: item.title,
                      position: item.pos,
                    });
                  const Icon = item.icon;
                  const card = (
                    <div className="h-full bg-card rounded-2xl p-5 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display text-sm">
                          {item.step}
                        </span>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-xs uppercase tracking-wide text-primary font-medium">
                        {item.label}
                      </span>
                      <p className="font-display text-sm text-foreground mt-1 flex-1">
                        {item.title}
                      </p>
                      <span className="inline-flex items-center gap-1 text-primary text-xs font-medium mt-3">
                        Acessar
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  );
                  return item.external ? (
                    <a
                      key={item.step}
                      href={item.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onClick}
                      className="block group"
                    >
                      {card}
                    </a>
                  ) : (
                    <Link
                      key={item.step}
                      to={item.to}
                      onClick={onClick}
                      className="block group"
                    >
                      {card}
                    </Link>
                  );
                })}
              </ol>
            </div>
          </section>
        )}

        {/* VOCÊ TAMBÉM PODE GOSTAR — INTERLINK SILO */}
        {relatedLandings.length > 0 && (
          <section className="container mx-auto px-4 py-16">
            <div className="max-w-5xl mx-auto">
              <h2 className="font-display text-2xl md:text-3xl text-center text-foreground mb-10">
                Você também pode gostar
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {relatedLandings.map((rel) => {
                  const to = `/lembrancinhas-${rel.routeSlug}`;
                  return (
                    <Link
                      key={rel.routeSlug}
                      to={to}
                      onClick={() =>
                        trackInternalLink({
                          from: pageUrl,
                          to,
                          label: rel.h1,
                          position: "related_landings_grid",
                        })
                      }
                      className="group block bg-card rounded-2xl p-6 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all"
                    >
                      <span className="text-xs text-primary font-medium uppercase tracking-wide">
                        {rel.heroBadge}
                      </span>
                      <h3 className="font-display text-lg text-foreground mt-2 mb-2 group-hover:text-primary transition-colors">
                        {rel.h1}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {rel.heroSubtitle}
                      </p>
                      <div className="flex items-center gap-2 text-primary font-medium text-sm mt-4 group-hover:gap-3 transition-all">
                        Ver lembrancinhas
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="text-center mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
                <Link
                  to="/ocasioes"
                  onClick={() => trackInternalLink({ from: pageUrl, to: "/ocasioes", label: "Ver todas as ocasiões", position: "footer_silo" })}
                  className="text-primary hover:underline"
                >
                  Ver todas as ocasiões →
                </Link>
                <Link
                  to="/produtos"
                  onClick={() => trackInternalLink({ from: pageUrl, to: "/produtos", label: "Catálogo completo", position: "footer_silo" })}
                  className="text-primary hover:underline"
                >
                  Catálogo completo →
                </Link>
                <Link
                  to="/blog"
                  onClick={() => trackInternalLink({ from: pageUrl, to: "/blog", label: "Dicas e tutoriais no blog", position: "footer_silo" })}
                  className="text-primary hover:underline"
                >
                  Dicas e tutoriais no blog →
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <TrustBadges />

      <Footer />
      <WhatsAppButton
        message={`Olá! Vim pela página de ${config.heroBadge.toLowerCase()}.\n\nGostaria de orçamento:\n• Quantidade: \n• Nome do bebê: \n• Cidade/UF: \n• Cores/tema: `}
        ariaLabel={`Orçamento via WhatsApp — ${config.heroBadge}`}
      />
    </div>
  );
};

export default LembrancinhasLanding;
