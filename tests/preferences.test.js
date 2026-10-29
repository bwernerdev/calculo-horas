const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const calculator = require("../assets/js/calculations.js");
const insights = require("../assets/js/insights.js");
const { createHoursUseCases } = require("../assets/js/use-cases.js");
const { createSupabaseRepository } = require("../assets/js/repository.js");

test("a meta pode variar por dia da semana", () => {
  const targets = { 1: 480, 5: 360 }; // segunda 8h, sexta 6h
  const targetFor = (record) => targets[insights.weekdayOf(record.date)] ?? 528;
  const monday = { date: "2026-10-19", type: "trabalho", start: "08:00", end: "17:00", break: 60 };
  const friday = { date: "2026-10-23", type: "trabalho", start: "08:00", end: "14:00", break: 0 };
  const tuesday = { date: "2026-10-20", type: "falta", start: "", end: "", break: 0 };
  assert.equal(calculator.calculate(monday, targetFor).balance, 0);
  assert.equal(calculator.calculate(friday, targetFor).balance, 0);
  assert.equal(calculator.calculate(tuesday, targetFor).balance, -528);
  assert.equal(calculator.summarize([monday, friday, tuesday], targetFor).balance, -528);
  assert.equal(calculator.summarize([monday], 528).balance, -48);
});

test("lê intervalo padrão e metas por dia; valores inválidos voltam ao padrão", async () => {
  const useCases = createHoursUseCases({
    calculator,
    repository: { getSettings: async () => ({ target: 528, preferences: { break: 45, weekdayTargets: { 1: 480, 9: 100, 2: 9999, 3: "x" } } }) },
  });
  const settings = await useCases.getSettings();
  assert.equal(settings.break, 45);
  assert.deepEqual(settings.weekdayTargets, { 1: 480 });
  const fallback = await createHoursUseCases({ calculator, repository: { getSettings: async () => ({ preferences: { break: -5 } }) } }).getSettings();
  assert.equal(fallback.break, 60);
  assert.deepEqual(fallback.weekdayTargets, {});
});

test("valida e repassa intervalo e metas ao salvar", async () => {
  const saved = [];
  const useCases = createHoursUseCases({ calculator, repository: { saveSettings: async (value) => saved.push(value) } });
  const base = { target: 528, theme: "light", manualBalances: {} };
  const result = await useCases.saveSettings({ ...base, break: 30, weekdayTargets: { 5: 480 } });
  assert.equal(result.break, 30);
  assert.deepEqual(saved[0].weekdayTargets, { 5: 480 });
  await assert.rejects(useCases.saveSettings({ ...base, break: 700 }), /intervalo padrão/);
  await assert.rejects(useCases.saveSettings({ ...base, weekdayTargets: { 7: 480 } }), /cada dia da semana/);
  await assert.rejects(useCases.saveSettings({ ...base, weekdayTargets: { 1: 0 } }), /cada dia da semana/);
  assert.equal((await useCases.saveSettings(base)).break, 60);
});

function fakeSettingsClient({ missingPreferences }) {
  const upserts = [];
  const client = {
    storage: { from: () => ({}) },
    from: () => ({
      select: (columns) => ({
        maybeSingle: async () => (missingPreferences && columns.includes("preferences")
          ? { data: null, error: { code: "42703", message: "column settings.preferences does not exist" } }
          : { data: { target_minutes: 528, theme: "light", balance_adjustments: {} }, error: null }),
      }),
      upsert: async (row) => {
        upserts.push(row);
        return missingPreferences && "preferences" in row ? { error: { code: "42703", message: "column preferences does not exist" } } : { error: null };
      },
    }),
  };
  return { client, upserts };
}

test("sem a coluna de preferências, salvar com valores padrão funciona e com valores personalizados orienta a migração", async () => {
  const { client, upserts } = fakeSettingsClient({ missingPreferences: true });
  const repository = createSupabaseRepository(client, "u1");
  await repository.saveSettings({ target: 528, theme: "light", manualBalances: {}, break: 60, weekdayTargets: {} });
  assert.equal(upserts.length, 2);
  assert.ok(!("preferences" in upserts[1]));
  await assert.rejects(repository.saveSettings({ target: 528, theme: "light", manualBalances: {}, break: 45, weekdayTargets: {} }), /migração de preferências/);
  await assert.rejects(repository.saveSettings({ target: 528, theme: "light", manualBalances: {}, break: 60, weekdayTargets: { 1: 480 } }), /migração de preferências/);
  assert.deepEqual(await repository.getSettings(), { target: 528, theme: "light", manualBalances: {}, preferences: {} });
});

test("com a coluna, grava e lê as preferências", async () => {
  const { client, upserts } = fakeSettingsClient({ missingPreferences: false });
  const repository = createSupabaseRepository(client, "u1");
  await repository.saveSettings({ target: 528, theme: "dark", manualBalances: {}, break: 45, weekdayTargets: { 5: 480 } });
  assert.deepEqual(upserts[0].preferences, { break: 45, weekdayTargets: { 5: 480 } });
});

test("migração de preferências valida o formato e não abre permissões novas", () => {
  const sql = fs.readFileSync("supabase/migrations/20261029000100_user_preferences.sql", "utf8");
  assert.match(sql, /add column if not exists preferences jsonb not null default/);
  assert.match(sql, /settings_preferences_check/);
  assert.match(sql, /'break', 'weekdayTargets'/);
  assert.doesNotMatch(sql, /\bgrant\b/i);
  assert.doesNotMatch(sql, /\bdrop table\b/i);
});
