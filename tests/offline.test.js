const test = require("node:test");
const assert = require("node:assert/strict");
const offline = require("../assets/js/offline.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

test("reconhece erros de rede e não confunde com erros de regra", () => {
  assert.equal(offline.isNetworkError(new TypeError("Failed to fetch")), true);
  assert.equal(offline.isNetworkError(new Error("TypeError: Failed to fetch")), true);
  assert.equal(offline.isNetworkError(new Error("NetworkError when attempting to fetch resource.")), true);
  assert.equal(offline.isNetworkError(new Error("Load failed")), true);
  assert.equal(offline.isNetworkError(new Error("Já existe um registro para esta data.")), false);
  assert.equal(offline.isNetworkError(new Error("new row violates row-level security policy")), false);
  assert.equal(offline.isNetworkError(null), false);
});

test("a fila guarda só a última operação por registro e mantém a ordem", () => {
  const queue = offline.createQueue(memoryStorage(), "fila");
  queue.add({ type: "save", record: { id: "a", date: "2026-10-01" } });
  queue.add({ type: "save", record: { id: "b", date: "2026-10-02" } });
  queue.add({ type: "save", record: { id: "a", date: "2026-10-03" } });
  assert.deepEqual(queue.list().map((item) => [item.type, item.key]), [["save", "b"], ["save", "a"]]);
  assert.equal(queue.list()[1].record.date, "2026-10-03");
  queue.add({ type: "delete", id: "a" });
  assert.deepEqual(queue.list().map((item) => [item.type, item.key]), [["save", "b"], ["delete", "a"]]);
  queue.remove("b");
  assert.equal(queue.size(), 1);
  queue.clear();
  assert.equal(queue.size(), 0);
});

test("a fila sobrevive a conteúdo corrompido no storage", () => {
  const storage = memoryStorage();
  storage.setItem("fila", "{não é json");
  const queue = offline.createQueue(storage, "fila");
  assert.deepEqual(queue.list(), []);
  storage.setItem("fila", JSON.stringify([{ type: "delete", id: "x" }, { type: "delete", id: "y", key: "y" }]));
  assert.equal(queue.size(), 1);
});

test("a cópia local não guarda fotos novas nem URLs de exibição", () => {
  const storage = memoryStorage();
  const records = [{
    id: "11111111-1111-4111-8111-111111111111", date: "2026-10-19", type: "trabalho", start: "08:00", end: "17:00", break: 60,
    photos: { entrada: "uid/rec/entrada-1.jpg", saida: "data:image/jpeg;base64,AAAA" }, photoPaths: { entrada: "uid/rec/entrada-1.jpg" },
  }];
  assert.equal(offline.saveSnapshot(storage, "cache", { records, settings: { target: 528 } }), true);
  const loaded = offline.loadSnapshot(storage, "cache");
  assert.equal(loaded?.records.length, 1);
  assert.deepEqual(loaded?.records[0].photos, { entrada: "uid/rec/entrada-1.jpg", saida: "" });
  assert.deepEqual(loaded?.records[0].photoPaths, { entrada: "uid/rec/entrada-1.jpg", saida: "" });
  assert.equal(loaded?.settings.target, 528);
});

test("rejeita cópia local inválida ou de outra versão", () => {
  const storage = memoryStorage();
  assert.equal(offline.loadSnapshot(storage, "cache"), null);
  storage.setItem("cache", JSON.stringify({ version: 2, records: [] }));
  assert.equal(offline.loadSnapshot(storage, "cache"), null);
  storage.setItem("cache", JSON.stringify({ version: 1, records: [{ id: "a", date: "ontem", type: "folga" }] }));
  assert.equal(offline.loadSnapshot(storage, "cache"), null);
});

test("falha de gravação (storage cheio) não derruba o app", () => {
  const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} };
  assert.equal(offline.saveSnapshot(full, "cache", { records: [], settings: {} }), false);
});
