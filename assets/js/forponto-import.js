(function exposeForponto(root, factory) {
  const importer = factory();
  if (typeof module === "object" && module.exports) module.exports = importer;
  if (root) root.ForpontoImport = importer;
})(typeof globalThis !== "undefined" ? globalThis : this, function createForpontoImporter() {
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_XML_BYTES = 8 * 1024 * 1024;
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const dateCell = /^(\d{2})\/(\d{2})\/(\d{4})\s*(.*)$/;

  function minutes(value) {
    const [hours, mins] = value.split(":").map(Number);
    return hours * 60 + mins;
  }

  function validDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function classifyDay(label) {
    const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/(?:^|-)ferias(?:-|$)/.test(normalized)) return "ferias";
    if (/(?:^|-)fer(?:-|$)/.test(normalized)) return "feriado";
    if (/(?:^|-)(?:folg|comp)(?:-|$)/.test(normalized)) return "folga";
    return null;
  }

  function parseDay(row) {
    const match = dateCell.exec(String(row.A || "").trim());
    if (!match) return null;
    const [, dayText, monthText, yearText, label] = match;
    const day = Number(dayText), month = Number(monthText), year = Number(yearText);
    const date = `${yearText}-${monthText}-${dayText}`;
    if (!validDate(year, month, day)) return { date, label, status:"invalid", reason:"Data inválida" };
    const punches = [row.F, row.G, row.H, row.I].map((value) => String(value || "").trim());
    const filled = punches.filter(Boolean);
    if (filled.length === 0) {
      const type = classifyDay(label);
      return type ? { date, label, status:"ready", record:{ date, type, start:"", end:"", break:0 } }
        : { date, label, status:"skipped", reason:"Sem marcações; tipo de dia não confirmado" };
    }
    if (filled.length !== 4 || !punches.every((value) => clock.test(value))) {
      return { date, label, punches, status:"skipped", reason:"Marcações incompletas ou não numéricas" };
    }
    const start = minutes(punches[0]), breakStart = minutes(punches[1]);
    const breakEnd = minutes(punches[2]), end = minutes(punches[3]);
    const breakMinutes = breakEnd - breakStart;
    const worked = end - start - breakMinutes;
    if (breakStart < start || breakEnd < breakStart || end < breakEnd || breakMinutes > 600 || worked < 0 || worked > 600) {
      return { date, label, punches, status:"skipped", reason:"Jornada ou intervalo fora dos limites" };
    }
    return { date, label, punches, status:"ready", record:{ date, type:"trabalho", start:punches[0], end:punches[3], break:breakMinutes } };
  }

  function parseRows(rows) {
    const blocks = [];
    let current;
    let header = "";
    for (const row of rows) {
      const day = parseDay(row);
      if (!day) {
        if (row.C && String(row.C).includes(" - ")) header = String(row.C).trim();
        continue;
      }
      if (!current || current.days.some((item) => item.date === day.date)) {
        current = { header, days:[] };
        blocks.push(current);
        header = "";
      }
      current.days.push(day);
    }
    return blocks.filter((block) => block.days.length > 0);
  }

  function xmlDocument(bytes) {
    if (!bytes || bytes.length > MAX_XML_BYTES) throw new Error("A planilha é grande demais para importação.");
    const text = new TextDecoder("utf-8", { fatal:true }).decode(bytes);
    const document = new DOMParser().parseFromString(text, "application/xml");
    if (document.getElementsByTagName("parsererror").length) throw new Error("XML da planilha inválido.");
    return document;
  }

  function child(element, name) {
    return Array.from(element.children).find((item) => item.localName === name);
  }

  function sharedStrings(document) {
    return Array.from(document.getElementsByTagName("si")).map((item) =>
      Array.from(item.getElementsByTagName("t")).map((text) => text.textContent).join(""));
  }

  function sheetRows(document, strings) {
    return Array.from(document.getElementsByTagName("row")).map((row) => {
      const cells = {};
      for (const cell of Array.from(row.children).filter((item) => item.localName === "c")) {
        const column = /^[A-Z]+/.exec(cell.getAttribute("r") || "")?.[0];
        if (!column) continue;
        const value = child(cell, "v")?.textContent || "";
        cells[column] = cell.getAttribute("t") === "s" ? (value === "" ? "" : strings[Number(value)] || "")
          : cell.getAttribute("t") === "inlineStr" ? Array.from(cell.getElementsByTagName("t")).map((item) => item.textContent).join("") : value;
      }
      return cells;
    });
  }

  async function parseFile(file, unzip) {
    if (!/\.xlsx$/i.test(file.name) || file.size > MAX_FILE_BYTES) throw new Error("Selecione um arquivo XLSX de até 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const files = unzip(bytes, { filter(entry) {
      if (entry.originalSize > MAX_XML_BYTES) throw new Error("A planilha é grande demais para importação.");
      return entry.name === "xl/worksheets/sheet1.xml" || entry.name === "xl/sharedStrings.xml";
    } });
    const sheet = xmlDocument(files["xl/worksheets/sheet1.xml"]);
    const strings = files["xl/sharedStrings.xml"] ? sharedStrings(xmlDocument(files["xl/sharedStrings.xml"])) : [];
    const blocks = parseRows(sheetRows(sheet, strings));
    if (!blocks.length) throw new Error("Nenhum dia reconhecido na primeira aba do relatório Forponto.");
    return blocks;
  }

  return { parseRows, parseFile };
});
