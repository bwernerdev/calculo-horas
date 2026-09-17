const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const headers = fs.readFileSync("_headers", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

test("define cabecalhos de seguranca compativeis com Supabase", () => {
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /Permissions-Policy:/);
  assert.match(headers, /https:\/\/\*\.supabase\.co/);
  assert.match(headers, /wss:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(headers, /challenges\.cloudflare\.com/);
  assert.match(headers, /frame-ancestors 'none'/);
});

test("forca renovacao do cache para a publicacao corrigida", () => {
  assert.match(worker, /banco-horas-v55/);
  assert.match(worker, /assets\/js\/vendor\/supabase\.min\.js/);
  assert.match(headers, /script-src 'self';/);
  assert.doesNotMatch(headers, /unpkg\.com/);
  assert.match(worker, /assets\/js\/vendor\/pdf\.min\.mjs/);
  assert.match(worker, /assets\/js\/vendor\/pdf\.worker\.min\.mjs/);
  assert.ok(fs.existsSync("assets/js/vendor/pdf.min.mjs"));
  assert.ok(fs.existsSync("assets/js/vendor/pdf.worker.min.mjs"));
  assert.ok(fs.existsSync("assets/js/vendor/pdfjs-LICENSE.txt"));
  assert.ok(fs.existsSync("assets/js/vendor/supabase.min.js"));
  assert.ok(fs.existsSync("assets/js/vendor/supabase-LICENSE"));
});
