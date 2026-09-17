const test = require("node:test");
const assert = require("node:assert/strict");
const { monthForDate, rangeForMonth } = require("../assets/js/cycle.js");

test("fecha cada ciclo no dia 15 do mês selecionado", () => {
  assert.deepEqual(rangeForMonth("2026-09"), { from:"2026-08-16", to:"2026-09-15" });
  assert.equal(monthForDate("2026-08-15"), "2026-08");
  assert.equal(monthForDate("2026-08-16"), "2026-09");
  assert.equal(monthForDate("2026-09-15"), "2026-09");
  assert.equal(monthForDate("2026-09-16"), "2026-10");
});

test("trata a virada do ano sem perder os dias de dezembro", () => {
  assert.deepEqual(rangeForMonth("2027-01"), { from:"2026-12-16", to:"2027-01-15" });
  assert.equal(monthForDate("2026-12-16"), "2027-01");
  assert.equal(monthForDate("2027-01-15"), "2027-01");
  assert.equal(monthForDate("2027-01-16"), "2027-02");
});

test("recusa chaves de mês inválidas", () => {
  assert.equal(rangeForMonth("2026-13"), null);
  assert.equal(monthForDate("2026-09"), null);
});
