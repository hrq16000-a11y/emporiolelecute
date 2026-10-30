import { describe, it, expect } from 'vitest';
import { buildProductJsonLd } from './ProductStructuredData';

const base = {
  name: 'Sabonete Lavanda',
  description: 'Artesanal',
  images: ['https://x/img.jpg'],
  slug: 'sabonete-lavanda',
  baseUrl: 'https://emporiolelecute.com.br',
  productUrl: 'https://emporiolelecute.com.br/produto/sabonete-lavanda',
  priceValidUntilStr: '2027-01-01',
};

describe('buildProductJsonLd — priceSpecification', () => {
  it('inclui priceSpecification quando originalPrice > price', () => {
    const json = buildProductJsonLd({ ...base, price: 9.9, originalPrice: 14.9 });
    expect(json.offers.priceSpecification).toBeDefined();
    expect(json.offers.priceSpecification).toMatchObject({
      '@type': 'UnitPriceSpecification',
      priceType: 'https://schema.org/ListPrice',
      price: 14.9,
      priceCurrency: 'BRL',
    });
    expect(json.offers.price).toBe(9.9);
  });

  it('NÃO inclui priceSpecification quando não há desconto', () => {
    const json = buildProductJsonLd({ ...base, price: 9.9 });
    expect((json.offers as any).priceSpecification).toBeUndefined();
  });

  it('NÃO inclui priceSpecification quando originalPrice === price', () => {
    const json = buildProductJsonLd({ ...base, price: 9.9, originalPrice: 9.9 });
    expect((json.offers as any).priceSpecification).toBeUndefined();
  });

  it('NÃO inclui priceSpecification quando originalPrice < price (dado sujo)', () => {
    const json = buildProductJsonLd({ ...base, price: 9.9, originalPrice: 5 });
    expect((json.offers as any).priceSpecification).toBeUndefined();
  });

  it('arredonda preços para 2 casas (half-up, sem viés de float)', () => {
    const json = buildProductJsonLd({ ...base, price: 9.999, originalPrice: 14.995 });
    expect(json.offers.price).toBe(10);
    expect((json.offers.priceSpecification as any).price).toBe(15);
  });

  it('aceita preço em string vinda do banco e em formato pt-BR', () => {
    expect(buildProductJsonLd({ ...base, price: '4.60' as never }).offers.price).toBe(4.6);
    expect(buildProductJsonLd({ ...base, price: 'R$ 1.234,56' as never }).offers.price).toBe(1234.56);
  });

  it('omite o campo price quando o valor é inválido (nunca emite NaN)', () => {
    const json = buildProductJsonLd({ ...base, price: 'grátis' as never });
    expect('price' in (json.offers as Record<string, unknown>)).toBe(false);
  });

});
