const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { zipSync, strToU8 } = require("fflate");

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

test("apaga todos os registros somente após confirmação digitada", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  await page.locator("#work-date").fill("2026-09-15");
  await page.locator("#submit-button").click();
  await expect(page.locator("#records-body tr")).toHaveCount(1);
  await page.locator("#clear-records").click();
  await expect(page.locator("#clear-records-dialog")).toBeVisible();
  await page.locator("#clear-records-cancel").click();
  await expect(page.locator("#records-body tr")).toHaveCount(1);
  await page.locator("#clear-records").click();
  await page.locator("#clear-records-confirmation").fill("apagar");
  await expect(page.locator("#clear-records-accept")).toBeDisabled();
  await page.locator("#clear-records-confirmation").fill("APAGAR");
  await page.locator("#clear-records-accept").click();
  await expect(page.locator("#records-body tr")).toHaveCount(0);
  await expect(page.locator("#clear-records")).toBeDisabled();
});

test("pesquisa um período editável entre meses e recalcula o resumo e a simulação", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  await page.locator("#month-filter").fill("2026-09");
  await page.locator("#month-filter").dispatchEvent("change");
  for (const date of ["2026-08-15","2026-08-16","2026-08-20","2026-09-15","2026-09-16"]) {
    await page.locator("#month-filter").fill(date.slice(0,7));
    await page.locator("#month-filter").dispatchEvent("change");
    await page.locator("#work-date").fill(date);
    if (date==="2026-08-20") await page.locator("#end-time").fill("18:48");
    else await page.locator("#end-time").fill("17:48");
    await page.locator("#submit-button").click();
    await expect(page.locator("#records-body")).toContainText(date.split("-").reverse().join("/"));
  }
  await page.locator("#month-filter").fill("2026-09");
  await page.locator("#month-filter").dispatchEvent("change");
  await expect(page.locator("#registered-days")).toHaveText("2");
  await expect(page.locator("#records-body tr")).toHaveCount(2);
  await expect(page.locator("#monthly-balance")).toContainText("0h 00min");
  await page.locator("#history-date-from").fill("2026-09-16");
  await page.locator("#history-date-to").fill("2026-08-15");
  await page.locator("#history-range-form").getByRole("button",{ name:"Pesquisar" }).click();
  await expect(page.locator("#history-range-message")).toContainText("não pode ser posterior");
  await expect(page.locator("#records-body tr")).toHaveCount(2);
  await page.locator("#history-date-from").fill("2026-08-16");
  await page.locator("#history-date-to").fill("2026-09-15");
  await page.locator("#history-range-form").getByRole("button",{ name:"Pesquisar" }).click();
  await expect(page.locator("#history-range-message")).toContainText("16/08/2026 a 15/09/2026");
  await expect(page.locator("#records-body tr")).toHaveCount(3);
  await expect(page.locator("#records-body")).toContainText("16/08/2026");
  await expect(page.locator("#records-body")).toContainText("15/09/2026");
  await expect(page.locator("#registered-days")).toHaveText("3");
  await expect(page.locator("#balance-period-label")).toHaveText("Saldo do período");
  await expect(page.locator("#monthly-balance")).toHaveText("+1h 00min");
  await expect(page.locator("#simulator-current-balance")).toHaveText("+1h 00min");
  await page.locator("#manual-positive").fill("1");
  await expect(page.locator("#simulator-projected-balance")).toHaveText("+2h 00min");
  const csvDownload=page.waitForEvent("download");
  await page.locator("#export-csv").click();
  expect((await csvDownload).suggestedFilename()).toBe("horas-2026-08-16-a-2026-09-15.csv");
  const pdfDownload=page.waitForEvent("download");
  await page.locator("#export-pdf").click();
  expect((await pdfDownload).suggestedFilename()).toBe("relatorio-horas-2026-08-16-a-2026-09-15.pdf");
  await page.locator("#history-range-clear").click();
  await expect(page.locator("#records-body tr")).toHaveCount(2);
  await expect(page.locator("#records-body")).toContainText("16/09/2026");
  await expect(page.locator("#balance-period-label")).toHaveText("Saldo do mês");
  await expect(page.locator("#monthly-balance")).toHaveText("0h 00min");
  await expect(page.locator("#simulator-current-balance")).toHaveText("0h 00min");
  await expect(page.locator("#simulator-projected-balance")).toHaveText("+1h 00min");
  await expect(page.locator("#history-date-from")).toHaveValue("");
  await expect(page.locator("#history-date-to")).toHaveValue("");
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

test("no mobile aceita horas inteiras e permite digitar dois-pontos no teclado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  await expect(page.locator(".time-entry[inputmode='text']")).toHaveCount(7);
  await expect(page.locator(".time-separator")).toHaveCount(0);
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
  await page.locator("#manual-negative").fill("2:30");
  await expect(page.locator("#simulator-projected-balance")).toContainText("-1h 30min");
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

test("importa XLSX Forponto com prévia e intervalo real", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  const cells = [
    ["A1", "16/08/2026 Dom-Folg"],
    ["A2", "17/08/2026 Seg-Norm"], ["F2", "08:00"], ["G2", "12:00"], ["H2", "12:45"], ["I2", "17:00"], ["S2", "00:30"],
    ["A3", "18/08/2026 Ter-Norm"], ["F3", "08:00"], ["G3", "12:00"], ["S3", "-05:20"],
    ["A4", "19/08/2026 Qua-Norm"], ["G4", "COMPENSA DIA"], ["S4", "-08:00"],
    ["A5", "16/08/2026 Dom"]
  ];
  const rowXml = [1,2,3,4,5].map((row) => "<row r=\"" + row + "\">" +
    cells.filter(([address]) => address.endsWith(String(row))).map(([address,value]) =>
      "<c r=\"" + address + "\" t=\"inlineStr\"><is><t>" + value + "</t></is></c>").join("") + "</row>").join("");
  const xml = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rowXml + '</sheetData></worksheet>';
  const buffer = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(xml) }));
  await page.locator("#forponto-file").setInputFiles({ name:"forponto.xlsx", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await expect(page.locator("#forponto-dialog")).toBeVisible();
  await page.locator("#forponto-block").selectOption("0");
  await expect(page.locator("#forponto-summary")).toContainText("4 novo(s)");
  await expect(page.locator("#forponto-preview-body")).toContainText("2 marcações; saldo final -05:20");
  await page.locator("#forponto-confirm").click();
  await expect(page.locator("#records-body")).toContainText("17/08/2026");
  await expect(page.locator("#records-body")).toContainText("45 min");
  await expect(page.locator("#records-body")).toContainText("18/08/2026");
  await expect(page.locator("#records-body")).toContainText("0 min");
  await expect(page.locator("#records-body")).toContainText("Compensação");
  await expect(page.locator("#records-body")).toContainText("-8h 00min");
  await page.locator("#forponto-file").setInputFiles({ name:"forponto.xlsx", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await page.locator("#forponto-block").selectOption("0");
  await expect(page.locator("#forponto-confirm")).toBeDisabled();
  await page.locator("#forponto-update-existing").check();
  await expect(page.locator("#forponto-summary")).toContainText("4 para atualizar");
  await page.locator("#forponto-confirm").click();
  await page.locator("#confirm-accept").click();
  await expect(page.locator("#records-body tr")).toHaveCount(4);
  const backupDownload=page.waitForEvent("download");
  await page.locator("#export-json").click();
  const backup=JSON.parse(await fs.promises.readFile(await (await backupDownload).path(), "utf8"));
  expect(backup.registros.find((record)=>record.data==="2026-08-18").dadosImportacao.officialBalanceMinutes).toBe(-320);
  expect(backup.registros.find((record)=>record.data==="2026-08-19")).toMatchObject({
    tipo:"compensacao", dadosImportacao:{ officialBalanceMinutes:-480 }
  });
});
