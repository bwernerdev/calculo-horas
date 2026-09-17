const { test, expect, devices } = require("@playwright/test");
const fs = require("node:fs");

test.use({ ...devices["Pixel 5"] });

const supabaseMock = fs.readFileSync("e2e/supabase-mock.js", "utf8");
let server;

test.beforeAll(async () => {
  const { startStaticServer } = await import("../scripts/serve-static.mjs");
  server = await startStaticServer(4173);
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(async ({ page }) => {
  await page.route("**/assets/js/vendor/supabase.min.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: supabaseMock,
  }));
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
});

test("mantém exportação e registro acessíveis por toque no celular", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
  await expect(page.locator("#export-csv")).toBeVisible();
  await page.locator("#theme-toggle").tap();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#work-date").fill("2026-09-15");
  await page.locator("#submit-button").tap();
  await expect(page.locator("#records-body tr")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("respeita a preferência por movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  const button = page.locator("#submit-button");
  expect(await button.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
});
