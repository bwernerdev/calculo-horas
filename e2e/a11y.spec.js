const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("node:fs");

const supabaseMock = fs.readFileSync("e2e/supabase-mock.js", "utf8");
let server;

test.beforeAll(async () => {
  const { startStaticServer } = await import("../scripts/serve-static.mjs");
  server = await startStaticServer(4174);
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(async ({ page }) => {
  await page.route("**/assets/js/vendor/supabase.min.js", (route) => route.fulfill({ contentType: "text/javascript", body: supabaseMock }));
});

async function violations(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const theme of ["light", "dark"]) {
  test(`tela de entrada sem violações de acessibilidade (${theme})`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("controle-horas-tema-v1", value), theme);
    await page.goto("http://127.0.0.1:4174/");
    await expect(page.getByRole("heading", { name: "Entre no seu banco de horas" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test(`painel autenticado sem violações de acessibilidade (${theme})`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("e2e-authenticated", "true");
      localStorage.setItem("controle-horas-tema-v1", value);
    }, theme);
    await page.goto("http://127.0.0.1:4174/");
    await expect(page.getByRole("heading", { name: "Projete seu saldo de horas" })).toBeVisible();
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    expect(await violations(page)).toEqual([]);
  });
}

test("sem preferência salva, o tema acompanha o sistema operacional", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("a preferência salva prevalece sobre o tema do sistema", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("controle-horas-tema-v1", "light"));
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
