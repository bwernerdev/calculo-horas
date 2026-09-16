const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

const supabaseMock = fs.readFileSync("e2e/supabase-mock.js", "utf8");
let server;

test.beforeAll(async () => {
  const { startStaticServer } = await import("../scripts/serve-static.mjs");
  server = await startStaticServer(4173);
});

test.afterAll(async () => {
  if (!server) return;
  server?.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(async ({ page }) => {
  await page.route("https://unpkg.com/@supabase/supabase-js@2", (route) => route.fulfill({
    contentType: "text/javascript",
    body: supabaseMock,
  }));
});

test("abre autenticação e persiste a preferência de tema", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entre no seu banco de horas" })).toBeVisible();
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("entra na conta e registra uma jornada", async ({ page }) => {
  await page.goto("/");
  await page.locator("#auth-email").fill("teste@example.com");
  await page.locator("#auth-password").fill("Senha123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator("#app-content")).toBeVisible();
  await page.locator("#work-date").fill("2026-09-15");
  await page.getByRole("button", { name: "Adicionar registro" }).click();
  await expect(page.locator("#records-body")).toContainText("15/09/2026");
  await expect(page.locator("#toast-region")).toContainText("Jornada registrada com sucesso");
});

test("carrega a conta e calcula a simulação pessoal", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Projete seu saldo de horas" })).toBeVisible();
  await page.locator("#manual-positive").fill("02:00");
  await page.locator("#manual-negative").fill("00:30");
  await expect(page.locator("#simulator-projected-balance")).toContainText("1h 30min");
  await expect(page.locator("#simulator-suggested-exit")).not.toHaveText("—");
  await expect(page.locator("#update-notice")).toBeHidden();
});

test("no mobile aceita horas inteiras e oferece separador em todos os campos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  await expect(page.locator(".time-separator")).toHaveCount(7);
  await page.locator("#manual-positive").fill("1");
  await expect(page.locator("#simulator-projected-balance")).toContainText("1h 00min");
  await page.locator("#manual-positive").blur();
  await expect(page.locator("#manual-positive")).toHaveValue("1:00");
  await page.locator("#simulator-start-time").fill("830");
  await page.locator("#simulator-start-time").blur();
  await expect(page.locator("#simulator-start-time")).toHaveValue("08:30");
  await page.locator("#settings-toggle").click();
  await page.locator("#daily-target").fill("8");
  await page.locator("#settings-form").getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.locator("#daily-target")).toHaveValue("08:00");
  await page.locator("#start-time").fill("830");
  await page.locator("#end-time").fill("1730");
  await page.locator("#work-date").fill("2026-09-15");
  await page.getByRole("button", { name: "Adicionar registro" }).click();
  await expect(page.locator("#records-body")).toContainText("08:30");
  await expect(page.locator("#records-body")).toContainText("17:30");
  await page.locator("#manual-negative").fill("2");
  await page.locator("#manual-negative").locator("xpath=..").getByRole("button", { name: /Inserir dois-pontos/ }).click();
  await expect(page.locator("#manual-negative")).toHaveValue("2:");
});

test("exporta um backup JSON válido", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-json").click();
  const download = await downloadPromise;
  const content = JSON.parse(await fs.promises.readFile(await download.path(), "utf8"));
  expect(content).toMatchObject({ versao: 1, registros: [] });
});
