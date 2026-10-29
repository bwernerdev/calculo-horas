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
// O service worker passaria por cima do mock do Supabase após um reload.
test.use({ serviceWorkers: "block" });

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

test("marca dias úteis passados sem registro como pendência", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator("#pending-count")).toContainText("pendência");
  await expect(page.locator('[data-date="2026-10-16"]')).toHaveClass(/calendar-day--pending/);
  await expect(page.locator('[data-date="2026-10-19"]')).not.toHaveClass(/calendar-day--pending/);
  await expect(page.locator('[data-date="2026-10-17"]')).not.toHaveClass(/calendar-day--pending/);
});

test("mostra a previsão de horas por dia útil para zerar o ciclo", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator("#cycle-forecast")).toBeVisible();
  await expect(page.locator("#cycle-forecast")).toContainText("dias úteis");
});

test("evolução por ciclo compara os ciclos com registros", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator("#cycle-history")).toBeVisible();
  await page.locator("#cycle-history > summary").click();
  await expect(page.locator("#cycle-history-chart .chart-bar")).toHaveCount(2);
  await expect(page.locator("#cycle-history-labels > span")).toHaveCount(2);
});

test("calendário navega por setas com um único ponto de tabulação", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator('#calendar-grid [tabindex="0"]')).toHaveCount(1);
  await page.locator('[data-date="2026-10-29"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-date="2026-10-30"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-date="2026-11-06"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator('[data-date="2026-10-16"]')).toBeFocused();
  await expect(page.locator('#calendar-grid [tabindex="0"]')).toHaveCount(1);
});

test("excluir mostra Desfazer e o registro volta ao desfazer", async ({ page }) => {
  await open(page, { __mockRecords: records });
  const rowsBefore = await page.locator("#records-body tr").count();
  await page.locator("#records-body tr").first().getByRole("button", { name: "Excluir" }).click();
  await expect(page.locator("#records-body tr")).toHaveCount(rowsBefore - 1);
  await expect(page.locator("#toast-region")).toContainText("excluído");
  await page.locator(".toast__action", { hasText: "Desfazer" }).click();
  await expect(page.locator("#records-body tr")).toHaveCount(rowsBefore);
  expect(await page.evaluate(() => window.__deletes?.length || 0)).toBe(0);
});

test("excluir sem desfazer remove de fato depois de alguns segundos", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await page.locator("#records-body tr").first().getByRole("button", { name: "Excluir" }).click();
  await expect.poll(() => page.evaluate(() => window.__deletes?.length || 0), { timeout: 12000 }).toBe(1);
});

test("Entrada agora preenche a hora atual e a saída sugerida; Saída agora preenche a saída", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Entrada agora" }).click();
  await expect(page.locator("#start-time")).toHaveValue(/^\d\d:\d\d$/);
  await expect(page.locator("#end-time")).toHaveValue(/^\d\d:\d\d$/);
  await expect(page.locator("#submit-button")).toBeFocused();
  await page.getByRole("button", { name: "Saída agora" }).click();
  await expect(page.locator("#end-time")).toHaveValue(/^\d\d:\d\d$/);
  await expect(page.locator("#work-date")).toHaveValue("2026-10-29");
});

test("configuração aceita intervalo padrão e meta por dia da semana", async ({ page }) => {
  await open(page);
  await page.locator("#settings-toggle").click();
  await page.locator("#default-break").fill("45");
  await page.locator("#settings-form summary").click();
  await page.locator("#target-dow-5").fill("6");
  await page.locator("#target-dow-5").blur();
  await expect(page.locator("#target-dow-5")).toHaveValue("06:00");
  await page.locator("#settings-form").getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.locator("#toast-region")).toContainText("Configuração salva");
  await expect(page.locator("#break-time")).toHaveValue("45");
  await page.locator("#settings-toggle").click();
  await expect(page.locator("#target-dow-5")).toHaveValue("06:00");
  await expect(page.locator("#default-break")).toHaveValue("45");
});

test("meta por dia da semana altera o saldo do dia correspondente", async ({ page }) => {
  await open(page, { __mockRecords: [row(20, "2026-10-23", "trabalho", "08:00", "14:00")] });
  await expect(page.locator('[data-date="2026-10-23"] .calendar-day__v')).toHaveText("−3:48");
  await page.locator("#settings-toggle").click();
  await page.locator("#settings-form summary").click();
  await page.locator("#target-dow-5").fill("5");
  await page.locator("#target-dow-5").blur();
  await page.locator("#settings-form").getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.locator("#toast-region")).toContainText("Configuração salva");
  await expect(page.locator('[data-date="2026-10-23"] .calendar-day__v')).toHaveText("0:00");
});

test("PDF inclui a página do calendário e o XLSX traz os registros", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await openMenu(page, "Exportar");
  const pdfPromise = page.waitForEvent("download");
  await page.locator("#export-pdf").click();
  const pdf = await fs.promises.readFile(await (await pdfPromise).path(), "latin1");
  expect(pdf).toContain("/Count 2");
  expect(pdf).toContain("Calend");
  await openMenu(page, "Exportar");
  const xlsxPromise = page.waitForEvent("download");
  await page.locator("#export-xlsx").click();
  const download = await xlsxPromise;
  expect(download.suggestedFilename()).toMatch(/^horas-.*\.xlsx$/);
  const files = require("fflate").unzipSync(new Uint8Array(await fs.promises.readFile(await download.path())));
  const sheet = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
  expect(sheet).toContain("Trabalho");
  expect(sheet).toContain("Folga");
  expect(sheet).toContain("Total");
});

test("sem conexão: salva localmente, avisa e sincroniza quando a internet volta", async ({ page, context }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator("#offline-banner")).toBeHidden();
  await page.evaluate(() => localStorage.setItem("e2e-offline", "true"));
  await context.setOffline(true);
  await expect(page.locator("#offline-banner")).toContainText("Sem conexão");
  await page.locator("#work-date").fill("2026-10-27");
  await page.locator("#start-time").fill("08:00");
  await page.locator("#end-time").fill("17:48");
  await page.getByRole("button", { name: "Adicionar registro" }).click();
  await expect(page.locator("#toast-region")).toContainText("salvo neste dispositivo");
  await expect(page.locator("#offline-banner")).toContainText("1 alteração aguarda");
  await expect(page.locator('[data-date="2026-10-27"]')).toHaveClass(/calendar-day--trabalho/);
  expect(await page.evaluate(() => window.__upserts?.length || 0)).toBe(0);
  await page.evaluate(() => localStorage.setItem("e2e-offline", "false"));
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => window.__upserts?.length || 0)).toBe(1);
  await expect(page.locator("#offline-banner")).toBeHidden();
});

test("abre sem conexão usando a cópia local e volta ao normal ao reconectar", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await expect(page.locator('[data-date="2026-10-19"]')).toHaveClass(/calendar-day--trabalho/);
  await page.waitForTimeout(600);
  await page.evaluate(() => localStorage.setItem("e2e-offline", "true"));
  await page.reload();
  await expect(page.locator("#app-content")).toBeVisible();
  await expect(page.locator("#offline-banner")).toContainText("Modo offline");
  await expect(page.locator('[data-date="2026-10-19"]')).toHaveClass(/calendar-day--trabalho/);
  await page.evaluate(() => {
    localStorage.setItem("e2e-offline", "false");
    window.dispatchEvent(new Event("online"));
  });
  await expect(page.locator("#offline-banner")).toBeHidden();
});

test("sem cópia local e sem conexão, volta para a tela de entrada", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("e2e-authenticated", "true"); localStorage.setItem("e2e-offline", "true"); });
  await page.goto("http://127.0.0.1:4176/");
  await expect(page.getByRole("heading", { name: "Entre no seu banco de horas" })).toBeVisible();
  await expect(page.locator("#auth-message")).toContainText("Não foi possível carregar");
});

test("sair apaga a cópia local dos dados", async ({ page }) => {
  await open(page, { __mockRecords: records });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("controle-horas-cache-v1")).length)).toBe(1);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("heading", { name: "Entre no seu banco de horas" })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("controle-horas-cache-v1")).length)).toBe(0);
});

test("exclusão sem conexão fica na fila de sincronização", async ({ page, context }) => {
  await open(page, { __mockRecords: records });
  await page.evaluate(() => localStorage.setItem("e2e-offline", "true"));
  await context.setOffline(true);
  await page.locator("#records-body tr").first().getByRole("button", { name: "Excluir" }).click();
  await expect(page.locator("#offline-banner")).toContainText("1 alteração aguarda", { timeout: 15000 });
});
