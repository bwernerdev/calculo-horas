const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const monitoring = fs.readFileSync("assets/js/monitoring.js", "utf8");
const script = fs.readFileSync("assets/js/script.js", "utf8");
const generator = fs.readFileSync("scripts/generate-runtime-config.mjs", "utf8");
const runtimeConfig = fs.readFileSync("assets/js/runtime-config.js", "utf8");

test("sanitiza e limita os relatórios de erro antes de armazenar", () => {
  assert.match(monitoring, /\[email\]/);
  assert.match(monitoring, /\[token\]/);
  assert.match(monitoring, /MAX_REPORTS = 20/);
  assert.match(monitoring, /MAX_TEXT_LENGTH = 1200/);
  assert.match(monitoring, /unhandledrejection/);
  assert.match(script, /from\("client_errors"\)\.upsert\(report/);
});

test("impede preview sem credenciais próprias", () => {
  assert.match(generator, /environment === "production" \|\| environment === "local"/);
  assert.match(generator, /Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY/);
  assert.match(generator, /CF_PAGES_BRANCH/);
  assert.match(runtimeConfig, /banco-horas-controladoria\.pages\.dev/);
  assert.match(runtimeConfig, /USE_PRODUCTION_DEFAULT \? .* : ""/);
  assert.match(script, /Supabase ausente para este ambiente/);
});
