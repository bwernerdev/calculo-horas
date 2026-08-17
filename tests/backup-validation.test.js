const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const script = fs.readFileSync("script.js", "utf8");

test("backup valida calendário, relógio, volume e fotos antes da restauração", () => {
  assert.match(script, /function isValidCalendarDate/);
  assert.match(script, /getUTCFullYear\(\)===year/);
  assert.match(script, /function isValidClockTime/);
  assert.match(script, /MAX_BACKUP_FILE_BYTES/);
  assert.match(script, /MAX_BACKUP_RECORDS/);
  assert.match(script, /MAX_BACKUP_PHOTO_LENGTH/);
  assert.match(script, /worked<0 \|\| worked>MAX_DAILY_WORK_MINUTES/);
});

test("interface usa restauração transacional e CRUD individual", () => {
  assert.match(script, /repository\.restoreBackup\(imported,nextSettings\)/);
  assert.match(script, /useCases\.saveRecord\(record,settings\.target,records\)/);
  assert.match(script, /useCases\.deleteRecord\(remove,records\)/);
  assert.doesNotMatch(script, /repository\.saveAllRecords/);
});
