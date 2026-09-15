(function exposeUseCases(root, factory) {
  const useCases = factory();
  if (typeof module === "object" && module.exports) module.exports = useCases;
  if (root) root.HoursUseCases = useCases;
})(typeof globalThis !== "undefined" ? globalThis : this, function createUseCases() {
  function createHoursUseCases({ calculator, repository, fixedBreakMinutes = 60, maxDailyWorkMinutes = 600 }) {
    async function getSettings() {
      const saved = await repository.getSettings();
      const manualBalances = saved.manualBalances && typeof saved.manualBalances === "object" && !Array.isArray(saved.manualBalances) ? saved.manualBalances : {};
      return {
        target: Number.isInteger(saved.target) && saved.target > 0 ? saved.target : 528,
        break: fixedBreakMinutes,
        theme: saved.theme === "dark" ? "dark" : "light",
        manualBalances
      };
    }

    async function saveRecord(record, targetMinutes, currentRecords) {
      if (record.type === "trabalho") {
        if (!record.start || !record.end) throw new Error("Informe os horários de entrada e saída.");
        const worked = calculator.calculate(record, targetMinutes).worked;
        if (worked < 0) throw new Error("O intervalo não pode superar a jornada.");
        if (worked > maxDailyWorkMinutes) throw new Error("A jornada não pode ultrapassar 10 horas trabalhadas no dia.");
      }

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

    async function deleteRecord(id, currentRecords) {
      await repository.deleteRecord(id);
      const records = Array.isArray(currentRecords) ? currentRecords : await repository.findAllRecords();
      return records.filter((item) => item.id !== id);
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
      const nextSettings = { ...settings, break: fixedBreakMinutes };
      await repository.saveSettings(nextSettings);
      return nextSettings;
    }

    return { getSettings, saveRecord, deleteRecord, saveSettings };
  }

  return { createHoursUseCases };
});
