import { expect, test, type Page } from "@playwright/test";

/**
 * Regressão: "Limpar filtros" deve apagar a ocasião persistida no navegador,
 * garantindo que /produtos nunca re-aplique um filtro antigo após reload.
 */

const OCCASION_STORAGE_KEY = "produtos:occasion";

async function openCatalog(page: Page, query = "") {
  await page.goto(`/produtos${query}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
}

async function storedOccasion(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), OCCASION_STORAGE_KEY);
}

async function clearFilters(page: Page) {
  const primary = page.getByTestId("clear-filters");
  const fallback = page.getByTestId("clear-filters-empty");
  if (await primary.count()) await primary.first().click();
  else await fallback.first().click();
}

test.describe("Catálogo — limpar filtros", () => {
  test("apaga a ocasião salva e não re-aplica após reload", async ({ page }) => {
    // 1. Entra com uma ocasião na URL — ela é persistida no navegador.
    await openCatalog(page, "?ocasiao=maternidade");
    await expect.poll(() => storedOccasion(page)).toBe("maternidade");

    // 2. Limpa os filtros.
    await clearFilters(page);

    // URL sem query strings de filtro e memória local apagada.
    await expect.poll(() => new URL(page.url()).searchParams.get("ocasiao")).toBeNull();
    await expect.poll(() => storedOccasion(page)).toBeNull();

    // 3. Reload: a ocasião NÃO pode voltar.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("ocasiao")).toBeNull();
    expect(await storedOccasion(page)).toBeNull();

    // 4. Revisita /produtos do zero: continua sem filtro.
    await openCatalog(page);
    expect(new URL(page.url()).searchParams.get("ocasiao")).toBeNull();
    expect(await storedOccasion(page)).toBeNull();
  });

  test("mostra feedback visual 'Filtros removidos'", async ({ page }) => {
    await openCatalog(page, "?ocasiao=maternidade");
    await clearFilters(page);
    await expect(page.getByText("Filtros removidos")).toBeVisible();
  });
});
