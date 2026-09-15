const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const documentationFiles = [
  "README.md",
  "docs/CONFIGURACAO-SUPABASE.md",
  "docs/DEPLOY-CLOUDFLARE.md",
];

test("mantém válidos os links locais da documentação", () => {
  for (const file of documentationFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(content, /\uFFFD/, `${file} possui caracteres inválidos`);

    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const destination = match[1];
      if (/^(https?:|#)/.test(destination)) continue;

      const localPath = destination.split("#")[0];
      const resolvedPath = path.resolve(path.dirname(file), localPath);
      assert.ok(fs.existsSync(resolvedPath), `${file} aponta para ${destination}, que não existe`);
    }
  }
});

test("documenta o deploy automático como fluxo principal", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const deployment = fs.readFileSync("docs/DEPLOY-CLOUDFLARE.md", "utf8");

  assert.match(readme, /push.*main.*Cloudflare Pages/i);
  assert.match(deployment, /integração Git/i);
  assert.match(deployment, /Cloudflare Pages/);
  assert.match(deployment, /banco-horas-deploy\.zip.*contingência/is);
});
