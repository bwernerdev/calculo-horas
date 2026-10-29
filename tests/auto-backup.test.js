const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSupabaseRepository } = require("../assets/js/repository.js");

function fakeClient(snapshots) {
  const calls = [];
  const from = (table) => {
    const state = { table, filter: null, op: "select" };
    const builder = {
      select() { return builder; },
      order() { return builder; },
      eq(column, value) { state.filter = { column, value }; return builder; },
      in(column, values) { state.filter = { column, values }; return builder; },
      delete() { state.op = "delete"; return builder; },
      insert: async (value) => { calls.push({ op: "insert", table, value }); return { error: null }; },
      single: async () => ({ data: snapshots.find((s) => s.id === state.filter.value), error: null }),
      then(resolve) {
        if (state.op === "delete") { calls.push({ op: "delete", table, filter: state.filter }); return resolve({ error: null }); }
        resolve({ data: snapshots, error: null });
      },
    };
    return builder;
  };
  return { client: { from, storage: { from: () => ({}) } }, calls };
}

test("cria, lista e carrega cópias automáticas", async () => {
  const snapshots = [{ id: "a", created_at: "2026-10-02T00:00:00Z", record_count: 2, payload: { versao: 1 } }];
  const { client, calls } = fakeClient(snapshots);
  const repository = createSupabaseRepository(client, "user-1");
  await repository.createSnapshot({ versao: 1, registros: [] }, 2);
  assert.deepEqual(calls[0], { op: "insert", table: "backup_snapshots", value: { user_id: "user-1", record_count: 2, payload: { versao: 1, registros: [] } } });
  assert.equal((await repository.listSnapshots()).length, 1);
  assert.deepEqual(await repository.loadSnapshot("a"), { versao: 1 });
});

test("mantém apenas as cópias mais recentes", async () => {
  const snapshots = Array.from({ length: 9 }, (_, index) => ({ id: `s${index}` }));
  const { client, calls } = fakeClient(snapshots);
  await createSupabaseRepository(client, "user-1").pruneSnapshots(7);
  assert.deepEqual(calls.at(-1).filter, { column: "id", values: ["s7", "s8"] });
});

test("não apaga nada quando há menos cópias que o limite", async () => {
  const { client, calls } = fakeClient([{ id: "s0" }]);
  await createSupabaseRepository(client, "user-1").pruneSnapshots(7);
  assert.equal(calls.length, 0);
});

test("migração protege a tabela com RLS por usuário", () => {
  const sql = fs.readFileSync("supabase/migrations/20261029000000_auto_backup_snapshots.sql", "utf8");
  assert.match(sql, /enable row level security/);
  for (const operation of ["select", "insert", "delete"]) assert.match(sql, new RegExp(`for ${operation} to authenticated`));
  assert.match(sql, /revoke all on table public\.backup_snapshots from anon/);
  assert.doesNotMatch(sql, /for update/);
});
