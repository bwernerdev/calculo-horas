const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const repository = fs.readFileSync("assets/js/repository.js", "utf8");
const sql = fs.readFileSync("supabase/migrations/20260915000000_initial_schema.sql", "utf8");
const monitoringSql = fs.readFileSync("supabase/migrations/20260915000100_client_error_monitoring.sql", "utf8");
const forpontoSql = fs.readFileSync("supabase/migrations/20260916000000_forponto_import.sql", "utf8");
const atomicImportSql = fs.readFileSync("supabase/migrations/20260916010000_atomic_forponto_import.sql", "utf8");

test("preserva dados e saldo oficial do Forponto na restauração", () => {
  assert.match(forpontoSql, /add column if not exists import_data jsonb/);
  assert.match(forpontoSql, /'compensacao'/);
  assert.match(forpontoSql, /records_import_data_check/);
  assert.match(forpontoSql, /coalesce\(parsed\.import_data, '\{\}'::jsonb\)/);
  assert.match(repository, /import_data:record\.importData/);
});

test("importação Forponto é transacional, respeita RLS e preserva fotos", () => {
  assert.match(atomicImportSql, /function public\.import_forponto_records/);
  assert.match(atomicImportSql, /security invoker/);
  assert.match(atomicImportSql, /on conflict \(user_id, date\) do update/);
  assert.match(atomicImportSql, /applied_count <> jsonb_array_length\(p_records\)/);
  assert.doesNotMatch(atomicImportSql, /photos = excluded\.photos/);
  assert.match(atomicImportSql, /grant execute .* to authenticated/);
  assert.match(repository, /client\.rpc\("import_forponto_records"/);
});

test("armazena fotos em bucket privado por usuario", () => {
  assert.match(repository, /storage\.from\("point-photos"\)/);
  assert.match(repository, /bucket\.download\(path\)/);
  assert.doesNotMatch(repository, /createSignedUrl/);
  assert.match(repository, /userId.*record\.id.*kind/);
  assert.match(sql, /'point-photos', 'point-photos', false/);
});

test("registra falhas sanitizadas sem liberar leitura pública", () => {
  assert.match(monitoringSql, /create table if not exists public\.client_errors/);
  assert.match(monitoringSql, /enable row level security/);
  assert.match(monitoringSql, /client_errors_insert_own/);
  assert.match(monitoringSql, /revoke all on table public\.client_errors from anon/);
  assert.doesNotMatch(monitoringSql, /for select/i);
});

test("RLS restringe tabelas e fotos ao usuario autenticado", () => {
  assert.match(sql, /alter table public\.records enable row level security/);
  assert.match(sql, /alter table public\.settings enable row level security/);
  assert.match(sql, /revoke all on table public\.records from anon/);
  assert.match(sql, /grant select, insert, update, delete on table public\.settings to authenticated/);
  assert.match(sql, /storage\.foldername\(name\)/);
  assert.match(sql, /auth\.uid\(\)/);
});

test("aplica integridade, índices, limites e restauração transacional", () => {
  assert.match(sql, /records_user_date_uidx/);
  assert.match(sql, /records_id_uidx/);
  assert.match(sql, /settings_user_uidx/);
  assert.match(sql, /foreign key \(user_id\) references auth\.users\(id\) on delete cascade/);
  assert.match(sql, /file_size_limit/);
  assert.match(sql, /allowed_mime_types/);
  assert.match(sql, /function public\.restore_user_backup/);
  assert.match(sql, /settings_balance_adjustments_check/);
  assert.match(sql, /p_balance_adjustments jsonb/);
  assert.match(sql, /from jsonb_each\(value\)/);
  assert.doesNotMatch(sql, /jsonb_object_length/);
  assert.match(repository, /client\.rpc\("restore_user_backup"/);
});
