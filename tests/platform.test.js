const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("style.css", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

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

test("mantém manifesto e arquivos essenciais no cache offline", () => {
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  for (const asset of ["index.html", "style.css", "calculations.js", "script.js", "manifest.webmanifest"]) assert.ok(worker.includes(asset));
});

test("oferece instalação específica para Android e iPhone", () => {
  assert.match(script, /beforeinstallprompt/);
  assert.match(script, /iphone\|ipad\|ipod/i);
  assert.match(script, /Adicionar à Tela de Início/);
});
