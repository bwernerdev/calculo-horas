const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const repository = fs.readFileSync("repository.js", "utf8");
const sql = fs.readFileSync("supabase/security-and-storage.sql", "utf8");

test("armazena fotos em bucket privado por usuario", () => {
  assert.match(repository, /storage\.from\("point-photos"\)/);
  assert.match(repository, /createSignedUrl/);
  assert.match(repository, /userId.*record\.id.*kind/);
  assert.match(sql, /'point-photos', 'point-photos', false/);
});

test("RLS restringe tabelas e fotos ao usuario autenticado", () => {
  assert.match(sql, /alter table public\.records enable row level security/);
  assert.match(sql, /alter table public\.settings enable row level security/);
  assert.match(sql, /storage\.foldername\(name\)/);
  assert.match(sql, /auth\.uid\(\)/);
});
