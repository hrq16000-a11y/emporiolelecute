import { expect, test, type Page } from "@playwright/test";

/**
 * Regressão SEO: páginas de catálogo com query string NÃO podem canonicalizar
 * para a URL com parâmetros. O canonical deve apontar para a URL base
 * (/produtos ou a taxonomia oficial /categoria/<slug>).
 */

async function canonicalHref(page: Page) {
  return page.locator('link[rel="canonical"]').first().getAttribute("href");
}

async function robotsContent(page: Page) {
  const meta = page.locator('meta[name="robots"]');
  return (await meta.count()) ? meta.first().getAttribute("content") : null;
}

async function openAndSettle(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(() => canonicalHref(page)).not.toBeNull();
}

test.describe("SEO — canonical em páginas filtradas", () => {
  test("um filtro estrutural canonicaliza para a taxonomia oficial", async ({ page }) => {
    await openAndSettle(page, "/produtos?categoria=sabonetes");
    const href = await canonicalHref(page);
    expect(href).toBeTruthy();
    expect(new URL(href!).search).toBe("");
    expect(new URL(href!).pathname).toMatch(/^\/(produtos|categoria\/[a-z0-9-]+)$/);
  });

  test("múltiplos filtros/paginação: canonical volta para /produtos e vira noindex", async ({ page }) => {
    await openAndSettle(page, "/produtos?categoria=sabonetes&ocasiao=maternidade&pagina=2");
    const href = await canonicalHref(page);
    expect(new URL(href!).pathname).toBe("/produtos");
    expect(new URL(href!).search).toBe("");
    await expect.poll(() => robotsContent(page)).toContain("noindex");
  });

  test("canonical permanece sem parâmetros após reload", async ({ page }) => {
    await openAndSettle(page, "/produtos?ocasiao=maternidade&search=lavanda");
    const before = await canonicalHref(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    await expect.poll(() => canonicalHref(page)).toBe(before);

    const after = await canonicalHref(page);
    expect(new URL(after!).search).toBe("");
    // Nunca deve haver mais de um canonical na página.
    expect(await page.locator('link[rel="canonical"]').count()).toBe(1);
  });

  test("página de categoria canonicaliza para si mesma", async ({ page }) => {
    await openAndSettle(page, "/categoria/sabonetes?page=1");
    const href = await canonicalHref(page);
    expect(new URL(href!).search).toBe("");
    expect(new URL(href!).pathname.startsWith("/categoria/")).toBe(true);
  });
});
