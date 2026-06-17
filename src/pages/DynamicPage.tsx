import { useParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import DynamicSEO from '@/components/DynamicSEO';
import BreadcrumbStructuredData from '@/components/BreadcrumbStructuredData';
import { usePage } from '@/hooks/usePages';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { sanitizeHtml } from '@/lib/sanitize-html';

const DynamicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading, error } = usePage(slug || '');

  const breadcrumbItems = [
    { name: 'Início', url: 'https://emporiolelecute.com.br/' },
    { name: page?.title || 'Página', url: `https://emporiolelecute.com.br/${slug}` },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl text-foreground mb-4">Página não encontrada</h1>
          <p className="text-muted-foreground mb-8">A página que você procura não existe ou foi removida.</p>
          <Link to="/">
            <Button>Voltar ao início</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DynamicSEO
        title={page.seo_title || page.title}
        description={page.seo_description || undefined}
        url={page.seo_canonical || `https://emporiolelecute.com.br/${page.slug}`}
      />
      <BreadcrumbStructuredData items={breadcrumbItems} />
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <article className="max-w-4xl mx-auto">
            <h1 className="font-display text-4xl text-foreground mb-8">{page.title}</h1>
            
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
            />
          </article>
        </div>
      </main>
      
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default DynamicPage;
