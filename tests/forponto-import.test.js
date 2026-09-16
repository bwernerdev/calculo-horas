const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRows } = require("../assets/js/forponto-import.js");

test("separa blocos com as mesmas datas e calcula o intervalo real", () => {
  const blocks = parseRows([
    { A:"16/08/2026 Dom-Folg" },
    { A:"17/08/2026 Seg-Norm", F:"07:41", G:"11:30", H:"12:30", I:"16:19" },
    { A:"16/08/2026 Dom" },
    { A:"17/08/2026 Seg" }
  ]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].days[0].record.type, "folga");
  assert.deepEqual(blocks[0].days[1].record, {
    date:"2026-08-17", type:"trabalho", start:"07:41", end:"16:19", break:60
  });
  assert.equal(blocks[1].days[0].status, "skipped");
});

test("sinaliza marcações incompletas, texto e jornadas acima do limite", () => {
  const [block] = parseRows([
    { A:"19/08/2026 Qua-Norm", F:"08:02", G:"12:24" },
    { A:"03/09/2026 Qui-Norm", G:"COMPENSA DIA" },
    { A:"04/09/2026 Sex-Norm", F:"06:00", G:"12:00", H:"13:00", I:"19:00" }
  ]);
  assert.deepEqual(block.days.map((day) => day.status), ["skipped","skipped","skipped"]);
});

test("aceita intervalo diferente de 60 minutos e feriado explícito", () => {
  const [block] = parseRows([
    { A:"07/09/2026 Seg-Norm-Fer" },
    { A:"08/09/2026 Ter-Norm", F:"08:00", G:"12:00", H:"12:45", I:"17:00" }
  ]);
  assert.equal(block.days[0].record.type, "feriado");
  assert.equal(block.days[1].record.break, 45);
});
