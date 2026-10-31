import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, ShoppingBag, MessageCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductPersonalizationOptions from '@/components/ProductPersonalizationOptions';
import type { PersonalizationOption, PersonalizationValues } from '@/lib/personalizationOptions';

interface Props {
  name: string;
  description: string;
  price: string;
  originalPrice?: string;
  images: string[];
  badge?: string;
  rating?: string;
  personalizationEnabled: boolean;
  personalizationLabel: string;
  personalizationPlaceholder: string;
  options: PersonalizationOption[];
}

const brl = (v: string) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'R$ —';
};

/** Prévia em tempo real de como o produto aparece na página pública (PDP). */
export default function ProductLivePreview({
  name,
  description,
  price,
  originalPrice,
  images,
  badge,
  rating,
  personalizationEnabled,
  personalizationLabel,
  personalizationPlaceholder,
  options,
}: Props) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [values, setValues] = useState<PersonalizationValues>({});
  const gallery = images.filter(Boolean);
  const [activeImage, setActiveImage] = useState(0);
  const cover = gallery[Math.min(activeImage, Math.max(gallery.length - 1, 0))];
  const hasDiscount = Number(originalPrice) > Number(price);

  return (
    <Card className="sticky top-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Prévia da página do produto</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant={device === 'mobile' ? 'default' : 'ghost'}
            aria-label="Prévia mobile"
            onClick={() => setDevice('mobile')}
          >
            <Smartphone className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={device === 'desktop' ? 'default' : 'ghost'}
            aria-label="Prévia desktop"
            onClick={() => setDevice('desktop')}
          >
            <Monitor className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'mx-auto rounded-xl border bg-background p-4 transition-all',
            device === 'mobile' ? 'max-w-[360px]' : 'max-w-full',
          )}
        >
          <div className={cn('grid gap-4', device === 'desktop' && 'md:grid-cols-2')}>
            <div className="space-y-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                {cover ? (
                  <img src={cover} alt={name || 'Prévia do produto'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Sem imagem
                  </div>
                )}
                {badge && <Badge className="absolute left-2 top-2">{badge}</Badge>}
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {gallery.map((img, i) => (
                    <button
                      key={img + i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      className={cn(
                        'h-12 w-12 shrink-0 overflow-hidden rounded border',
                        i === activeImage ? 'border-primary ring-2 ring-primary/30' : 'border-border/60',
                      )}
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold leading-tight">{name || 'Nome do produto'}</h2>
              {rating && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  {rating}
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold text-primary">{brl(price)}</span>
                {hasDiscount && originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">{brl(originalPrice)}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-4">
                {description || 'Descrição curta do produto aparece aqui.'}
              </p>

              {personalizationEnabled && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <p className="text-sm font-medium">{personalizationLabel || 'Personalização'}</p>
                  <div className="rounded-md border border-border/40 bg-background px-3 py-2 text-xs text-muted-foreground">
                    {personalizationPlaceholder || 'Digite o nome, data ou mensagem…'}
                  </div>
                  <ProductPersonalizationOptions options={options} values={values} onChange={setValues} />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button type="button" className="min-h-[44px] w-full" disabled>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Adicionar ao carrinho
                </Button>
                <Button type="button" variant="outline" className="min-h-[44px] w-full" disabled>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Pedir pelo WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Prévia interativa: as opções são clicáveis para você validar cores, imagens e variações antes de publicar.
        </p>
      </CardContent>
    </Card>
  );
}
