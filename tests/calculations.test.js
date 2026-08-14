const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, summarize, suggestExit, toClock } = require("../calculations.js");

const TARGET = 8 * 60 + 48;

test("calcula uma jornada que termina no dia seguinte", () => {
  const result = calculate({ type: "trabalho", start: "22:00", end: "07:00", break: 60 }, TARGET);
  assert.deepEqual(result, { worked: 480, balance: -48 });
});

test("desconta o intervalo da jornada", () => {
  const result = calculate({ type: "trabalho", start: "08:00", end: "17:48", break: 60 }, TARGET);
  assert.deepEqual(result, { worked: 528, balance: 0 });
});

test("contabiliza uma falta como saldo negativo integral", () => {
  assert.deepEqual(calculate({ type: "falta" }, TARGET), { worked: 0, balance: -528 });
});

test("não desconta saldo em folgas, férias e feriados", () => {
  for (const type of ["folga", "ferias", "feriado"]) {
    assert.deepEqual(calculate({ type }, TARGET), { worked: 0, balance: 0 });
  }
});

test("soma separadamente horas positivas, negativas e saldo líquido", () => {
  const records = [
    { type: "trabalho", start: "08:00", end: "18:48", break: 60 },
    { type: "trabalho", start: "08:00", end: "16:48", break: 60 },
    { type: "falta" }
  ];
  assert.deepEqual(summarize(records, TARGET), { worked: 1056, balance: -528, positive: 60, negative: -588 });
});

test("calcula a saída prevista com virada de dia", () => {
  assert.equal(toClock(22 * 60 + TARGET + 60), "07:48");
});

test("antecipa a saída quando há saldo positivo", () => {
  assert.deepEqual(suggestExit("08:00",TARGET,60,60), { baseExit:"17:48", suggestedExit:"16:48", worked:468, remainingBalance:0, limited:false });
});

test("posterga a saída quando há saldo negativo", () => {
  assert.deepEqual(suggestExit("08:00",TARGET,60,-60), { baseExit:"17:48", suggestedExit:"18:48", worked:588, remainingBalance:0, limited:false });
});

test("limita a compensação negativa a dez horas trabalhadas", () => {
  assert.deepEqual(suggestExit("08:00",TARGET,60,-180), { baseExit:"17:48", suggestedExit:"19:00", worked:600, remainingBalance:-108, limited:true });
});
