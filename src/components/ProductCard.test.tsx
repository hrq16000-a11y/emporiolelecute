import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProductCard from "./ProductCard";
import type { Product } from "@/data/products";

const baseProduct: Product = {
  id: "test-1",
  slug: "produto-teste",
  name: "Produto Teste",
  description: "Descrição curta",
  price: "R$ 4,60",
  priceValue: 4.6,
  image: "/placeholder.svg",
  link: "/produto/produto-teste",
  rating: 5,
  category: "sabonetes",
  occasions: ["maternidade"],
  keywords: [],
};

const renderCard = (overrides: Partial<Product> = {}) =>
  render(
    <MemoryRouter>
      <ProductCard product={{ ...baseProduct, ...overrides }} />
    </MemoryRouter>,
  );

describe("ProductCard — Schema.org price microdata", () => {
  it("preserva o preço visual formatado em BRL", () => {
    const { getByText } = renderCard();
    expect(getByText("R$ 4,60")).toBeInTheDocument();
  });

  it("emite <meta itemProp=price> com formato numérico Schema.org válido", () => {
    const { container } = renderCard();
    const meta = container.querySelector('meta[itemprop="price"]');
    expect(meta).not.toBeNull();
    const content = meta!.getAttribute("content") ?? "";
    // Schema.org: número puro, ponto decimal, sem moeda
    expect(content).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(content).toBe("4.60");
  });

  it("declara priceCurrency=BRL via meta separada", () => {
    const { container } = renderCard();
    const currency = container.querySelector('meta[itemprop="priceCurrency"]');
    expect(currency?.getAttribute("content")).toBe("BRL");
  });

  it("NÃO usa itemProp=price em nenhum span visual (deve ser exclusivo de <meta>)", () => {
    const { container } = renderCard();
    const spans = container.querySelectorAll('span[itemprop="price"]');
    expect(spans.length).toBe(0);
  });

  it("omite meta price quando priceValue ausente (back-compat)", () => {
    const { container } = renderCard({ priceValue: undefined });
    expect(container.querySelector('meta[itemprop="price"]')).toBeNull();
  });
});
