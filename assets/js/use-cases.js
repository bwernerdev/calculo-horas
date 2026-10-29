// @ts-check
/** UMD: expõe o módulo como global no navegador e via module.exports no Node. */
(function exposeUseCases(/** @type {any} */ root, factory) {
  const useCases = factory();
  if (typeof module === "object" && module.exports) module.exports = useCases;
  if (root) root.HoursUseCases = useCases;
})(typeof globalThis !== "undefined" ? globalThis : this, function createUseCases() {
  function createHoursUseCases({ calculator, repository, fixedBreakMinutes = 60, maxDailyWorkMinutes = 600, defaultTheme = "light" }) {
    function normalizePreferences(value) {
      const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const breakMinutes = Number.isInteger(source.break) && source.break >= 0 && source.break <= 600 ? source.break : fixedBreakMinutes;
      const weekdayTargets = {};
      const rawTargets = source.weekdayTargets && typeof source.weekdayTargets === "object" ? source.weekdayTargets : {};
      for (const [day, minutes] of Object.entries(rawTargets)) {
        if (/^[0-6]$/.test(day) && Number.isInteger(minutes) && minutes >= 1 && minutes <= maxDailyWorkMinutes) weekdayTargets[day] = minutes;
      }
      return { break: breakMinutes, weekdayTargets };
    }

    async function getSettings() {
      const saved = await repository.getSettings();
      const preferences = normalizePreferences(saved.preferences);
      const manualBalances = saved.manualBalances && typeof saved.manualBalances === "object" && !Array.isArray(saved.manualBalances) ? saved.manualBalances : {};
      return {
        target: Number.isInteger(saved.target) && saved.target > 0 ? saved.target : 528,
        break: preferences.break,
        weekdayTargets: preferences.weekdayTargets,
        theme: saved.theme === "dark" || saved.theme === "light" ? saved.theme : defaultTheme,
        manualBalances
      };
    }

    function validateRecord(record, targetMinutes) {
      if (record.type === "trabalho") {
        if (!Number.isInteger(record.break) || record.break < 0 || record.break > 600) throw new Error("O intervalo deve estar entre 0 e 600 minutos.");
        if (!record.start || !record.end) throw new Error("Informe os horários de entrada e saída.");
        const worked = calculator.calculate(record, targetMinutes).worked;
        if (worked < 0) throw new Error("O intervalo não pode superar a jornada.");
        if (worked > maxDailyWorkMinutes) throw new Error("A jornada não pode ultrapassar 10 horas trabalhadas no dia.");
      }
    }

    async function saveRecord(record, targetMinutes, currentRecords) {
      validateRecord(record,targetMinutes);
      const records = Array.isArray(currentRecords) ? currentRecords : await repository.findAllRecords();
      if (records.some((item) => item.date === record.date && item.id !== record.id)) {
        throw new Error("Já existe um registro para esta data. Edite o registro existente.");
      }
      const savedRecord = await repository.saveRecord(record);
      const index = records.findIndex((item) => item.id === record.id);
      const updatedRecords = [...records];
      if (index >= 0) updatedRecords[index] = savedRecord;
      else updatedRecords.push(savedRecord);
      return { records: updatedRecords, editing: index >= 0 };
    }

    async function importForpontoRecords(importedRecords, targetMinutes, currentRecords, updateExisting) {
      if (!Array.isArray(importedRecords) || importedRecords.length===0 || importedRecords.length>5000) throw new Error("Lista de registros Forponto inválida.");
      const dates=new Set();
      const records=Array.isArray(currentRecords) ? currentRecords : await repository.findAllRecords();
      for (const record of importedRecords) {
        if (record.importData?.source!=="forponto" || dates.has(record.date)) throw new Error("O relatório contém datas duplicadas ou inválidas.");
        dates.add(record.date);
        validateRecord(record,targetMinutes);
        if (!updateExisting && records.some((item)=>item.date===record.date)) throw new Error("Uma data já foi registrada. Confira a prévia antes de importar.");
      }
      const saved=await repository.importForpontoRecords(importedRecords,updateExisting);
      const updated=[...records];
      for (const item of saved) {
        const index=updated.findIndex((record)=>record.date===item.date);
        if (index>=0) updated[index]=item;
        else updated.push(item);
      }
      return updated;
    }

    async function deleteRecord(id, currentRecords) {
      await repository.deleteRecord(id);
      const records = Array.isArray(currentRecords) ? currentRecords : await repository.findAllRecords();
      return records.filter((item) => item.id !== id);
    }

    async function deleteAllRecords() {
      const result=await repository.deleteAllRecords();
      return { records:[], photoCleanupFailed:result.photoCleanupFailed || 0 };
    }

    async function saveSettings(settings) {
      if (!Number.isInteger(settings.target) || settings.target < 1 || settings.target > maxDailyWorkMinutes) {
        throw new Error("A meta diária deve estar entre 1 minuto e 10 horas.");
      }
      if (!settings.manualBalances || typeof settings.manualBalances !== "object" || Array.isArray(settings.manualBalances) || Object.keys(settings.manualBalances).length > 240) {
        throw new Error("Os saldos manuais são inválidos.");
      }
      for (const [month,balance] of Object.entries(settings.manualBalances)) {
        if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(balance?.positive) || balance.positive<0 || balance.positive>599999 || !Number.isInteger(balance?.negative) || balance.negative<0 || balance.negative>599999) throw new Error("Os saldos manuais são inválidos.");
      }
      const breakMinutes = settings.break === undefined ? fixedBreakMinutes : settings.break;
      if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 600) throw new Error("O intervalo padrão deve estar entre 0 e 600 minutos.");
      const rawTargets = settings.weekdayTargets === undefined ? {} : settings.weekdayTargets;
      if (!rawTargets || typeof rawTargets !== "object" || Array.isArray(rawTargets)) throw new Error("As metas por dia da semana são inválidas.");
      const weekdayTargets = {};
      for (const [day, minutes] of Object.entries(rawTargets)) {
        if (!/^[0-6]$/.test(day) || !Number.isInteger(minutes) || minutes < 1 || minutes > maxDailyWorkMinutes) throw new Error("A meta de cada dia da semana deve estar entre 1 minuto e 10 horas.");
        weekdayTargets[day] = minutes;
      }
      const nextSettings = { ...settings, break: breakMinutes, weekdayTargets };
      await repository.saveSettings(nextSettings);
      return nextSettings;
    }

    return { getSettings, saveRecord, importForpontoRecords, deleteRecord, deleteAllRecords, saveSettings };
  }

  return { createHoursUseCases };
});
