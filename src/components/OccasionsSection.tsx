import { Link } from "react-router-dom";
import { Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDbOccasions } from "@/hooks/useProducts";
import { BlurImage } from "@/components/BlurImage";
import SectionEyebrow from "@/components/SectionEyebrow";
import sabonetesImg from "@/assets/category-sabonetes.webp";
import velasImg from "@/assets/category-velas.webp";
import kitsImg from "@/assets/category-kits.webp";
import lembrancinhasImg from "@/assets/category-lembrancinhas.webp";

// Static fallback occasions with images and descriptions
const occasionDefaults: Record<string, { description: string; image: string }> = {
  "maternidade": {
    description: "Lembrancinhas delicadas para celebrar a chegada do bebê. Sabonetes e velas personalizadas com o nome e tema do pequeno.",
    image: kitsImg,
  },
  "cha-bebe": {
    description: "Surpreenda os convidados do chá revelação ou chá de fraldas com lembrancinhas artesanais encantadoras e perfumadas.",
    image: lembrancinhasImg,
  },
  "batizado": {
    description: "Celebre a bênção do batismo com sabonetes em formato de anjo, pomba, terço e símbolos religiosos personalizados.",
    image: sabonetesImg,
  },
  "casamento": {
    description: "Lembrancinhas elegantes para o grande dia. Sabonetes com iniciais dos noivos, velas aromáticas e kits especiais.",
    image: velasImg,
  },
  "aniversario": {
    description: "Festas infantis ou adultas ficam mais especiais com lembrancinhas temáticas personalizadas com cores e aromas.",
    image: lembrancinhasImg,
  },
  "corporativo": {
    description: "Kits presenteáveis personalizados para brindes corporativos, datas comemorativas e eventos empresariais.",
    image: velasImg,
  },
};

const defaultImage = sabonetesImg;

interface OccasionsSectionProps {
  eyebrow?: string;
}

const OccasionsSection = ({ eyebrow }: OccasionsSectionProps = {}) => {
  const { data: dbOccasions } = useDbOccasions();

  // Build occasions from database, with fallback defaults for description and image
  const occasions = (dbOccasions || []).slice(0, 6).map(o => ({
    title: o.name,
    slug: o.slug,
    description: occasionDefaults[o.slug]?.description || `Lembrancinhas personalizadas para ${o.name.toLowerCase()}.`,
    image: occasionDefaults[o.slug]?.image || defaultImage,
  }));

  // Fallback if no occasions in database
  const displayOccasions = occasions.length > 0 ? occasions : [
    { title: "Maternidade", slug: "maternidade", ...occasionDefaults["maternidade"] },
    { title: "Chá de Bebê", slug: "cha-bebe", ...occasionDefaults["cha-bebe"] },
    { title: "Batizado", slug: "batizado", ...occasionDefaults["batizado"] },
    { title: "Casamento", slug: "casamento", ...occasionDefaults["casamento"] },
    { title: "Aniversário", slug: "aniversario", ...occasionDefaults["aniversario"] },
    { title: "Corporativo", slug: "corporativo", ...occasionDefaults["corporativo"] },
  ];

  return (
    <section 
      id="ocasioes" 
      className="py-14 md:py-24 bg-cream/30 relative overflow-hidden"
      aria-labelledby="ocasioes-heading"
    >
      {/* Mobile hairline divider — cadência visual entre seções */}
      <div aria-hidden className="md:hidden h-px bg-border/40 mx-6 mb-10" />
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <SectionEyebrow align="center">{eyebrow}</SectionEyebrow>
            <h2 id="ocasioes-heading" className="font-display text-3xl md:text-5xl text-foreground mb-4">
              Ocasiões <span className="font-script text-primary italic">Especiais</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Seja qual for a celebração, temos a lembrancinha perfeita para eternizar seus momentos especiais com muito carinho e personalização.
            </p>
          </div>

          {/* Occasions Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {displayOccasions.map((occasion, index) => (
              <article 
                key={occasion.slug}
                className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50 hover:shadow-medium hover:-translate-y-2 transition-all duration-300 group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Image */}
                <div className="aspect-video overflow-hidden bg-muted/30">
                  <BlurImage
                    src={occasion.image}
                    alt={occasion.title}
                    width={600}
                    responsiveWidths={[400, 600, 800]}
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                
                {/* Content */}
                <div className="p-6">
                  <h3 className="font-display text-xl text-foreground mb-2">
                    {occasion.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {occasion.description}
                  </p>
                  
                  {/* CTA Button - Links to products page filtered by occasion */}
                  <Link 
                    to={`/produtos?ocasiao=${occasion.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-primary text-primary rounded-full font-medium text-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Ver Produtos
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="bg-foreground/90 rounded-2xl p-8 md:p-12 text-center">
            <h3 className="font-display text-2xl md:text-3xl text-primary-foreground mb-4">
              Não encontrou a ocasião perfeita?
            </h3>
            <p className="text-primary-foreground/80 mb-6 max-w-xl mx-auto">
              Criamos lembrancinhas para qualquer tipo de evento! Explore todos os nossos produtos ou solicite um orçamento personalizado.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/produtos">
                <Button 
                  size="lg"
                  className="bg-primary hover:bg-primary-dark text-primary-foreground rounded-full px-8 py-6 text-lg shadow-lg"
                >
                  <Heart className="h-5 w-5 mr-2" />
                  Ver Todos os Produtos
                </Button>
              </Link>
              <Link to="/orcamento">
                <Button
                  size="lg"
                  variant="ctaOnDark"
                  className="rounded-full px-8"
                >
                  Solicitar Orçamento
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OccasionsSection;