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

    async function saveRecord(record, targetMinutes) {
      if (record.type === "trabalho") {
        if (!record.start || !record.end) throw new Error("Informe os horários de entrada e saída.");
        const worked = calculator.calculate(record, targetMinutes).worked;
        if (worked < 0) throw new Error("O intervalo não pode superar a jornada.");
        if (worked > maxDailyWorkMinutes) throw new Error("A jornada não pode ultrapassar 10 horas trabalhadas no dia.");
      }

      const records = await repository.findAllRecords();
      if (records.some((item) => item.date === record.date && item.id !== record.id)) {
        throw new Error("Já existe um registro para esta data. Edite o registro existente.");
      }
      const index = records.findIndex((item) => item.id === record.id);
      const updatedRecords = [...records];
      if (index >= 0) updatedRecords[index] = record;
      else updatedRecords.push(record);
      await repository.saveAllRecords(updatedRecords);
      return { records: updatedRecords, editing: index >= 0 };
    }

    async function deleteRecord(id) {
      const records = (await repository.findAllRecords()).filter((item) => item.id !== id);
      await repository.saveAllRecords(records);
      return records;
    }

    async function saveSettings(settings) {
      const nextSettings = { ...settings, break: fixedBreakMinutes };
      await repository.saveSettings(nextSettings);
      return nextSettings;
    }

    return { getSettings, saveRecord, deleteRecord, saveSettings };
  }

  return { createHoursUseCases };
});
