const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { openMenu } = require("./helpers");

const supabaseMock = fs.readFileSync("e2e/supabase-mock.js", "utf8");
const row = (n, date, type, start, end) => ({ id: `00000000-0000-4000-8000-0000000000${n}`, date, type, start_time: start, end_time: end, break_minutes: type === "trabalho" ? 60 : 0, photos: {}, import_data: {} });
const records = [
  row(10, "2026-10-19", "trabalho", "08:00", "17:48"),
  row(11, "2026-10-20", "trabalho", "08:00", "19:00"),
  row(12, "2026-10-21", "folga", "", ""),
  row(13, "2026-09-18", "trabalho", "08:00", "17:48"),
];
let server;

test.beforeAll(async () => {
  const { startStaticServer } = await import("../scripts/serve-static.mjs");
  server = await startStaticServer(4176);
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(async ({ page }) => {
  await page.route("**/assets/js/vendor/supabase.min.js", (route) => route.fulfill({ contentType: "text/javascript", body: supabaseMock }));
  await page.clock.setFixedTime(new Date("2026-10-29T12:00:00-03:00"));
});

async function open(page, init = {}) {
  await page.addInitScript((data) => {
    localStorage.setItem("e2e-authenticated", "true");
    Object.assign(window, data);
  }, init);
  await page.goto("http://127.0.0.1:4176/");
  await expect(page.locator("#app-content")).toBeVisible();
}

test("calendário cobre o ciclo de 16 a 15 e abre o registro ao ativar um dia", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator("#calendar-grid .calendar-day")).toHaveCount(31);
  await expect(page.locator('[data-date="2026-10-19"]')).toHaveClass(/calendar-day--trabalho/);
  await expect(page.locator('[data-date="2026-10-21"]')).toHaveClass(/calendar-day--folga/);
  await page.locator('[data-date="2026-10-19"]').click();
  await expect(page.locator("#form-title")).toHaveText("Editar jornada");
  await expect(page.locator("#work-date")).toHaveValue("2026-10-19");
});

test("dia sem registro preenche a data do formulário", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await page.locator('[data-date="2026-10-25"]').click();
  await expect(page.locator("#form-title")).toHaveText("Registrar jornada");
  await expect(page.locator("#work-date")).toHaveValue("2026-10-25");
});

test("gráfico de saldo diário tem uma barra por dia registrado", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator("#balance-chart .chart-bar")).toHaveCount(3);
  await expect(page.locator("#balance-chart-caption")).toContainText("Maior saldo");
});

test("cartões mostram variação em relação ao ciclo anterior e meta cumprida", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator("#balance-delta")).toBeVisible();
  await expect(page.locator("#balance-delta")).toContainText("em relação ao ciclo anterior");
  await expect(page.locator("#worked-meter")).toBeVisible();
  await expect(page.locator("#worked-meter-label")).toContainText("Meta cumprida:");
});

test("sem registros mostra o estado vazio e o botão leva ao formulário", async ({ page }) => {
  await open(page);
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.locator("#empty-state-add").click();
  await expect(page.locator("#work-date")).toBeFocused();
});

test("formulário pode ser recolhido e a escolha é lembrada", async ({ page }) => {
  await open(page);
  await expect(page.locator("#hours-form")).toBeVisible();
  await page.locator("#entry-toggle").click();
  await expect(page.locator("#hours-form")).toBeHidden();
  await expect(page.locator("#entry-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.locator("#hours-form")).toBeHidden();
  await page.locator("#entry-toggle").click();
  await expect(page.locator("#hours-form")).toBeVisible();
});

test("menus: abre um por vez, fecha com Esc e ao escolher um item", async ({ page }) => {
  await open(page);
  await openMenu(page, "Exportar");
  await expect(page.locator("#export-csv")).toBeVisible();
  await openMenu(page, "Importar");
  await expect(page.locator("#export-csv")).toBeHidden();
  await expect(page.locator("#import-json")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#import-json")).toBeHidden();
  await openMenu(page, "Mais");
  await expect(page.locator("#clear-records")).toBeVisible();
  await page.locator("h1").click();
  await expect(page.locator("#clear-records")).toBeHidden();
});

test("no celular o botão flutuante aparece fora do formulário e leva até ele", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await open(page, { __mockRecords: records });
  await page.locator("#cycle-calendar").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 900);
  await expect(page.locator("#fab-add")).toBeVisible();
  await page.locator("#fab-add").click();
  await expect(page.locator("#work-date")).toBeFocused();
});
