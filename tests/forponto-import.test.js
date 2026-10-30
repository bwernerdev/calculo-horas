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

test("FERIAS na coluna de marcações vira registro de férias (linhas e PDF)", () => {
  const [rowsBlock] = parseRows([{ A:"20/10/2026 Ter-Norm", G:"FERIAS" }]);
  assert.equal(rowsBlock.days[0].status, "ready");
  assert.equal(rowsBlock.days[0].record.type, "ferias");
  assert.deepEqual(rowsBlock.days[0].record.importData.punches, ["","","",""]);
  const item=(str,x,y)=>({ str, transform:[1,0,0,1,x,y] });
  const [block]=parsePdfPages([{ width:792,items:[
    item("SALDO",605.8,505.6),
    item("20/10/2026 Ter-Norm",39.8,475.6),item("FERIAS",233,475.6),
    item("23/10/2026 Sex-Norm",39.8,463.6),item("07:56",196.8,463.6),item("11:30",226,463.6),item("12:30",255.1,463.6),item("18:08",284.3,463.6),item("00:24",610,463.6)
  ] }]);
  assert.deepEqual(block.days.map((day)=>day.record.type),["ferias","trabalho"]);
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

test("rejeita data inexistente sem derrubar o restante do bloco", () => {
  const [block] = parseRows([
    { A:"31/02/2026 Sex-Norm", F:"08:00", G:"12:00", H:"13:00", I:"17:00" },
    { A:"01/03/2026 Dom-Folg" }
  ]);
  assert.equal(block.days[0].status, "invalid");
  assert.equal(block.days[0].reason, "Data inválida");
  assert.equal(block.days[1].status, "ready");
});

test("duas marcações atravessando a meia-noite usam o saldo final do relatório", () => {
  const [block] = parseRows([{ A:"10/09/2026 Qui-Norm", F:"22:00", G:"06:00", S:"+00:00" }]);
  assert.equal(block.days[0].status, "ready");
  assert.equal(block.days[0].record.start, "22:00");
  assert.equal(block.days[0].record.end, "06:00");
});

test("duas marcações acima de 10 horas ficam pendentes", () => {
  const [block] = parseRows([{ A:"11/09/2026 Sex-Norm", F:"06:00", G:"17:00", S:"+02:00" }]);
  assert.equal(block.days[0].status, "skipped");
  assert.match(block.days[0].reason, /10 horas/);
});

test("saldo oficial com formato inválido ou acima de 24h deixa o dia pendente", () => {
  const rows = ["1h30", "+25:00", "12:75", "abc"].map((saldo, index) => (
    { A:`0${index + 1}/09/2026 Ter-Norm`, F:"08:00", G:"12:00", S:saldo }
  ));
  const [block] = parseRows(rows);
  assert.deepEqual(block.days.map((day) => day.status), ["skipped", "skipped", "skipped", "skipped"]);
  assert.ok(block.days.every((day) => day.reason === "Saldo oficial inválido"));
});

test("aceita saldo com sinal positivo explícito e sem sinal", () => {
  const [block] = parseRows([
    { A:"01/09/2026 Ter-Norm", F:"08:00", G:"12:00", S:"+01:30" },
    { A:"02/09/2026 Qua-Norm", F:"08:00", G:"12:00", S:"01:30" }
  ]);
  assert.equal(block.days[0].record.importData.officialBalanceMinutes, 90);
  assert.equal(block.days[1].record.importData.officialBalanceMinutes, 90);
});

test("intervalo invertido, acima de 10 horas ou jornada negativa ficam pendentes", () => {
  const [block] = parseRows([
    { A:"01/09/2026 Ter-Norm", F:"08:00", G:"13:00", H:"12:00", I:"17:00" },
    { A:"02/09/2026 Qua-Norm", F:"08:00", G:"08:30", H:"20:00", I:"21:00" },
    { A:"03/09/2026 Qui-Norm", F:"12:00", G:"13:00", H:"14:00", I:"11:00" }
  ]);
  assert.deepEqual(block.days.map((day) => day.status), ["skipped", "skipped", "skipped"]);
  assert.ok(block.days.every((day) => /fora dos limites/.test(day.reason)));
});

test("descrição do dia acima de 100 caracteres não é importada", () => {
  const [block] = parseRows([{ A:`01/09/2026 ${"x".repeat(101)}` }]);
  assert.equal(block.days[0].status, "skipped");
  assert.match(block.days[0].reason, /extensa demais/);
});

test("classifica férias, feriado e folga sem confundir rótulos parecidos", () => {
  const [block] = parseRows([
    { A:"01/09/2026 Ter-Férias" },
    { A:"02/09/2026 Qua-Fer" },
    { A:"03/09/2026 Qui-Comp" },
    { A:"04/09/2026 Sex-Norm" }
  ]);
  assert.deepEqual(block.days.map((day) => day.record?.type), ["ferias", "feriado", "folga", undefined]);
  assert.equal(block.days[3].status, "skipped");
});

test("usa o cabeçalho da coluna C para identificar cada bloco", () => {
  const blocks = parseRows([
    { C:"123 - Maria da Silva" },
    { A:"01/09/2026 Ter-Folg" },
    { C:"456 - João Souza" },
    { A:"01/09/2026 Ter-Folg" }
  ]);
  assert.deepEqual(blocks.map((block) => block.header), ["123 - Maria da Silva", "456 - João Souza"]);
});

test("planilha sem nenhum dia produz zero blocos", () => {
  assert.deepEqual(parseRows([{ A:"Relatório de ponto" }, {}, { C:"1 - Fulano" }]), []);
});

test("PDF em página de largura diferente é normalizado para a mesma escala", () => {
  const scale = 842 / 792;
  const item = (str, x, y) => ({ str, transform:[1,0,0,1,x * scale,y] });
  const [block] = parsePdfPages([{ width:842, items:[
    item("SALDO", 605.8, 505.6),
    item("17/08/2026 Seg-Norm", 39.8, 475.6),
    item("08:00", 196.8, 475.6), item("12:00", 226, 475.6), item("13:00", 255.1, 475.6), item("17:00", 284.3, 475.6)
  ] }]);
  assert.equal(block.days[0].record.break, 60);
});

test("PDF sem coluna de saldo é recusado", () => {
  const item = (str, x, y) => ({ str, transform:[1,0,0,1,x,y] });
  assert.throws(() => parsePdfPages([{ width:792, items:[
    item("17/08/2026 Seg-Norm", 39.8, 475.6), item("08:00", 196.8, 475.6), item("12:00", 226, 475.6)
  ] }]), /coluna de saldo/);
});

test("PDF sem texto de dias (digitalizado) é recusado com orientação", () => {
  assert.throws(() => parsePdfPages([{ width:792, items:[] }]), /texto selecionável/);
});
