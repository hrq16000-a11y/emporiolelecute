import { describe, it, expect } from "vitest";
import { parseSafePrice, formatSchemaPrice } from "./safePrice";

describe("parseSafePrice", () => {
  it("aceita number", () => {
    expect(parseSafePrice(4.6)).toBe(4.6);
    expect(parseSafePrice(0)).toBe(0);
  });

  it("aceita string numérica vinda do Supabase (numeric)", () => {
    expect(parseSafePrice("4.60")).toBe(4.6);
    expect(parseSafePrice("129.00")).toBe(129);
  });

  it("normaliza formato pt-BR", () => {
    expect(parseSafePrice("R$ 4,60")).toBe(4.6);
    expect(parseSafePrice("R$ 1.234,56")).toBe(1234.56);
    expect(parseSafePrice("1.234,5")).toBe(1234.5);
  });

  it("normaliza formato en-US com milhar", () => {
    expect(parseSafePrice("1,234.56")).toBe(1234.56);
  });

  it("devolve null para valores inválidos", () => {
    expect(parseSafePrice(null)).toBeNull();
    expect(parseSafePrice(undefined)).toBeNull();
    expect(parseSafePrice("")).toBeNull();
    expect(parseSafePrice("grátis")).toBeNull();
    expect(parseSafePrice(NaN)).toBeNull();
    expect(parseSafePrice({})).toBeNull();
  });
});

describe("formatSchemaPrice", () => {
  it("sempre devolve duas casas com ponto decimal", () => {
    expect(formatSchemaPrice("R$ 4,6")).toBe("4.60");
    expect(formatSchemaPrice(129)).toBe("129.00");
  });

  it("nunca devolve NaN", () => {
    expect(formatSchemaPrice("abc")).toBeNull();
  });
});
