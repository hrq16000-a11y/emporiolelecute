import { Link } from "react-router-dom";
import { BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import DynamicSEO from "@/components/DynamicSEO";
import BreadcrumbStructuredData from "@/components/BreadcrumbStructuredData";
import { Button } from "@/components/ui/button";
import { getPublishedPosts } from "@/data/blog";
import { useDbBlogPosts } from "@/hooks/useDbBlogPosts";

const SITE = "https://emporiolelecute.com.br";

const Blog = () => {
  const staticPosts = getPublishedPosts();
  const { data: dbPosts = [] } = useDbBlogPosts();

  // Merge: DB posts primeiro, seguidos de posts estáticos não-duplicados (por slug).
  const dbSlugs = new Set(dbPosts.map((p) => p.slug));
  const merged = [
    ...dbPosts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || "",
      coverImage: p.cover_image || undefined,
      category: "Editorial",
      publishedAt: p.published_at || p.created_at,
      readingMinutes: p.reading_time || 5,
    })),
    ...staticPosts
      .filter((p) => !dbSlugs.has(p.slug))
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        category: p.category,
        publishedAt: p.publishedAt,
        readingMinutes: p.readingMinutes,
      })),
  ];
  const posts = merged;

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title="Blog Empório LeleCute | Lembrancinhas Artesanais e DIY"
        description="Tutoriais, dicas e inspiração sobre sabonetes artesanais, lembrancinhas personalizadas e ideias para chá de bebê, maternidade, batizado e aniversário."
        url={`${SITE}/blog`}
      />
      <BreadcrumbStructuredData
        items={[
          { name: "Início", url: `${SITE}/` },
          { name: "Blog", url: `${SITE}/blog` },
        ]}
      />

      <Header />

      <main className="pt-24 pb-16">
        {/* HERO */}
        <section className="bg-gradient-to-br from-primary-light via-cream to-primary-light py-16">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/70 backdrop-blur rounded-full text-sm font-medium mb-6">
              <BookOpen className="h-4 w-4 text-primary" />
              Blog
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-4 leading-tight">
              Inspiração e tutoriais para suas lembrancinhas
            </h1>
            <p className="text-lg text-muted-foreground">
              Guias práticos, dicas de personalização e ideias para chá de bebê, maternidade, batizado, casamento e aniversário.
            </p>
          </div>
        </section>

        {/* LISTA DE POSTS */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-5xl mx-auto">
            {posts.length === 0 ? (
              <div className="text-center py-20 bg-muted/30 rounded-2xl">
                <BookOpen className="h-12 w-12 text-primary/40 mx-auto mb-4" />
                <h2 className="font-display text-2xl text-foreground mb-3">
                  Conteúdo a caminho
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Estamos preparando os primeiros artigos com tutoriais de sabonete artesanal e dicas para suas lembrancinhas. Volte em breve!
                </p>
                <Link to="/produtos">
                  <Button>Enquanto isso, conheça nossas lembrancinhas</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {posts.map((post) => (
                  <article
                    key={post.slug}
                    className="bg-card rounded-2xl overflow-hidden border border-border/40 hover:shadow-lg transition-all flex flex-col"
                  >
                    {post.coverImage && (
                      <Link to={`/blog/${post.slug}`} className="block aspect-video overflow-hidden bg-muted">
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          loading="lazy"
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </Link>
                    )}
                    <div className="p-4 sm:p-6 flex-1 flex flex-col">
                      <span className="text-xs uppercase tracking-wide text-primary font-medium mb-2">
                        {post.category}
                      </span>
                      <h2 className="font-display text-xl text-foreground mb-3">
                        <Link to={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.publishedAt).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readingMinutes} min
                        </span>
                      </div>
                      <Link
                        to={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-4 hover:gap-2 transition-all"
                      >
                        Ler artigo
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* INTERLINK — Lembrancinhas em destaque */}
            <div className="mt-16 pt-12 border-t border-border/40">
              <h2 className="font-display text-2xl md:text-3xl text-center text-foreground mb-2">
                Pronto para encomendar?
              </h2>
              <p className="text-center text-muted-foreground mb-8">
                Veja nossas lembrancinhas mais procuradas, prontas para personalizar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { slug: "maternidade", title: "Lembrancinhas de Maternidade", desc: "Kits perfumados para receber as visitas do bebê." },
                  { slug: "cha-de-bebe", title: "Lembrancinhas para Chá de Bebê", desc: "Sabonetes e velas personalizados." },
                  { slug: "batizado", title: "Lembrancinhas para Batizado", desc: "Lembranças delicadas para o sacramento." },
                ].map((item) => (
                  <Link
                    key={item.slug}
                    to={`/lembrancinhas-${item.slug}`}
                    className="group block bg-card rounded-2xl p-5 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <h3 className="font-display text-base text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.desc}</p>
                    <span className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-3 group-hover:gap-2 transition-all">
                      Ver modelos
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-6">
                <Link to="/produtos" className="text-sm text-primary hover:underline">
                  Ver catálogo completo de sabonetes personalizados →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Blog;
