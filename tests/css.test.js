const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { readCss } = require("./helpers/css");

const css = readCss();
const body = css.slice(css.indexOf("}", css.indexOf("[data-theme=\"dark\"]")) + 1); // após os tokens

test("cores da marca e de perigo vêm de tokens fora do :root", () => {
  for (const color of ["#3157d5", "#2444ad", "#b42318"]) assert.ok(!body.includes(color), `${color} deveria ser token`);
});

test("sem remendos de tema por :root:not e com !important apenas em utilitários", () => {
  assert.doesNotMatch(css, /:root:not\(/);
  const important = [...css.matchAll(/([^{}]+)\{[^{}]*!important/g)].map((match) => match[1]);
  for (const selector of important) assert.match(selector, /^(\.value-positive|\.value-negative|\[hidden\]|\.visually-hidden|\.topbar,\.entry-panel,\.toolbar,\.history-range,\.history-table th:last-child,\.history-table td:last-child)$/);
});

test("hover só vale em dispositivos com ponteiro que passa o mouse", () => {
  const hoverBlocks = [...css.matchAll(/@media \(hover:hover\)\{[^@]*?\}\}/g)].map((match) => match[0]).join("");
  for (const selector of [".button:hover", ".photo-card:hover"]) {
    assert.ok(hoverBlocks.includes(selector), selector + " deveria estar em @media (hover:hover)");
  }
});

test("diálogos limitam a altura e não repassam a rolagem para a página", () => {
  for (const dialog of [".confirm-dialog{", ".photo-dialog{", ".camera-dialog{"]) {
    const start = css.indexOf(dialog);
    assert.ok(start >= 0, dialog);
    const rule = css.slice(start, css.indexOf("}", start));
    assert.ok(rule.includes("max-height:calc(var(--app-height) - 24px)"), dialog + " sem max-height");
    assert.ok(rule.includes("overscroll-behavior:contain"), dialog + " sem overscroll-behavior");
  }
  assert.ok(css.includes("body:has(dialog[open]){overflow:hidden}"));
});

test("foco visível padronizado e nenhum outline removido", () => {
  assert.match(css, /:where\(a,button,input,select,textarea,summary,\[tabindex\]\):focus-visible\{outline:3px solid var\(--primary\)/);
  assert.doesNotMatch(css, /outline:none/);
});

test("fontes não ficam abaixo de 0,7rem e a Inter é carregada localmente", () => {
  for (const [, size] of css.matchAll(/font-size:(0?\.\d+)rem/g)) assert.ok(Number(size) >= 0.7, `fonte ${size}rem pequena demais`);
  assert.ok(css.includes('@font-face{font-family:"Inter"'));
  assert.ok(fs.existsSync("assets/fonts/inter-latin-wght-normal.woff2"));
  assert.ok(fs.existsSync("assets/fonts/Inter-LICENSE.txt"));
});

test("alvos de toque de 44px em telas por toque", () => {
  assert.match(css, /@media \(pointer:coarse\)\{[^@]*\.table-action[^}]*min-height:44px/);
});

test("impressão restringe a coluna de ações ao histórico e evita quebras dentro de linhas", () => {
  assert.match(css, /@media print\{[^@]*\.history-table td:last-child/);
  assert.doesNotMatch(css, /@media print\{[^@]*[,{]td:last-child/);
  assert.match(css, /break-inside:avoid/);
});

test("desfoque do fundo dos diálogos só em ponteiro preciso", () => {
  assert.match(css, /@media \(hover:hover\) and \(pointer:fine\)\{[^@]*backdrop-filter:blur/);
  assert.equal([...css.matchAll(/backdrop-filter/g)].length, 1);
});

test("raios de borda usam a escala de tokens", () => {
  assert.doesNotMatch(body, /border-radius:\d+px(?!;)/);
  for (const [, value] of body.matchAll(/border-radius:(\d+)px/g)) assert.equal(value, "4", "apenas o checkbox (4px) fica fora da escala");
});
