import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductReviews from "./ProductReviews";

const makeReviews = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `r-${i}`,
    author_name: `Cliente ${i}`,
    rating: 5,
    comment: `Comentário ${i}`,
    is_verified: i % 2 === 0,
    review_date: "2026-01-10",
    created_at: "2026-01-10",
    images: [] as string[],
    source_url: null,
  }));

const REVIEWS = makeReviews(7);

vi.mock("@/hooks/useProductReviews", () => ({
  useProductReviews: () => ({ data: REVIEWS, isLoading: false }),
  useProductReviewStats: () => ({ data: { avg_rating: 5, total: REVIEWS.length } }),
}));

vi.mock("@/hooks/useFeatureFlags", () => ({
  // Sem linha configurada no banco, o hook cai no default — que deve manter a
  // expansão ligada (regressão: já ficou desligada por engano).
  useFeatureFlags: () => ({ data: undefined }),
}));

describe("ProductReviews — expansão de avaliações", () => {
  it("renderiza o botão 'Ver mais avaliações' por padrão quando há volume suficiente", () => {
    render(<ProductReviews productId="p1" initialLimit={3} />);
    const toggle = screen.getByTestId("reviews-expand-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle.textContent).toContain("Ver mais");
    // 7 avaliações, 3 visíveis => restam 4
    expect(toggle.textContent).toContain("4");
  });

  it("exibe todos os comentários ao expandir e volta ao colapsar", () => {
    render(<ProductReviews productId="p1" initialLimit={3} />);
    expect(screen.queryByText('"Comentário 6"')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reviews-expand-toggle"));
    REVIEWS.forEach((r) => {
      expect(screen.getByText(`"${r.comment}"`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("reviews-expand-toggle"));
    expect(screen.queryByText('"Comentário 6"')).not.toBeInTheDocument();
  });

  it("não renderiza o botão quando o total cabe no limite inicial", () => {
    render(<ProductReviews productId="p1" initialLimit={10} />);
    expect(screen.queryByTestId("reviews-expand-toggle")).not.toBeInTheDocument();
  });
});
