const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const headers = fs.readFileSync("_headers", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

test("define cabecalhos de seguranca compativeis com Supabase e Turnstile", () => {
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /Permissions-Policy:/);
  assert.match(headers, /https:\/\/kainqngxsiawowbaslhi\.supabase\.co/);
  assert.match(headers, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(headers, /frame-ancestors 'none'/);
});

test("forca renovacao do cache para a publicacao corrigida", () => {
  assert.match(worker, /banco-horas-v26/);
});
