const test = require("node:test");
const assert = require("node:assert/strict");

const { uiModules, readScripts } = require("./helpers/app-source");
const script = readScripts(uiModules);

test("backup valida calendário, relógio, volume e fotos antes da restauração", () => {
  assert.match(script, /function isValidCalendarDate/);
  assert.match(script, /getUTCFullYear\(\)===year/);
  assert.match(script, /function isValidClockTime/);
  assert.match(script, /MAX_BACKUP_FILE_BYTES/);
  assert.match(script, /MAX_BACKUP_RECORDS/);
  assert.match(script, /MAX_BACKUP_PHOTO_LENGTH/);
  assert.match(script, /saldosManuais:settings\.manualBalances/);
  assert.match(script, /Os saldos manuais do backup são inválidos/);
  assert.match(script, /worked<0 \|\| worked>MAX_DAILY_WORK_MINUTES/);
});

test("interface usa restauração transacional e CRUD individual", () => {
  assert.match(script, /repository\.restoreBackup\(imported,nextSettings\)/);
  assert.match(script, /useCases\.saveRecord\(record,settings\.target,records\)/);
  assert.match(script, /useCases\.deleteRecord\(id,\[\]\)/);
  assert.doesNotMatch(script, /repository\.saveAllRecords/);
});

test("lembrete de backup acompanha downloads e pode ser adiado", () => {
  assert.match(script, /BACKUP_REMINDER_DAYS = 30/);
  assert.match(script, /BACKUP_SNOOZE_DAYS = 7/);
  assert.match(script, /renderBackupReminder\(\)/);
  assert.match(script, /backupReminderKey\("last"\)/);
});
