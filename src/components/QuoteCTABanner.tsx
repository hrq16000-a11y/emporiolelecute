import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Sparkles } from "lucide-react";
import { useContactInfo } from "@/hooks/useContactInfo";

const QuoteCTABanner = () => {
  const { buildWhatsappUrl } = useContactInfo();
  const whatsappUrl = buildWhatsappUrl(
    "Olá! Vim pelo site e gostaria de fazer um orçamento de lembrancinhas personalizadas."
  );

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/20 p-8 md:p-12 shadow-soft">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                Personalize do seu jeito
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground leading-tight">
                Vamos criar algo especial para o seu evento?
              </h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-xl">
                Conte para a gente o tema, a quantidade e a data. Preparamos um orçamento
                personalizado com carinho — e você ainda escolhe direto pelo WhatsApp.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link to="/orcamento">
                <Button
                  size="lg"
                  className="rounded-full px-7 bg-primary hover:bg-primary-dark text-primary-foreground shadow-soft hover:shadow-medium hover:-translate-y-0.5 transition-all"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Fazer Orçamento
                </Button>
              </Link>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-7 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuoteCTABanner;
