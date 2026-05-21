import { describe, it, expect } from "vitest";
import { formatBRL } from "./format";

describe("formatBRL", () => {
  it("formata valor inteiro", () => {
    expect(formatBRL(10)).toBe("R$ 10,00");
  });
  it("formata com centavos", () => {
    expect(formatBRL(9.9)).toBe("R$ 9,90");
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
  });
  it("trata null/undefined/NaN como zero", () => {
    expect(formatBRL(null)).toBe("R$ 0,00");
    expect(formatBRL(undefined)).toBe("R$ 0,00");
    expect(formatBRL(NaN)).toBe("R$ 0,00");
  });
  it("arredonda casas excedentes (half-to-even do Intl)", () => {
    expect(formatBRL(0.005)).toMatch(/^R\$ 0,0[01]$/);
    expect(formatBRL(9.999)).toBe("R$ 10,00");
  });
  it("usa espaço comum, não NBSP", () => {
    expect(formatBRL(10)).not.toContain("\u00A0");
  });
});
