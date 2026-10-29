const test = require("node:test");
const assert = require("node:assert/strict");
const insights = require("../assets/js/insights.js");
const cycle = require("../assets/js/cycle.js");
const calculator = require("../assets/js/calculations.js");

const range = { from: "2026-10-16", to: "2026-11-15" };

test("soma dias e identifica dias da semana sem depender do fuso horário", () => {
  assert.equal(insights.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(insights.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(insights.weekdayOf("2026-10-16"), 5); // sexta
  assert.equal(insights.isWorkday("2026-10-17"), false);
  assert.equal(insights.isWorkday("2026-10-19"), true);
});

test("lista os 31 dias do ciclo de 16 a 15", () => {
  const dates = insights.datesBetween(range.from, range.to);
  assert.equal(dates.length, 31);
  assert.equal(dates[0], "2026-10-16");
  assert.equal(dates.at(-1), "2026-11-15");
});

test("formata saldos curtos", () => {
  assert.equal(insights.shortBalance(70), "+1:10");
  assert.equal(insights.shortBalance(-48), "−0:48");
  assert.equal(insights.shortBalance(0), "0:00");
});

test("encontra o ciclo anterior", () => {
  assert.deepEqual(insights.previousRange(range, cycle), { from: "2026-09-16", to: "2026-10-15" });
  assert.equal(insights.previousRange(null, cycle), null);
});

test("pendências são dias úteis passados sem registro, sem contar hoje", () => {
  const recorded = new Set(["2026-10-19", "2026-10-20"]);
  const pending = insights.pendingWorkdays(range, recorded, "2026-10-23");
  assert.deepEqual(pending, ["2026-10-16", "2026-10-21", "2026-10-22"]);
});

test("dias restantes começam hoje e param no fim do ciclo", () => {
  const remaining = insights.remainingWorkdays(range, new Set(["2026-10-29"]), "2026-10-29");
  assert.equal(remaining[0], "2026-10-30");
  assert.equal(remaining.at(-1), "2026-11-13");
  assert.equal(remaining.length, 11);
  assert.deepEqual(insights.remainingWorkdays(range, new Set(), "2026-11-20"), []);
});

test("previsão para zerar o saldo", () => {
  const debt = insights.forecastToZero({ balance: -600, remainingDays: 10, targetMinutes: 528 });
  assert.deepEqual(debt, { remainingDays: 10, deltaPerDay: 60, workedPerDay: 588, exceedsLimit: false });
  const surplus = insights.forecastToZero({ balance: 120, remainingDays: 4, targetMinutes: 528 });
  assert.equal(surplus?.deltaPerDay, -30);
  assert.equal(surplus?.workedPerDay, 498);
  const impossible = insights.forecastToZero({ balance: -3000, remainingDays: 3, targetMinutes: 528 });
  assert.equal(impossible?.exceedsLimit, true);
  assert.equal(insights.forecastToZero({ balance: -60, remainingDays: 0, targetMinutes: 528 }), null);
});

test("saldo por ciclo em ordem cronológica e limitado à quantidade pedida", () => {
  const records = [
    { date: "2026-08-20", type: "falta", start: "", end: "", break: 0 },
    { date: "2026-09-18", type: "trabalho", start: "08:00", end: "17:48", break: 60 },
    { date: "2026-10-19", type: "trabalho", start: "08:00", end: "18:48", break: 60 },
  ];
  const balanceOf = (list) => calculator.summarize(list, 528).balance;
  const all = insights.cycleBalances(records, balanceOf, cycle, 12);
  assert.deepEqual(all.map((item) => item.month), ["2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(all.map((item) => item.balance), [-528, 0, 60]);
  assert.equal(insights.cycleBalances(records, balanceOf, cycle, 2).length, 2);
});

test("modelo do calendário marca hoje, pendências e registros", () => {
  const byDate = new Map([["2026-10-19", { id: "a" }]]);
  const model = insights.calendarModel(range, byDate, "2026-10-21");
  assert.equal(model.leadingBlanks, 5);
  assert.equal(model.days.length, 31);
  assert.equal(model.days.find((day) => day.date === "2026-10-19")?.record?.id, "a");
  assert.equal(model.days.find((day) => day.date === "2026-10-21")?.isToday, true);
  assert.equal(model.days.find((day) => day.date === "2026-10-20")?.pending, true);
  assert.equal(model.days.find((day) => day.date === "2026-10-19")?.pending, false);
  assert.equal(model.days.find((day) => day.date === "2026-10-17")?.pending, false);
});
