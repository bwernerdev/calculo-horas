const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRows, parsePdfPages } = require("../assets/js/forponto-import.js");

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
    date:"2026-08-17", type:"trabalho", start:"07:41", end:"16:19", break:60,
    importData:{ source:"forponto", label:"Seg-Norm", punches:["07:41","11:30","12:30","16:19"], officialBalanceMinutes:null }
  });
  assert.equal(blocks[1].days[0].status, "skipped");
});

test("registra duas marcações sem inventar intervalo e sinaliza texto ou excesso", () => {
  const [block] = parseRows([
    { A:"19/08/2026 Qua-Norm", F:"08:02", G:"12:24", S:"-05:20" },
    { A:"03/09/2026 Qui-Norm", G:"COMPENSA DIA", S:"-08:00" },
    { A:"04/09/2026 Sex-Norm", F:"06:00", G:"12:00", H:"13:00", I:"19:00" }
  ]);
  assert.deepEqual(block.days.map((day) => day.status), ["ready","ready","skipped"]);
  assert.equal(block.days[0].record.start, "08:02");
  assert.equal(block.days[0].record.end, "12:24");
  assert.equal(block.days[0].record.break, 0);
  assert.equal(block.days[0].record.importData.officialBalanceMinutes, -320);
  assert.equal(block.days[1].record.type, "compensacao");
  assert.equal(block.days[1].record.importData.officialBalanceMinutes, -480);
  assert.match(block.days[0].note, /2 marcações/);
});

test("não presume saída para uma única batida nem ignora uma terceira", () => {
  const [block] = parseRows([
    { A:"01/09/2026 Ter-Norm", F:"08:00" },
    { A:"02/09/2026 Qua-Norm", F:"08:00", G:"12:00", H:"13:00" }
  ]);
  assert.deepEqual(block.days.map((day) => day.status), ["skipped","skipped"]);
});

test("duas batidas usam o saldo final positivo ou negativo e exigem esse valor", () => {
  const [block] = parseRows([
    { A:"19/08/2026 Qua-Norm", F:"08:02", G:"12:24", S:"-05:20" },
    { A:"05/09/2026 Sáb-Norm", F:"08:00", G:"12:17", S:"00:17" },
    { A:"12/09/2026 Sáb-Norm", F:"08:08", G:"14:02", S:"01:54" },
    { A:"13/09/2026 Dom-Norm", F:"08:00", G:"12:00" }
  ]);
  assert.deepEqual(block.days.map((day)=>day.record?.importData?.officialBalanceMinutes), [-320,17,114,undefined]);
  assert.match(block.days[0].note, /-05:20/);
  assert.match(block.days[1].note, /\+00:17/);
  assert.match(block.days[2].note, /\+01:54/);
  assert.equal(block.days[3].status, "skipped");
});

test("aceita intervalo diferente de 60 minutos e feriado explícito", () => {
  const [block] = parseRows([
    { A:"07/09/2026 Seg-Norm-Fer" },
    { A:"08/09/2026 Ter-Norm", F:"08:00", G:"12:00", H:"12:45", I:"17:00" }
  ]);
  assert.equal(block.days[0].record.type, "feriado");
  assert.equal(block.days[1].record.break, 45);
});

test("PDF usa as mesmas regras do XLSX e ignora páginas de resumo repetidas", () => {
  const item=(str,x,y)=>({ str, transform:[1,0,0,1,x,y] });
  const detailed=[
    item("SALDO",605.8,505.6),
    item("16/08/2026 Dom-Folg",39.8,487.6),
    item("17/08/2026 Seg-Norm",39.8,475.6),item("07:41",196.8,475.6),item("11:30",226,475.6),item("12:30",255.1,475.6),item("16:19",284.3,475.6),
    item("19/08/2026 Qua-Norm",39.8,463.6),item("08:02",196.8,463.6),item("12:24",226,463.6),item("-05:20",607.5,463.6),
    item("03/09/2026 Qui-Norm",39.8,451.6),item("COMPENSA DIA",217,451.6),item("-08:00",607.5,451.6),
    item("05/09/2026 Sáb-Norm",39.8,439.6),item("08:00",196.8,439.6),item("12:17",226,439.6),item("00:17",607.5,439.6),
    item("06/09/2026 Dom-Norm",39.8,427.6),item("08:00",196.8,427.6),item("12:00",226,427.6),item("13:00",255.1,427.6)
  ];
  const summary=[item("16/08/2026 Dom",39.8,487.6),item("17/08/2026 Seg",39.8,475.6),item("-05:20",607.5,475.6)];
  const [block]=parsePdfPages([{ items:detailed,width:792 },{ items:summary,width:792 }]);
  assert.equal(block.days.length,6);
  assert.deepEqual(block.days.map((day)=>day.status),["ready","ready","ready","ready","ready","skipped"]);
  assert.equal(block.days[1].record.break,60);
  assert.equal(block.days[2].record.importData.officialBalanceMinutes,-320);
  assert.equal(block.days[3].record.type,"compensacao");
  assert.equal(block.days[4].record.importData.officialBalanceMinutes,17);
});

test("PDF rejeita colunas deslocadas antes de abrir a prévia", () => {
  const item=(str,x,y)=>({ str, transform:[1,0,0,1,x,y] });
  const page={ width:792,items:[
    item("SALDO",605.8,505.6),
    item("17/08/2026 Seg-Norm",39.8,475.6),
    item("08:00",308,475.6),item("12:00",226,475.6)
  ] };
  assert.throws(()=>parsePdfPages([page]),/Layout do PDF não reconhecido/);
});
