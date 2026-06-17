import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar, Clock, MessageCircle, HelpCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getPostBySlug, getRelatedPosts } from "@/data/blog";
import { useDbBlogPostBySlug } from "@/hooks/useDbBlogPosts";
import { useContactInfo } from "@/hooks/useContactInfo";
import { buildWhatsAppUrl, trackWhatsAppClick } from "@/lib/analytics";
import { sanitizeHtml } from "@/lib/sanitize-html";

const SITE = "https://emporiolelecute.com.br";

const BlogPost = () => {
  const { slug = "" } = useParams();
  const { data: dbPost, isLoading: dbLoading } = useDbBlogPostBySlug(slug);
  const staticPost = getPostBySlug(slug);
  const related = getRelatedPosts(slug);
  const { whatsappNumber } = useContactInfo();
  const phone = (whatsappNumber || "5541992214299").replace(/\D/g, "");

  // Prioriza post do banco; fallback para estático
  const post = dbPost
    ? {
        slug: dbPost.slug,
        title: dbPost.title,
        excerpt: dbPost.excerpt || "",
        contentHtml: dbPost.content || "",
        coverImage: dbPost.cover_image || undefined,
        author: dbPost.author || "Empório LeleCute",
        publishedAt: dbPost.published_at || dbPost.created_at,
        updatedAt: dbPost.updated_at,
        readingMinutes: dbPost.reading_time || 5,
        category: "Editorial",
        tags: [] as string[],
        seoTitle: dbPost.meta_title || undefined,
        seoDescription: dbPost.meta_description || undefined,
        faqs: dbPost.faqs || [],
      }
    : staticPost;

  if (dbLoading && !staticPost) return null;
  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const url = `${SITE}/blog/${post.slug}`;
  const utmCampaign = `blog_${post.slug}`;
  const waUrl = buildWhatsAppUrl({
    phone,
    message: `Olá! Vim do artigo "${post.title}" no blog do Empório LeleCute e gostaria de um orçamento.`,
    utm_source: "blog",
    utm_medium: "post_cta",
    utm_campaign: utmCampaign,
    utm_content: post.slug,
  });

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    url,
    inLanguage: "pt-BR",
    wordCount: post.contentHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length,
    description: post.seoDescription || post.excerpt,
    image: post.coverImage ? [post.coverImage] : undefined,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "Empório LeleCute",
      logo: { "@type": "ImageObject", url: `${SITE}/favicon.ico` },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: post.category,
    keywords: post.tags?.join(", "),
  };

  const faqSchema = post.faqs && post.faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }
    : null;

  const handleWaClick = () => {
    trackWhatsAppClick({ source: "blog_post", context: post.slug, utm_campaign: utmCampaign });
  };

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.excerpt}
        url={url}
        image={post.coverImage}
      />
      <BreadcrumbStructuredData
        items={[
          { name: "Início", url: `${SITE}/` },
          { name: "Blog", url: `${SITE}/blog` },
          { name: post.title, url },
        ]}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        {faqSchema && (
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        )}
      </Helmet>

      <Header />

      <main className="pt-24 pb-16">
        <article className="container mx-auto px-4 py-10">
          <div className="max-w-3xl mx-auto">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao blog
            </Link>

            <span className="text-xs uppercase tracking-wide text-primary font-medium">
              {post.category}
            </span>
            <h1 className="font-display text-3xl md:text-5xl text-foreground mt-2 mb-4 leading-tight">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(post.publishedAt).toLocaleDateString("pt-BR")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {post.readingMinutes} min de leitura
              </span>
            </div>

            {post.coverImage && (
              <div className="rounded-2xl overflow-hidden mb-8 bg-muted aspect-video">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* CTA WhatsApp — topo do artigo */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3 p-4 bg-primary-light/40 border border-primary/20 rounded-xl">
              <p className="text-sm text-foreground m-0">
                <strong>Precisa de lembrancinhas prontas?</strong> Fale com a artesã agora.
              </p>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={handleWaClick}>
                <Button size="sm" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Atendimento no WhatsApp
                </Button>
              </a>
            </div>

            <div
              className="prose prose-neutral max-w-none prose-headings:font-display prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.contentHtml) }}
            />

            {/* FAQ */}
            {post.faqs && post.faqs.length > 0 && (
              <section className="mt-12">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl text-foreground m-0">
                    Perguntas frequentes
                  </h2>
                </div>
                <Accordion type="single" collapsible className="bg-card rounded-2xl border border-border/40 px-4">
                  {post.faqs.map((f, idx) => (
                    <AccordionItem key={idx} value={`faq-${idx}`}>
                      <AccordionTrigger className="text-left font-medium">{f.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {f.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}

            {/* CTA pós-conteúdo */}
            <div className="mt-12 p-6 bg-gradient-to-br from-primary-light to-cream rounded-2xl text-center">
              <h2 className="font-display text-xl text-foreground mb-2">
                Quer lembrancinhas prontas e personalizadas?
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Atendimento direto com a artesã pelo WhatsApp.
              </p>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={handleWaClick}>
                <Button className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Falar no WhatsApp
                </Button>
              </a>
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1 bg-muted text-muted-foreground rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* INTERLINK — Veja também landings */}
        <section className="container mx-auto px-4 py-10 border-t border-border/40">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-2xl text-foreground mb-6 text-center">
              Veja também
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                to="/lembrancinhas-maternidade"
                className="group block bg-card rounded-2xl p-5 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <span className="text-xs uppercase tracking-wide text-primary font-medium">Landing</span>
                <h3 className="font-display text-base text-foreground mt-1 group-hover:text-primary transition-colors">
                  Lembrancinhas de Maternidade
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Kits artesanais para receber as visitas do bebê.
                </p>
              </Link>
              <Link
                to="/produtos"
                className="group block bg-card rounded-2xl p-5 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <span className="text-xs uppercase tracking-wide text-primary font-medium">Catálogo</span>
                <h3 className="font-display text-base text-foreground mt-1 group-hover:text-primary transition-colors">
                  Todos os sabonetes personalizados
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Explore mais de 100 modelos artesanais.
                </p>
              </Link>
            </div>

            {related.length > 0 && (
              <div className="mt-12">
                <h2 className="font-display text-2xl text-foreground mb-6 text-center">
                  Continue lendo
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {related.map((rp) => (
                    <Link
                      key={rp.slug}
                      to={`/blog/${rp.slug}`}
                      className="group block bg-card rounded-2xl p-5 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all"
                    >
                      <span className="text-xs uppercase tracking-wide text-primary font-medium">
                        {rp.category}
                      </span>
                      <h3 className="font-display text-base text-foreground mt-1 group-hover:text-primary transition-colors line-clamp-2">
                        {rp.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {rp.excerpt}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default BlogPost;
