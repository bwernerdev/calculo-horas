(function exposeUseCases(root, factory) {
  const useCases = factory();
  if (typeof module === "object" && module.exports) module.exports = useCases;
  if (root) root.HoursUseCases = useCases;
})(typeof globalThis !== "undefined" ? globalThis : this, function createUseCases() {
  function createHoursUseCases({ calculator, repository, fixedBreakMinutes = 60, maxDailyWorkMinutes = 600 }) {
    async function getSettings() {
      const saved = await repository.getSettings();
      return {
        target: Number.isInteger(saved.target) && saved.target > 0 ? saved.target : 528,
        break: fixedBreakMinutes,
        theme: saved.theme === "dark" ? "dark" : "light"
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
      const nextSettings = { ...settings, break: fixedBreakMinutes };
      await repository.saveSettings(nextSettings);
      return nextSettings;
    }

    return { getSettings, saveRecord, deleteRecord, saveSettings };
  }

  return { createHoursUseCases };
});
