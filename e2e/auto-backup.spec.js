const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { openMenu } = require("./helpers");

const supabaseMock = fs.readFileSync("e2e/supabase-mock.js", "utf8");
const row = { id: "11111111-1111-4111-8111-111111111111", date: "2026-09-01", type: "folga", start_time: "", end_time: "", break_minutes: 0, photos: {}, import_data: {} };
let server;

test.beforeAll(async () => {
  const { startStaticServer } = await import("../scripts/serve-static.mjs");
  server = await startStaticServer(4175);
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test.beforeEach(async ({ page }) => {
  await page.route("**/assets/js/vendor/supabase.min.js", (route) => route.fulfill({ contentType: "text/javascript", body: supabaseMock }));
});

function open(page, setup) {
  return page.addInitScript((init) => {
    localStorage.setItem("e2e-authenticated", "true");
    Object.assign(window, init);
  }, setup).then(() => page.goto("http://127.0.0.1:4175/"));
}

test("cria uma cópia automática sem fotos quando não há cópia recente", async ({ page }) => {
  await open(page, { __mockRecords: [row], __snapshots: [] });
  await expect(page.locator("#app-content")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__snapshotInserts?.length || 0)).toBe(1);
  const inserted = await page.evaluate(() => window.__snapshotInserts[0]);
  expect(inserted.record_count).toBe(1);
  expect(inserted.payload).toMatchObject({ versao: 1, registros: [{ id: row.id, data: "2026-09-01", tipo: "folga", fotos: { entrada: "", saida: "" } }] });
});

test("não cria outra cópia quando já existe uma das últimas 24 horas", async ({ page }) => {
  const recent = { id: "s1", created_at: new Date(Date.now() - 3600_000).toISOString(), record_count: 1 };
  await open(page, { __mockRecords: [row], __snapshots: [recent] });
  await expect(page.locator("#app-content")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__snapshotInserts?.length || 0)).toBe(0);
});

test("não cria cópia sem registros", async ({ page }) => {
  await open(page, { __snapshots: [] });
  await expect(page.locator("#app-content")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__snapshotInserts?.length || 0)).toBe(0);
});

test("lista as cópias e baixa uma delas em formato importável", async ({ page }) => {
  const payload = { versao: 1, configuracoes: { metaDiariaMinutos: 528, intervaloPadraoMinutos: 60, tema: "light", saldosManuais: {} }, registros: [] };
  const old = { id: "s1", created_at: new Date(Date.now() - 3 * 86400_000).toISOString(), record_count: 4 };
  await open(page, { __snapshots: [old], __snapshotPayload: payload });
  await openMenu(page, "Exportar");
  await page.locator("#open-auto-backups").click();
  await expect(page.locator("#auto-backup-list li")).toHaveCount(1);
  await expect(page.locator("#auto-backup-list")).toContainText("4 registro(s)");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#auto-backup-list").getByRole("button", { name: /Baixar cópia/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^backup-automatico-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(await fs.promises.readFile(await download.path(), "utf8"))).toEqual(payload);
});

test("avisa para aplicar a migração quando a tabela não existe", async ({ page }) => {
  await open(page, { __snapshotsMissing: true });
  await openMenu(page, "Exportar");
  await page.locator("#open-auto-backups").click();
  await expect(page.locator("#auto-backup-status")).toContainText("Aplique a migração");
});
