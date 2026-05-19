import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Empório LeleCute carousels.
 * Run locally: npx playwright test
 * BASE_URL env var lets you point at preview / staging / production.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        hasTouch: false,
        isMobile: false,
      },
    },
    {
      // Explicit tablet preset: iPad-like viewport + touch + UA
      name: "tablet",
      use: {
        ...devices["iPad (gen 7)"],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        defaultBrowserType: "webkit",
      },
    },
    {
      // Explicit mobile preset: iPhone 13-like viewport + touch + UA
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        defaultBrowserType: "webkit",
      },
    },
    {
      name: "android-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 393, height: 851 },
        hasTouch: true,
        isMobile: true,
        defaultBrowserType: "chromium",
      },
    },
    {
      name: "small-mobile",
      use: {
        ...devices["iPhone SE"],
        viewport: { width: 320, height: 568 },
        hasTouch: true,
        isMobile: true,
        defaultBrowserType: "webkit",
      },
    },
  ],
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
