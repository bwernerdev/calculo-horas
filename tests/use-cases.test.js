const test = require("node:test");
const assert = require("node:assert/strict");
const calculator = require("../assets/js/calculations.js");
const { createHoursUseCases } = require("../assets/js/use-cases.js");

function createRepository() {
  const saved = [];
  return {
    saved,
    findAllRecords: async () => [],
    saveRecord: async (record) => { saved.push(record); return record; },
    deleteRecord: async () => {},
    deleteAllRecords: async () => ({ photoCleanupFailed:0 }),
    getSettings: async () => ({}),
    saveSettings: async () => {}
  };
}

test("apaga todos os registros sem tocar nas configurações", async () => {
  const repository=createRepository();
  let settingsSaved=false;
  repository.saveSettings=async()=>{ settingsSaved=true; };
  const useCases=createHoursUseCases({ calculator,repository });
  assert.deepEqual(await useCases.deleteAllRecords(),{ records:[],photoCleanupFailed:0 });
  assert.equal(settingsSaved,false);
});

test("caso de uso salva uma única jornada sem regravar a coleção", async () => {
  const repository = createRepository();
  const useCases = createHoursUseCases({ calculator, repository });
  const record = { id:"1", date:"2026-08-17", type:"trabalho", start:"08:00", end:"17:48", break:60 };
  const result = await useCases.saveRecord(record, 528, []);
  assert.deepEqual(repository.saved, [record]);
  assert.deepEqual(result.records, [record]);
});

test("caso de uso impede data duplicada antes de acessar o banco", async () => {
  const repository = createRepository();
  const useCases = createHoursUseCases({ calculator, repository });
  const existing = { id:"1", date:"2026-08-17", type:"folga" };
  await assert.rejects(
    useCases.saveRecord({ id:"2", date:"2026-08-17", type:"folga" }, 528, [existing]),
    /Já existe um registro/
  );
  assert.equal(repository.saved.length, 0);
});

test("caso de uso rejeita meta diária fora do limite", async () => {
  const repository = createRepository();
  const useCases = createHoursUseCases({ calculator, repository });
  await assert.rejects(useCases.saveSettings({ target:601, theme:"light" }), /entre 1 minuto e 10 horas/);
});

test("caso de uso valida e recupera saldos manuais mensais", async () => {
  const repository = createRepository();
  repository.getSettings = async () => ({ target:528, theme:"dark", manualBalances:{ "2026-08":{ positive:120, negative:45 } } });
  const useCases = createHoursUseCases({ calculator, repository });
  const settings = await useCases.getSettings();
  assert.deepEqual(settings.manualBalances,{ "2026-08":{ positive:120, negative:45 } });
  await assert.rejects(useCases.saveSettings({ ...settings, manualBalances:{ agosto:{ positive:10, negative:0 } } }),/saldos manuais/);
});
