const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/js/theme-init.js", "utf8");

test("usa armazenamento persistente quando disponível", () => {
  const values = new Map([["controle-horas-tema-v1", "dark"]]);
  const window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } };
  const document = { documentElement: { dataset: {} } };
  vm.runInNewContext(source, { window, document, Map });
  assert.equal(window.AppStorage.persistent, true);
  assert.equal(document.documentElement.dataset.theme, "dark");
  window.AppStorage.setItem("test", "value");
  assert.equal(values.get("test"), "value");
});

test("usa memória quando o navegador bloqueia localStorage", () => {
  const window = {};
  Object.defineProperty(window, "localStorage", { get() { throw new Error("SecurityError"); } });
  const document = { documentElement: { dataset: {} } };
  vm.runInNewContext(source, { window, document, Map });
  const storage = window.AppStorage;
  assert.equal(storage.persistent, false);
  storage.setItem("test", "value");
  assert.equal(storage.getItem("test"), "value");
  storage.removeItem("test");
  assert.equal(storage.getItem("test"), null);
  assert.equal(document.documentElement.dataset.theme, "light");
});

test("troca para memória e avisa se a gravação falha depois", () => {
  let blocked = false;
  const window = { localStorage: {
    getItem: () => null,
    setItem: () => { if (blocked) throw new Error("QuotaExceededError"); },
    removeItem: () => {},
  } };
  const document = { documentElement: { dataset: {} } };
  vm.runInNewContext(source, { window, document, Map });
  let notified = false;
  window.AppStorage.onFailure = () => { notified = true; };
  blocked = true;
  window.AppStorage.setItem("test", "value");
  assert.equal(window.AppStorage.persistent, false);
  assert.equal(window.AppStorage.getItem("test"), "value");
  assert.equal(notified, true);
});
