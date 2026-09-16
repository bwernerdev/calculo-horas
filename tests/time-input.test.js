const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeClock, parseDuration, formatDuration } = require("../assets/js/time-input.js");

test("aceita horários inteiros e dígitos sem separador", () => {
  assert.equal(normalizeClock("1"), "01:00");
  assert.equal(normalizeClock("8"), "08:00");
  assert.equal(normalizeClock("830"), "08:30");
  assert.equal(normalizeClock("1730"), "17:30");
  assert.equal(normalizeClock("8:30"), "08:30");
  assert.equal(normalizeClock("24"), null);
  assert.equal(normalizeClock("1260"), null);
});

test("aceita horas inteiras e horas:minutos nos saldos", () => {
  assert.equal(parseDuration("1"), 60);
  assert.equal(parseDuration("1:30"), 90);
  assert.equal(parseDuration("00:45"), 45);
  assert.equal(formatDuration("1"), "1:00");
  assert.equal(parseDuration("1:99"), null);
  assert.equal(parseDuration("10000"), null);
});
