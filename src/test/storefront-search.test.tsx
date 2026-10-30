import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchBar from "@/components/SearchBar";
import Produtos from "@/pages/Produtos";
import Buscar from "@/pages/Buscar";

const fixtures = vi.hoisted(() => {
  const categories = [
    { id: "soap", name: "Sabonetes", slug: "sabonetes" },
    { id: "candle", name: "Velas", slug: "velas" },
  ];
  const product = (id: string, name: string, category: typeof categories[number], extra = {}) => ({
    id, name, slug: id, category, category_id: category.id,
    description: "Lembrancinha artesanal", long_description: null,
    price: 5, original_price: null, min_quantity: 10, pix_discount: 5,
    production_days: 3, rating: 5, images: ["/placeholder.svg"],
    keywords: [], occasions: [], tags: [], segments: [], features: [],
    created_at: "2026-01-01", is_active: true, ...extra,
  });
  return {
    categories,
    products: [
      product("soap-heart", "Sabonete Coração", categories[0]),
      product("soap-foot", "Sabonete Pezinho", categories[0], { keywords: ["chá de bebê"] }),
      product("candle-heart", "Vela Coração", categories[1]),
      product("inactive-heart", "Coração desativado", categories[0], { is_active: false }),
    ],
    empty: [],
    filters: {
      onlyActive: true, speeds: [], categorySlugs: [], occasionSlugs: [], tagSlugs: [], segmentSlugs: [],
    },
    rpc: vi.fn(),
  };
});

vi.mock("@/hooks/useProducts", () => ({
  useDbProducts: () => ({ data: fixtures.products, isLoading: false, refetch: vi.fn() }),
  useDbCategories: () => ({ data: fixtures.categories }),
  useDbOccasions: () => ({ data: fixtures.empty }),
}));
vi.mock("@/hooks/useTags", () => ({ useTags: () => ({ data: fixtures.empty }) }));
vi.mock("@/hooks/useSegments", () => ({ useSegments: () => ({ data: fixtures.empty }) }));
vi.mock("@/hooks/useSearchCacheVersion", () => ({ useSearchCacheVersion: () => 1 }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: fixtures.rpc } }));
vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/WhatsAppButton", () => ({ default: () => null }));
vi.mock("@/components/Chatbot", () => ({ default: () => null }));
vi.mock("@/components/DynamicSEO", () => ({ default: () => null }));
vi.mock("@/components/BreadcrumbStructuredData", () => ({ default: () => null }));
vi.mock("@/components/ProductCard", () => ({
  default: ({ product }: { product: { name: string } }) => <div data-testid="product-card">{product.name}</div>,
}));
vi.mock("@/components/SearchEmptyState", () => ({
  default: () => <div data-testid="empty-search">Nenhum produto encontrado</div>,
}));
vi.mock("@/components/CatalogFilters", () => ({
  default: () => null,
  useCatalogFiltersFromUrl: () => [fixtures.filters, vi.fn()],
}));
vi.mock("@/lib/analytics", () => ({ event: vi.fn() }));

const LocationControls = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="location">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Voltar no teste</button>
  </>;
};

const mount = (element: React.ReactNode, entries = ["/"], initialIndex = entries.length - 1) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HelmetProvider>
        <MemoryRouter initialEntries={entries} initialIndex={initialIndex}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {element}<LocationControls />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
};

const location = () => new URL(screen.getByTestId("location").textContent!, "https://example.test");
const cards = () => screen.queryAllByTestId("product-card").map((card) => card.textContent);

beforeEach(() => {
  localStorage.clear();
  fixtures.rpc.mockReset();
  fixtures.rpc.mockResolvedValue({ data: { ids: ["soap-heart"], total: 1, offset: 0, has_more: false }, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Storefront search regressions", () => {
  it("submits the header search to the same route used on mobile and trims surrounding spaces", () => {
    mount(<SearchBar />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "  coracao  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(location().pathname).toBe("/buscar");
    expect(location().searchParams.get("q")).toBe("coracao");
  });

  it("does not submit whitespace as a search", () => {
    mount(<SearchBar />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(location().pathname).toBe("/");
    expect(location().search).toBe("");
  });

  it("offers an accented product for an unaccented query and opens its product page", async () => {
    mount(<SearchBar />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "coracao" } });
    fireEvent.click(await screen.findByRole("option", { name: /Sabonete Coração/ }));
    expect(location().pathname).toBe("/produto/soap-heart");
  });

  it("finds the same active catalog products with and without accents", async () => {
    mount(<Produtos />, ["/produtos?busca=coracao"]);
    expect(cards().sort()).toEqual(["Sabonete Coração", "Vela Coração"]);
    fireEvent.change(screen.getByPlaceholderText("Buscar lembrancinhas..."), { target: { value: "coração" } });
    await waitFor(() => expect(location().searchParams.get("busca")).toBe("coração"));
    expect(cards().sort()).toEqual(["Sabonete Coração", "Vela Coração"]);
    expect(screen.queryByText("Coração desativado")).not.toBeInTheDocument();
  });

  it("updates a shareable URL while preserving the category, resets pagination and restores the query on remount", async () => {
    const first = mount(<Produtos />, ["/produtos?categoria=sabonetes&search=coracao&pagina=3"]);
    const input = screen.getByPlaceholderText("Buscar lembrancinhas...");
    fireEvent.change(input, { target: { value: "cha de bebe" } });
    await waitFor(() => expect(cards()).toEqual(["Sabonete Pezinho"]));
    const url = location();
    expect(url.searchParams.get("busca")).toBe("cha de bebe");
    expect(url.searchParams.get("search")).toBeNull();
    expect(url.searchParams.get("pagina")).toBeNull();
    expect(url.searchParams.get("categoria")).toBe("sabonetes");
    first.unmount();
    mount(<Produtos />, [url.pathname + url.search]);
    expect(screen.getByPlaceholderText("Buscar lembrancinhas...")).toHaveValue("cha de bebe");
    expect(cards()).toEqual(["Sabonete Pezinho"]);
    fireEvent.change(screen.getByPlaceholderText("Buscar lembrancinhas..."), { target: { value: "" } });
    await waitFor(() => expect(cards().sort()).toEqual(["Sabonete Coração", "Sabonete Pezinho"]));
    expect(location().searchParams.get("busca")).toBeNull();
    expect(location().searchParams.get("categoria")).toBe("sabonetes");
  });

  it("restores catalog results and the input when going back to an earlier search", async () => {
    mount(<Produtos />, ["/produtos?busca=coracao", "/produtos?busca=pezinho"]);
    expect(cards()).toEqual(["Sabonete Pezinho"]);
    fireEvent.click(screen.getByRole("button", { name: "Voltar no teste" }));
    await waitFor(() => expect(cards().sort()).toEqual(["Sabonete Coração", "Vela Coração"]));
    expect(screen.getByPlaceholderText("Buscar lembrancinhas...")).toHaveValue("coracao");
  });

  it("shows a service failure instead of an empty result and recovers when retrying", async () => {
    fixtures.rpc.mockResolvedValueOnce({ data: null, error: { message: "Service unavailable", code: "XX001" } });
    mount(<Buscar />, ["/buscar?q=coracao"]);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Busca indisponível no momento")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-search")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(cards()).toEqual(["Sabonete Coração"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fixtures.rpc).toHaveBeenCalledTimes(2);
  });

  it("appends the next page of ranked server results without losing the first page", async () => {
    fixtures.rpc
      .mockResolvedValueOnce({ data: { ids: ["soap-heart"], total: 2, offset: 0, has_more: true }, error: null })
      .mockResolvedValueOnce({ data: { ids: ["candle-heart"], total: 2, offset: 1, has_more: false }, error: null });
    mount(<Buscar />, ["/buscar?q=coracao"]);
    fireEvent.click(await screen.findByRole("button", { name: /Carregar mais/ }));
    await waitFor(() => expect(cards()).toEqual(["Sabonete Coração", "Vela Coração"]));
    expect(screen.getByText("2 de 2 resultados")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).not.toBeInTheDocument();
    expect(fixtures.rpc).toHaveBeenLastCalledWith("search_products", expect.objectContaining({ _q: "coracao", _offset: 1 }));
  });
});
