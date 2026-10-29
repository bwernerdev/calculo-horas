const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

// Comparação de capturas de tela (opt-in): `npm run test:visual:update` cria as referências neste computador
// e `npm run test:visual` compara. Ficam fora do CI porque a renderização muda entre sistemas operacionais.
test.skip(!process.env.VISUAL, "Defina VISUAL=1 (use npm run test:visual) para rodar a comparação visual.");
test.use({ serviceWorkers: "block", locale: "pt-BR", timezoneId: "America/Sao_Paulo", reducedMotion: "reduce" });

const supabaseMock = fs.readFileSync("e2e/supabase-mock.js", "utf8");
const row = (n, date, type, start, end) => ({ id: `00000000-0000-4000-8000-0000000000${n}`, date, type, start_time: start, end_time: end, break_minutes: type === "trabalho" ? 60 : 0, photos: {}, import_data: {} });
const records = [
  row(10, "2026-10-16", "trabalho", "08:00", "17:48"), row(11, "2026-10-19", "trabalho", "07:41", "16:19"), row(12, "2026-10-20", "folga", "", ""),
  row(13, "2026-10-21", "falta", "", ""), row(14, "2026-10-22", "trabalho", "09:00", "19:30"), row(15, "2026-10-23", "ferias", "", ""),
  row(16, "2026-10-26", "feriado", "", ""), row(17, "2026-09-18", "trabalho", "08:00", "17:48"),
];
let server;

test.beforeAll(async () => {
  const { startStaticServer } = await import("../scripts/serve-static.mjs");
  server = await startStaticServer(4177);
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const viewports = [["desktop", { width: 1280, height: 900 }], ["celular", { width: 390, height: 844 }]];

for (const [name, viewport] of viewports) {
  for (const theme of ["light", "dark"]) {
    for (const authenticated of [false, true]) {
      test(`${authenticated ? "painel" : "entrada"} ${name} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.clock.setFixedTime(new Date("2026-10-29T12:00:00-03:00"));
        await page.route("**/assets/js/vendor/supabase.min.js", (route) => route.fulfill({ contentType: "text/javascript", body: supabaseMock }));
        await page.addInitScript(([themeValue, logged, data]) => {
          localStorage.setItem("controle-horas-tema-v1", themeValue);
          if (logged) localStorage.setItem("e2e-authenticated", "true");
          window.__mockRecords = data;
        }, [theme, authenticated, records]);
        await page.goto("http://127.0.0.1:4177/");
        await expect(authenticated ? page.locator("#app-content") : page.locator("#auth-screen")).toBeVisible();
        await expect(page).toHaveScreenshot(`${authenticated ? "painel" : "entrada"}-${name}-${theme}.png`, { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.01 });
      });
    }
  }
}
