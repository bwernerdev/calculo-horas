const test = require("node:test");
const assert = require("node:assert/strict");
const fflate = require("fflate");
const xlsx = require("../assets/js/xlsx-export.js");

const decode = (bytes) => new TextDecoder().decode(bytes);

test("converte datas para o número de série do Excel", () => {
  assert.equal(xlsx.serial("2020-01-01"), 43831);
  assert.equal(xlsx.serial("1900-03-01"), 61);
});

test("nomeia colunas como no Excel", () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(xlsx.columnName), ["A", "Z", "AA", "AB", "ZZ", "AAA"]);
});

test("gera um pacote XLSX com cabeçalho, datas e escapa o conteúdo", () => {
  const bytes = xlsx.build({
    sheetName: "Horas: 2026/10",
    header: ["Data", "Tipo", "Saldo (min)"],
    rows: [[{ date: "2020-01-01" }, "Trabalho & <teste>", -48], [{ bold: "Total" }, "", 0]],
    widths: [12, 20, 12],
  }, fflate);
  const files = fflate.unzipSync(bytes);
  assert.deepEqual(Object.keys(files).sort(), ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
  const sheet = decode(files["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /<c r="A1" t="inlineStr" s="1">/);
  assert.match(sheet, /<c r="A2" s="2"><v>43831<\/v><\/c>/);
  assert.match(sheet, /Trabalho &amp; &lt;teste&gt;/);
  assert.match(sheet, /<c r="C2"><v>-48<\/v><\/c>/);
  assert.match(sheet, /<c r="C3"><v>0<\/v><\/c>/);
  assert.doesNotMatch(sheet, /<c r="B3"/);
  assert.match(sheet, /<col min="1" max="1" width="12" customWidth="1"\/>/);
  const workbook = decode(files["xl/workbook.xml"]);
  assert.ok(workbook.includes("<sheet name=\"Horas  2026 10\""));
});
