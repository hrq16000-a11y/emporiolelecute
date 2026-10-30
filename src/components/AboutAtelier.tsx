import { Link } from 'react-router-dom';
import { Instagram, Facebook, ArrowRight } from 'lucide-react';
import { useContactInfo } from '@/hooks/useContactInfo';
import SectionEyebrow from '@/components/SectionEyebrow';

interface Props {
  title?: string;
  text?: string;
}

/**
 * Seção "Sobre o ateliê" — texto autoral curto com links para a loja e redes.
 * Sem imagens pesadas para não competir com o LCP do hero.
 */
const AboutAtelier = ({
  title = 'Sobre o ateliê',
  text = 'O Empório LeleCute nasceu de uma mesa de trabalho cheia de papéis, fitas e sabonetes artesanais. Cada lembrancinha é montada à mão, no nosso ritmo, pensando na história que ela vai contar. Se você chegou até aqui, é porque também acredita que detalhe pequeno é o que emociona.',
}: Props) => {
  const { instagram, facebook } = useContactInfo();

  return (
    <section className="py-12 md:py-16" aria-labelledby="sobre-atelie-title">
      <div className="container mx-auto px-4 max-w-3xl text-center">
        <SectionEyebrow>Feito à mão</SectionEyebrow>
        <h2
          id="sobre-atelie-title"
          className="font-display text-2xl md:text-3xl font-normal text-foreground mt-2 mb-4"
        >
          {title}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{text}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/produtos"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full bg-primary text-primary-foreground text-sm transition-opacity hover:opacity-90"
          >
            Conhecer a loja <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/sobre"
            className="inline-flex items-center min-h-[44px] px-5 rounded-full border border-border text-sm transition-colors hover:bg-muted"
          >
            Nossa história
          </Link>
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram do Empório LeleCute"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-border transition-colors hover:bg-muted"
          >
            <Instagram className="h-4 w-4" strokeWidth={1.5} />
          </a>
          <a
            href={facebook}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook do Empório LeleCute"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-border transition-colors hover:bg-muted"
          >
            <Facebook className="h-4 w-4" strokeWidth={1.5} />
          </a>
        </div>
      </div>
    </section>
  );
};

export default AboutAtelier;
