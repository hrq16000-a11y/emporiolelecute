import { test, expect, Page } from "@playwright/test";

/**
 * E2E tests for CategoriesScroll and OccasionsThumbs carousels.
 *
 * Run all projects (desktop + tablet + mobile):
 *   npx playwright test
 *
 * Run a single project:
 *   npx playwright test --project=mobile
 *
 * Run against a deployed URL (skip dev server):
 *   BASE_URL=https://emporiolelecute.com.br PW_NO_SERVER=1 npx playwright test
 */

// Stable data-testid selectors — survive ARIA copy changes.
const CATEGORIES = '[data-testid="categories-carousel"]';
const OCCASIONS  = '[data-testid="occasions-carousel"]';

// Exercise both components independently of editable production home settings.
// A desktop width with overflow is necessary to test scrolling twelve occasions.
test.beforeEach(async ({ page, isMobile }) => {
  if (!isMobile) await page.setViewportSize({ width: 1024, height: 900 });
  const sections = ["CategoriesScroll", "OccasionsThumbs"].map((name, i) => ({
    id: `section-${i}`, section_key: name, component_name: name,
    label: name, description: null, is_visible: true, position: i * 10,
    editable_props: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  }));
  await page.route("**/rest/v1/home_sections?*", (route) =>
    route.fulfill({ json: sections }));
  for (const table of ["categories", "occasions"]) {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `${table}-${i}`, name: `${table === "categories" ? "Categoria" : "Ocasião"} ${i + 1}`,
      slug: `${table}-${i + 1}`, is_draft: false, is_indexed: true,
      position: i, image_url: "/placeholder.svg", icon: "Gift",
    }));
    await page.route(`**/rest/v1/${table}?*`, (route) => route.fulfill({ json: rows }));
  }
});

async function waitForCarousels(page: Page) {
  await page.goto("/");
  await expect(page.locator(CATEGORIES)).toBeVisible();
  await expect(page.locator(OCCASIONS)).toBeVisible();
  await expect(page.getByTestId("category-item")).toHaveCount(12);
  await expect(page.getByTestId("occasion-item")).toHaveCount(12);
}

test.describe("Carousels — keyboard navigation", () => {
  test("Categories: arrow keys move active item without flicker", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(CATEGORIES);
    await carousel.focus();

    const initialActive = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(350); // smooth-scroll settle
    const nextActive = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(nextActive).not.toBe(initialActive);

    // End jumps to last; Home jumps to first.
    await page.keyboard.press("End");
    await page.waitForTimeout(350);
    const last = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    await page.keyboard.press("Home");
    await page.waitForTimeout(350);
    const first = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(last).not.toBe(first);

    // ARIA live region announces focused category.
    await expect(page.getByRole("region", { name: "Categorias", exact: true }).locator('[aria-live="polite"]')).toContainText(/Categoria em foco/i);
  });

  test("Occasions: arrow keys move active item and announce via aria-live", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(OCCASIONS);
    await carousel.focus();
    const before = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(350);
    const after = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(after).not.toBe(before);
    await expect(page.getByRole("region", { name: "Ocasiões especiais", exact: true }).locator('[aria-live="polite"]')).toContainText(/Ocasião em foco/i);
  });
});

test.describe("Carousels — mouse scroll (desktop only)", () => {
  test.skip(({ isMobile }) => !!isMobile, "Mouse wheel not applicable on touch devices");

  test("Categories: scrollBy via arrow buttons updates active without flicker", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(CATEGORIES);
    // Hover to reveal arrows.
    await carousel.hover();
    const next = page.getByRole("button", { name: /Próxima categoria/i });
    await expect(next).toBeVisible();

    const beforeId = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    await next.click();
    await page.waitForTimeout(500);
    const afterId = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(afterId).not.toBe(beforeId);

    // Click again rapidly — should still settle on a single item (no flicker).
    await next.click();
    await next.click();
    await page.waitForTimeout(700);
    const selectedCount = await carousel.locator('[aria-selected="true"]').count();
    expect(selectedCount).toBe(1);
  });

  test("Occasions: arrow buttons present and operate carousel", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(OCCASIONS);
    await carousel.hover();
    const next = page.getByRole("button", { name: /Próxima ocasião/i });
    await expect(next).toBeVisible();
    const before = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    await next.click();
    await page.waitForTimeout(500);
    const after = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(after).not.toBe(before);
  });
});

test.describe("Carousels — touch swipe (mobile + tablet)", () => {
  test.skip(({ isMobile, browserName }) => !isMobile && browserName !== "webkit", "Touch tests only on mobile/tablet projects");

  async function swipeLeft(page: Page, selector: string) {
    const box = await page.locator(selector).boundingBox();
    if (!box) throw new Error("Carousel not found");
    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.85;
    const endX   = box.x + box.width * 0.15;
    await page.touchscreen.tap(startX, y); // ensure focus
    // Programmatic touch sequence
    await page.evaluate(({ sel, sx, ex, ty }) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return;
      const t = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: ty, radiusX: 1, radiusY: 1 });
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [t(sx)], bubbles: true, cancelable: true }));
      el.dispatchEvent(new TouchEvent("touchmove",  { touches: [t(ex)], bubbles: true, cancelable: true }));
      el.dispatchEvent(new TouchEvent("touchend",   { changedTouches: [t(ex)], bubbles: true, cancelable: true }));
      // Also nudge scrollLeft to simulate the native scroll consequence.
      el.scrollBy({ left: sx - ex, behavior: "smooth" });
    }, { sel: selector, sx: startX, ex: endX, ty: y });
    await page.waitForTimeout(600);
  }

  test("Categories: swipe left changes the active category", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(CATEGORIES);
    const before = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    await swipeLeft(page, CATEGORIES);
    const after = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(after).not.toBe(before);
  });

  test("Occasions: swipe left changes the active occasion", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(OCCASIONS);
    const before = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    await swipeLeft(page, OCCASIONS);
    const after = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(after).not.toBe(before);
  });
});

test.describe("Carousels — anti-flicker on micro scrolls", () => {
  test("tiny scroll deltas (<18px gap) do NOT toggle active item", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(CATEGORIES);
    await carousel.evaluate((el) => { (el as HTMLElement).scrollLeft = 0; });
    await page.waitForTimeout(150);
    const initial = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");

    for (let i = 0; i < 10; i++) {
      const delta = (i % 2 === 0 ? 1 : -1) * 5;
      await carousel.evaluate((el, d) => { (el as HTMLElement).scrollLeft += d; }, delta);
      await page.waitForTimeout(40);
    }
    const after = await carousel.locator('[aria-selected="true"]').first().getAttribute("id");
    expect(after).toBe(initial);
  });

  test("active item toggles AT MOST ONCE across many <18px micro-scrolls", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(CATEGORIES);
    await carousel.evaluate((el) => { (el as HTMLElement).scrollLeft = 0; });
    await page.waitForTimeout(200);

    // Instrument: observe aria-selected changes via MutationObserver.
    await page.evaluate((sel) => {
      const root = document.querySelector(sel) as HTMLElement | null;
      if (!root) return;
      (window as any).__activeChanges = 0;
      (window as any).__lastActiveId = root.querySelector('[aria-selected="true"]')?.id ?? null;
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "attributes" && m.attributeName === "aria-selected") {
            const t = m.target as HTMLElement;
            if (t.getAttribute("aria-selected") === "true") {
              const id = t.id;
              if (id && id !== (window as any).__lastActiveId) {
                (window as any).__activeChanges += 1;
                (window as any).__lastActiveId = id;
              }
            }
          }
        }
      });
      obs.observe(root, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
      (window as any).__activeObs = obs;
    }, CATEGORIES);

    // 30 jitter scrolls below the 18px threshold (±8px each).
    for (let i = 0; i < 30; i++) {
      const delta = (i % 2 === 0 ? 1 : -1) * 8;
      await carousel.evaluate((el, d) => { (el as HTMLElement).scrollLeft += d; }, delta);
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(250);

    const changes = await page.evaluate(() => (window as any).__activeChanges ?? 0);
    // STRICT: micro-scrolls below threshold must NOT toggle the active item.
    expect(changes, `aria-selected toggled ${changes}× during sub-threshold jitter`).toBeLessThanOrEqual(1);
  });
});

test.describe("ARIA & focus management", () => {
  test("Categories carousel exposes listbox semantics with selected option", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(CATEGORIES);
    await expect(carousel).toHaveAttribute("role", "listbox");
    const selected = carousel.locator('[role="option"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);
  });

  test("Occasions carousel exposes listbox semantics with selected option", async ({ page }) => {
    await waitForCarousels(page);
    const carousel = page.locator(OCCASIONS);
    await expect(carousel).toHaveAttribute("role", "listbox");
    const selected = carousel.locator('[role="option"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);
  });
});
