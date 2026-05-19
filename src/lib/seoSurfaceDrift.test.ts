/**
 * Fase 2.1 — Drift detection entre superfícies SEO públicas e helpers canônicos.
 *
 * Falha quando:
 *  - frontend helper (`src/lib/urls.ts`) e edge helper
 *    (`supabase/functions/_shared/urls.ts`) divergem em PREFIXO ou ORIGEM.
 *  - `public/sitemap.xml` referencia um namespace de produto diferente do
 *    PRODUCT_PATH_PREFIX atual.
 *  - `public/robots.txt` referencia uma origem canônica diferente.
 *  - alguma edge function reintroduz hardcode `/produtos/` ou `/produto/`
 *    fora do helper compartilhado.
 *
 * Inerte (não muda comportamento público). Apenas trava drift via CI.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  CANONICAL_ORIGIN,
  PRODUCT_PATH_PREFIX,
  LEGACY_PRODUCT_PATH_PREFIX,
} from "./urls";

const read = (p: string) => readFileSync(resolve(p), "utf8");

describe("SEO surface drift (Phase 2.1)", () => {
  it("frontend e edge helpers concordam em prefixo e origem", () => {
    const edge = read("supabase/functions/_shared/urls.ts");
    expect(edge).toMatch(
      new RegExp(`PRODUCT_PATH_PREFIX\\s*=\\s*"${PRODUCT_PATH_PREFIX}"`),
    );
    expect(edge).toMatch(
      new RegExp(
        `LEGACY_PRODUCT_PATH_PREFIX\\s*=\\s*"${LEGACY_PRODUCT_PATH_PREFIX}"`,
      ),
    );
    expect(edge).toContain(`CANONICAL_ORIGIN = "${CANONICAL_ORIGIN}"`);
  });

  it("public/sitemap.xml usa apenas o namespace canônico atual", () => {
    const xml = read("public/sitemap.xml");
    // Não deve referenciar o prefixo legado em <loc>.
    const legacyLocs = xml.match(
      new RegExp(`<loc>[^<]*${LEGACY_PRODUCT_PATH_PREFIX}/[^<]+</loc>`, "g"),
    );
    expect(legacyLocs ?? []).toEqual([]);
    // Deve ter pelo menos uma entrada no namespace atual.
    expect(xml).toContain(`${PRODUCT_PATH_PREFIX}/`);
  });

  it("public/sitemap.xml foi gerado pela edge function (anti-drift)", () => {
    const xml = read("public/sitemap.xml");
    expect(xml).toMatch(/<!--\s*lovable:sitemap-source\s+generate-sitemap/);
    const ns = xml.match(/<!--\s*lovable:sitemap-namespace\s+([^\s-]+)\s*-->/);
    expect(ns?.[1], "marcador de namespace ausente").toBeTruthy();
    expect(ns?.[1]).toBe(PRODUCT_PATH_PREFIX);
  });

  it(".sitemap-source.json existe e bate com o XML materializado", () => {
    const xml = read("public/sitemap.xml");
    const meta = JSON.parse(read("public/.sitemap-source.json"));
    expect(meta.namespace).toBe(PRODUCT_PATH_PREFIX);
    expect(meta.bytes).toBe(xml.length);
    expect(meta.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("public/robots.txt aponta para a origem canônica", () => {
    const robots = read("public/robots.txt");
    expect(robots).toContain(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`);
  });

  it("edge functions de SEO não reintroduzem hardcode de namespace de produto", () => {
    // Allowlist: helper compartilhado pode/deve ter o literal.
    const files = [
      "supabase/functions/generate-sitemap/index.ts",
      "supabase/functions/merchant-feed/index.ts",
    ];
    for (const f of files) {
      const src = read(f);
      // Pattern: literais como "/produtos/${...}" ou `/produto/...` que NÃO
      // venham via helper. Procuramos template strings de URL absoluta.
      const hardcoded = src.match(
        /[`"']\/(produtos|produto)\/\$\{[^}]+\}[`"']/g,
      );
      expect(hardcoded, `${f} contém hardcode de namespace`).toBeNull();
    }
  });
});
