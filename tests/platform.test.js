const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("style.css", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const themeInit = fs.readFileSync("theme-init.js", "utf8");

test("mantém câmera interna sem seletor de arquivos ou galeria", () => {
  assert.match(script, /mediaDevices\.getUserMedia/);
  assert.doesNotMatch(html, /type="file"[^>]*accept="image/);
  assert.match(html, /id="camera-dialog"/);
});

test("aplica experiência mobile por toque também em modo paisagem", () => {
  assert.match(css, /@media \(max-width:1024px\) and \(pointer:coarse\)/);
  assert.match(css, /\.mobile-photo-field \{ display:block; \}/);
  assert.match(css, /#export-csv \{ display:none; \}/);
});

test("dimensiona a interface para viewport e áreas seguras mobile", () => {
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /max-height:600px/);
  assert.match(css, /\.auth-card input,\.password-dialog input \{ min-height:48px; font-size:16px; \}/);
});

test("mantém manifesto e arquivos essenciais no cache offline", () => {
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  for (const asset of ["index.html", "style.css", "theme-init.js", "calculations.js", "script.js", "manifest.webmanifest"]) assert.ok(worker.includes(asset));
});

test("simula saldo manual positivo e negativo por usuário e mês", () => {
  assert.match(html, /id="manual-positive"/);
  assert.match(html, /id="manual-negative"/);
  assert.match(html, /id="simulator-projected-balance"/);
  assert.match(html, /id="simulator-start-time"/);
  assert.match(html, /id="simulator-end-time"/);
  assert.match(html, /id="simulator-suggested-exit"/);
  assert.match(html, /id="simulator-informed-balance"/);
  assert.match(script, /positive-negative/);
  assert.match(script, /MANUAL_BALANCE_KEY.*loadedUserId.*month-filter/s);
  assert.match(script, /HoursCalculator\.suggestExit\(start,settings\.target,FIXED_BREAK_MINUTES,projected,SUGGESTED_DAILY_LIMIT_MINUTES\)/);
  assert.match(script, /informedBalance=projected\+informed\.balance/);
});

test("aplica a preferência de tema antes da interface e salva localmente", () => {
  assert.match(html, /<script src="theme-init\.js"><\/script>[\s\S]*<link rel="stylesheet"/);
  assert.match(themeInit, /localStorage\.getItem\("controle-horas-tema-v1"\)/);
  assert.match(script, /settings=\{ \.\.\.settings, theme \};\s*applyTheme\(\);/);
});

test("usa logo transparente e adaptável aos dois temas no cabeçalho", () => {
  assert.match(html, /class="brand-logo"[^>]+src="logo-controladoria-cds\.webp"/);
  assert.ok(fs.existsSync("logo-controladoria-cds.webp"));
  assert.ok(fs.readFileSync("logo-controladoria-cds.webp").includes(Buffer.from("ALPH")));
  assert.ok(worker.includes("./logo-controladoria-cds.webp"));
  assert.match(css, /topbar__brand-copy[^}]+text-align:center/);
  assert.match(css, /\[data-theme="dark"\] \.brand-logo[^}]+drop-shadow/);
});

test("oferece instalação específica para Android e iPhone", () => {
  assert.match(script, /beforeinstallprompt/);
  assert.match(script, /iphone\|ipad\|ipod/i);
  assert.match(script, /Adicionar à Tela de Início/);
});
