const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { zipSync, strToU8 } = require("fflate");

function forpontoPdfFixture() {
  const text=(value,x,y)=>`BT /F1 9 Tf 1 0 0 1 ${x} ${y} Tm (${value}) Tj ET`;
  const detailed=[
    text("SALDO",605.8,505.6),
    text("16/08/2026 Dom-Folg",39.8,487.6),
    text("17/08/2026 Seg-Norm",39.8,475.6),text("08:00",196.8,475.6),text("12:00",226,475.6),text("12:45",255.1,475.6),text("17:00",284.3,475.6),text("00:30",607.5,475.6),
    text("18/08/2026 Ter-Norm",39.8,463.6),text("08:00",196.8,463.6),text("12:00",226,463.6),text("-05:20",607.5,463.6),
    text("19/08/2026 Qua-Norm",39.8,451.6),text("COMPENSA DIA",217,451.6),text("-08:00",607.5,451.6),
    text("15/09/2026 Ter-Norm",39.8,439.6),text("08:00",196.8,439.6),text("12:00",226,439.6),text("13:00",255.1,439.6),text("17:48",284.3,439.6)
  ].join("\n");
  const summary=[text("16/08/2026 Dom",39.8,487.6),text("17/08/2026 Seg",39.8,475.6)].join("\n");
  const objects=[];
  objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
  objects[2]="<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>";
  objects[3]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>";
  objects[4]=`<< /Length ${Buffer.byteLength(detailed)} >>\nstream\n${detailed}\nendstream`;
  objects[5]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>";
  objects[6]=`<< /Length ${Buffer.byteLength(summary)} >>\nstream\n${summary}\nendstream`;
  objects[7]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let pdf="%PDF-1.4\n";
  const offsets=[0];
  for (let id=1;id<objects.length;id++) { offsets[id]=Buffer.byteLength(pdf); pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id=1;id<objects.length;id++) pdf+=`${String(offsets[id]).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

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
  await page.route("**/assets/js/vendor/supabase.min.js", (route) => route.fulfill({
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

test("inicializa com a biblioteca local real do Supabase", async ({ page }) => {
  await page.unroute("**/assets/js/vendor/supabase.min.js");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entre no seu banco de horas" })).toBeVisible();
  expect(await page.evaluate(() => typeof window.supabase.createClient)).toBe("function");
});

test("continua utilizável e avisa quando o armazenamento é bloqueado", async ({ page }) => {
  await page.unroute("**/assets/js/vendor/supabase.min.js");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() { throw new DOMException("Armazenamento bloqueado", "SecurityError"); },
  }));
  await page.goto("/");
  await expect(page.locator("#storage-warning")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entre no seu banco de horas" })).toBeVisible();
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => window.AppStorage.persistent)).toBe(false);
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

test("mantém ferramentas e cartões alinhados em telas pequenas e grandes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      cards: getComputedStyle(document.querySelector(".summary-grid")).gridTemplateColumns.split(" ").length,
      toolbar: getComputedStyle(document.querySelector(".toolbar")).gridTemplateColumns.split(" ").length,
    }));
    expect(layout.overflow, `overflow horizontal em ${width}px`).toBe(false);
    expect(layout.cards).toBe(width <= 580 ? 2 : width <= 900 ? 2 : 3);
    expect(layout.toolbar).toBe(width <= 580 ? 1 : 2);
  }
});

test("abre automaticamente o ciclo vigente após o dia 15", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-16T12:00:00-03:00"));
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  await expect(page.locator("#month-filter")).toHaveValue("2026-10");
  await expect(page.locator("#balance-period-dates")).toHaveText("16/09/2026 a 15/10/2026");
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
    const closingMonth=date==="2026-08-15" ? "2026-08" : date==="2026-09-16" ? "2026-10" : "2026-09";
    await page.locator("#month-filter").fill(closingMonth);
    await page.locator("#month-filter").dispatchEvent("change");
    await page.locator("#work-date").fill(date);
    if (date==="2026-08-20") await page.locator("#end-time").fill("18:48");
    else await page.locator("#end-time").fill("17:48");
    await page.locator("#submit-button").click();
    await expect(page.locator("#records-body")).toContainText(date.split("-").reverse().join("/"));
  }
  await page.locator("#month-filter").fill("2026-09");
  await page.locator("#month-filter").dispatchEvent("change");
  await expect(page.locator("#registered-days")).toHaveText("3");
  await expect(page.locator("#records-body tr")).toHaveCount(3);
  await expect(page.locator("#balance-period-dates")).toHaveText("16/08/2026 a 15/09/2026");
  await expect(page.locator("#monthly-balance")).toHaveText("+1h 00min");
  await page.locator("#history-date-from").fill("2026-09-16");
  await page.locator("#history-date-to").fill("2026-08-15");
  await page.locator("#history-range-form").getByRole("button",{ name:"Pesquisar" }).click();
  await expect(page.locator("#history-range-message")).toContainText("não pode ser posterior");
  await expect(page.locator("#records-body tr")).toHaveCount(3);
  await page.locator("#history-date-from").fill("2026-08-15");
  await page.locator("#history-date-to").fill("2026-09-16");
  await page.locator("#history-range-form").getByRole("button",{ name:"Pesquisar" }).click();
  await expect(page.locator("#history-range-message")).toContainText("15/08/2026 a 16/09/2026");
  await expect(page.locator("#records-body tr")).toHaveCount(5);
  await expect(page.locator("#records-body")).toContainText("15/08/2026");
  await expect(page.locator("#records-body")).toContainText("16/09/2026");
  await expect(page.locator("#registered-days")).toHaveText("5");
  await expect(page.locator("#balance-period-label")).toHaveText("Saldo do período");
  await expect(page.locator("#monthly-balance")).toHaveText("+1h 00min");
  await expect(page.locator("#simulator-current-balance")).toHaveText("+1h 00min");
  await page.locator("#manual-positive").fill("1");
  await expect(page.locator("#simulator-projected-balance")).toHaveText("+2h 00min");
  const csvDownload=page.waitForEvent("download");
  await page.locator("#export-csv").click();
  expect((await csvDownload).suggestedFilename()).toBe("horas-2026-08-15-a-2026-09-16.csv");
  const pdfDownload=page.waitForEvent("download");
  await page.locator("#export-pdf").click();
  expect((await pdfDownload).suggestedFilename()).toBe("relatorio-horas-2026-08-15-a-2026-09-16.pdf");
  await page.locator("#history-range-clear").click();
  await expect(page.locator("#records-body tr")).toHaveCount(3);
  await expect(page.locator("#records-body")).not.toContainText("16/09/2026");
  await expect(page.locator("#balance-period-label")).toHaveText("Saldo do ciclo");
  await expect(page.locator("#monthly-balance")).toHaveText("+1h 00min");
  await expect(page.locator("#simulator-current-balance")).toHaveText("+1h 00min");
  await expect(page.locator("#simulator-projected-balance")).toHaveText("+2h 00min");
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

test("mostra o botão de atualização sem recarregar quando uma nova versão é detectada", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("e2e-authenticated", "true");
    const workerContainer=new EventTarget();
    workerContainer.controller={};
    const registration=new EventTarget();
    registration.waiting=null;
    registration.update=async()=>{
      window.__updateChecks=(window.__updateChecks || 0)+1;
      if (!window.__fakeUpdateAvailable) return;
      const installing=new EventTarget();
      installing.state="installing";
      registration.installing=installing;
      registration.dispatchEvent(new Event("updatefound"));
      registration.waiting={ postMessage:(message)=>{ window.__updateMessage=message; } };
      installing.state="installed";
      installing.dispatchEvent(new Event("statechange"));
    };
    workerContainer.register=async()=>registration;
    Object.defineProperty(navigator,"serviceWorker",{ configurable:true, value:workerContainer });
  });
  await page.goto("/");
  await expect.poll(()=>page.evaluate(()=>window.__updateChecks || 0)).toBe(1);
  await expect(page.locator("#update-notice")).toBeHidden();
  await page.evaluate(()=>{ window.__fakeUpdateAvailable=true; window.dispatchEvent(new Event("focus")); });
  await expect(page.locator("#update-notice")).toBeVisible();
  await page.locator("#update-app").click();
  await expect.poll(()=>page.evaluate(()=>window.__updateMessage?.type)).toBe("SKIP_WAITING");
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
  await expect(page.locator("#month-filter")).toHaveValue("2026-09");
  await page.locator("#manual-negative").fill("2:30");
  await expect(page.locator("#simulator-projected-balance")).toContainText("-2h 30min");
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
    ["A5", "15/09/2026 Ter-Norm"], ["F5", "08:00"], ["G5", "12:00"], ["H5", "13:00"], ["I5", "17:48"],
    ["A6", "16/08/2026 Dom"]
  ];
  const rowXml = [1,2,3,4,5,6].map((row) => "<row r=\"" + row + "\">" +
    cells.filter(([address]) => address.endsWith(String(row))).map(([address,value]) =>
      "<c r=\"" + address + "\" t=\"inlineStr\"><is><t>" + value + "</t></is></c>").join("") + "</row>").join("");
  const xml = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rowXml + '</sheetData></worksheet>';
  const buffer = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(xml) }));
  await page.locator("#forponto-file").setInputFiles({ name:"forponto.xlsx", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await expect(page.locator("#forponto-dialog")).toBeVisible();
  await page.locator("#forponto-block").selectOption("0");
  await expect(page.locator("#forponto-summary")).toContainText("5 novo(s)");
  await expect(page.locator("#forponto-preview-body")).toContainText("2 marcações; saldo final -05:20");
  await page.locator("#forponto-confirm").click();
  await expect(page.locator("#history-date-from")).toHaveValue("2026-08-16");
  await expect(page.locator("#history-date-to")).toHaveValue("2026-09-15");
  await expect(page.locator("#month-filter")).toHaveValue("2026-09");
  await expect(page.locator("#registered-days")).toHaveText("5");
  await expect(page.locator("#history-range-message")).toContainText("aplicado automaticamente");
  await expect(page.locator("#records-body")).toContainText("17/08/2026");
  await expect(page.locator("#records-body")).toContainText("15/09/2026");
  await expect(page.locator("#records-body")).toContainText("45 min");
  await expect(page.locator("#records-body")).toContainText("18/08/2026");
  await expect(page.locator("#records-body")).toContainText("0 min");
  await expect(page.locator("#records-body")).toContainText("Compensação");
  await expect(page.locator("#records-body")).toContainText("-8h 00min");
  await page.locator("#forponto-file").setInputFiles({ name:"forponto.xlsx", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await page.locator("#forponto-block").selectOption("0");
  await expect(page.locator("#forponto-confirm")).toBeDisabled();
  await page.locator("#forponto-update-existing").check();
  await expect(page.locator("#forponto-summary")).toContainText("5 para atualizar");
  await page.locator("#forponto-confirm").click();
  await page.locator("#confirm-accept").click();
  await expect(page.locator("#records-body tr")).toHaveCount(5);
  const backupDownload=page.waitForEvent("download");
  await page.locator("#export-json").click();
  const backup=JSON.parse(await fs.promises.readFile(await (await backupDownload).path(), "utf8"));
  expect(backup.registros.find((record)=>record.data==="2026-08-18").dadosImportacao.officialBalanceMinutes).toBe(-320);
  expect(backup.registros.find((record)=>record.data==="2026-08-19")).toMatchObject({
    tipo:"compensacao", dadosImportacao:{ officialBalanceMinutes:-480 }
  });
});

test("importa PDF Forponto com as mesmas regras do XLSX", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  const pdf={ name:"forponto.pdf", mimeType:"application/pdf", buffer:forpontoPdfFixture() };
  await page.locator("#forponto-file").setInputFiles(pdf);
  await expect(page.locator("#forponto-dialog")).toBeVisible();
  await page.locator("#forponto-block").selectOption("0");
  await expect(page.locator("#forponto-summary")).toContainText("5 novo(s)");
  await expect(page.locator("#forponto-preview-body")).toContainText("2 marcações; saldo final -05:20");
  await page.locator("#forponto-confirm").click();
  await expect(page.locator("#history-date-from")).toHaveValue("2026-08-16");
  await expect(page.locator("#history-date-to")).toHaveValue("2026-09-15");
  await expect(page.locator("#records-body tr")).toHaveCount(5);
  await expect(page.locator("#records-body")).toContainText("45 min");
  await expect(page.locator("#records-body")).toContainText("-8h 00min");
  await page.locator("#forponto-file").setInputFiles(pdf);
  await page.locator("#forponto-block").selectOption("0");
  await expect(page.locator("#forponto-confirm")).toBeDisabled();
  await page.locator("#forponto-update-existing").check();
  await expect(page.locator("#forponto-summary")).toContainText("5 para atualizar");
});

test("falha de importação Forponto não grava nenhum dia", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await page.evaluate(()=>{ window.__failForpontoImport=true; });
  await page.locator("#forponto-file").setInputFiles({ name:"forponto.pdf", mimeType:"application/pdf", buffer:forpontoPdfFixture() });
  await page.locator("#forponto-block").selectOption("0");
  await page.locator("#forponto-confirm").click();
  await expect(page.locator("#records-body tr")).toHaveCount(0);
  await expect(page.locator("#forponto-dialog")).toBeVisible();
  await expect(page.locator("#toast-region")).toContainText("Nenhum dia foi importado");
});

test("lembra de baixar backup e oculta o aviso após o download", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#backup-reminder")).toBeHidden();
  await page.locator("#submit-button").click();
  await expect(page.locator("#records-body tr")).toHaveCount(1);
  await expect(page.locator("#backup-reminder")).toBeVisible();
  const download=page.waitForEvent("download");
  await page.locator("#backup-reminder-download").click();
  expect((await download).suggestedFilename()).toMatch(/^backup-horas-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator("#backup-reminder")).toBeHidden();
});

test("aplica automaticamente o período dos registros restaurados de um backup", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("e2e-authenticated", "true"));
  await page.goto("/");
  await expect(page.locator("#app-content")).toBeVisible();
  const backup={
    versao:1,
    configuracoes:{ metaDiariaMinutos:528, intervaloPadraoMinutos:60, tema:"light", saldosManuais:{} },
    registros:["2026-08-16","2026-09-15"].map((date,index)=>({
      id:`00000000-0000-4000-8000-00000000000${index+2}`,
      data:date, tipo:"folga", entrada:"", saida:"", intervaloMinutos:0, fotos:{ entrada:"", saida:"" }
    }))
  };
  await page.locator("#json-file").setInputFiles({ name:"backup.json", mimeType:"application/json", buffer:Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator("#confirm-accept").click();
  await expect(page.locator("#history-date-from")).toHaveValue("2026-08-16");
  await expect(page.locator("#history-date-to")).toHaveValue("2026-09-15");
  await expect(page.locator("#month-filter")).toHaveValue("2026-09");
  await expect(page.locator("#records-body tr")).toHaveCount(2);
  await expect(page.locator("#registered-days")).toHaveText("2");
  await expect(page.locator("#history-range-message")).toContainText("aplicado automaticamente");
});
