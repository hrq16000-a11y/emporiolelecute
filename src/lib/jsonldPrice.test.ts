import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildProductJsonLd } from '@/components/ProductStructuredData';
import { buildItemListJsonLd } from '@/components/ItemListStructuredData';
import { parseSafePriceMonitored } from '@/lib/safePrice';

const baseProduct = {
  name: 'Sabonete Lavanda',
  description: 'Artesanal',
  images: ['https://x/img.jpg'],
  slug: 'sabonete-lavanda',
  baseUrl: 'https://emporiolelecute.com.br',
  productUrl: 'https://emporiolelecute.com.br/produto/sabonete-lavanda',
  priceValidUntilStr: '2027-01-01',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JSON-LD — preço vindo como string do banco', () => {
  it('Product: "R$ 95,00" vira o número estrito 95', () => {
    const json = buildProductJsonLd({ ...baseProduct, price: 'R$ 95,00' as never });
    expect(json.offers.price).toBe(95);
    expect(typeof json.offers.price).toBe('number');
    expect(JSON.stringify(json)).not.toContain('R$');
    expect(JSON.stringify(json)).not.toContain('null');
  });

  it('Product: numeric string do Supabase ("95.00") não vira NaN', () => {
    const json = buildProductJsonLd({ ...baseProduct, price: '95.00' as never });
    expect(json.offers.price).toBe(95);
    expect(Number.isNaN(json.offers.price as number)).toBe(false);
  });

  it('ItemList: "R$ 1.234,56" vira 1234.56 e nunca NaN', () => {
    const json = buildItemListJsonLd(
      [
        {
          name: 'Kit',
          description: 'Kit artesanal',
          image: 'https://x/kit.jpg',
          price: 'R$ 1.234,56',
          slug: 'kit-artesanal',
        },
      ],
      'Destaques',
      '2027-01-01',
    );
    const offer = (json.itemListElement[0].item as { offers: { price?: number } }).offers;
    expect(offer.price).toBe(1234.56);
    expect(JSON.stringify(json)).not.toContain('NaN');
  });

  it('ItemList: preço inválido é OMITIDO em vez de emitir NaN', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const json = buildItemListJsonLd(
      [{ name: 'X', description: 'y', image: 'i', price: 'sob consulta', slug: 'x' }],
      'Destaques',
      '2027-01-01',
    );
    const offer = (json.itemListElement[0].item as { offers: Record<string, unknown> }).offers;
    expect('price' in offer).toBe(false);
    expect(JSON.stringify(json)).not.toContain('NaN');
  });
});

describe('Monitoramento em runtime de preço inválido', () => {
  it('loga console.error quando o preço é string não numérica', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    parseSafePriceMonitored('sob consulta', { source: 'test', ref: 'slug-x', field: 'price' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('[jsonld:invalid-price]');
  });

  it('NÃO loga para valores ausentes legítimos (null/undefined/"")', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    parseSafePriceMonitored(null, { source: 'test' });
    parseSafePriceMonitored(undefined, { source: 'test' });
    parseSafePriceMonitored('', { source: 'test' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('NÃO loga para valores válidos', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseSafePriceMonitored('R$ 95,00', { source: 'test' })).toBe(95);
    expect(spy).not.toHaveBeenCalled();
  });
});
