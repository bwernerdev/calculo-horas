const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const production = JSON.parse(fs.readFileSync("config/production.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const runtime = fs.readFileSync("assets/js/runtime-config.js", "utf8");

test("runtime-config estático espelha a configuração de produção", () => {
  assert.ok(runtime.includes(production.supabaseUrl));
  assert.ok(runtime.includes(production.supabasePublishableKey));
});

test("versão do runtime-config acompanha o package.json", () => {
  assert.match(runtime, new RegExp(`version: "${pkg.version.replaceAll(".", "[.]")}"`));
});

test("URL e chave de produção não ficam duplicadas nos scripts", () => {
  for (const file of ["scripts/healthcheck.mjs", "scripts/generate-runtime-config.mjs"]) {
    const content = fs.readFileSync(file, "utf8");
    assert.ok(!content.includes(production.supabaseUrl), `${file} duplica a URL`);
    assert.ok(!content.includes(production.supabasePublishableKey), `${file} duplica a chave`);
  }
});
