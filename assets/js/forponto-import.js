(function exposeForponto(root, factory) {
  const importer = factory();
  if (typeof module === "object" && module.exports) module.exports = importer;
  if (root) root.ForpontoImport = importer;
})(typeof globalThis !== "undefined" ? globalThis : this, function createForpontoImporter() {
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_XML_BYTES = 8 * 1024 * 1024;
  const MAX_PDF_PAGES = 50;
  const MAX_PDF_ITEMS_PER_PAGE = 10000;
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

  function officialBalance(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    if (!/^[+-]?\d{1,3}:[0-5]\d$/.test(text)) return undefined;
    const negative = text.startsWith("-");
    const [hours, mins] = text.replace(/^[+-]/, "").split(":").map(Number);
    const result = hours * 60 + mins;
    return result > 1440 ? undefined : negative ? -result : result;
  }

  function balanceText(value) {
    const absolute = Math.abs(value);
    return (value > 0 ? "+" : value < 0 ? "-" : "") +
      String(Math.floor(absolute / 60)).padStart(2, "0") + ":" +
      String(absolute % 60).padStart(2, "0");
  }

  function parseDay(row) {
    const match = dateCell.exec(String(row.A || "").trim());
    if (!match) return null;
    const [, dayText, monthText, yearText, label] = match;
    const day = Number(dayText), month = Number(monthText), year = Number(yearText);
    const date = `${yearText}-${monthText}-${dayText}`;
    if (!validDate(year, month, day)) return { date, label, status:"invalid", reason:"Data inválida" };
    if (label.length > 100) return { date, label:"", status:"skipped", reason:"Descrição do dia extensa demais" };
    const punches = [row.F, row.G, row.H, row.I].map((value) => String(value || "").trim());
    const balance = officialBalance(row.S);
    if (balance === undefined) return { date, label, punches, status:"skipped", reason:"Saldo oficial inválido" };
    const withReport = (record) => ({
      ...record,
      importData:{ source:"forponto", label, punches, officialBalanceMinutes:balance }
    });
    const filled = punches.filter(Boolean);
    if (filled.length === 0) {
      const type = classifyDay(label);
      return type ? { date, label, punches, status:"ready", record:withReport({ date, type, start:"", end:"", break:0 }) }
        : { date, label, status:"skipped", reason:"Sem marcações; tipo de dia não confirmado" };
    }
    if (filled.length === 1 && /^COMPENSA DIA$/i.test(punches[1]) && balance !== null) {
      return {
        date, label, punches, status:"ready", note:"Compensação sem batidas; saldo oficial preservado",
        record:withReport({ date, type:"compensacao", start:"", end:"", break:0 })
      };
    }
    if (punches[0] && punches[1] && !punches[2] && !punches[3] && clock.test(punches[0]) && clock.test(punches[1])) {
      if (balance === null) return { date, label, punches, status:"skipped", reason:"2 marcações sem saldo final no relatório" };
      const start = minutes(punches[0]), end = minutes(punches[1]);
      const worked = (end <= start ? end + 1440 : end) - start;
      if (worked > 600) return { date, label, punches, status:"skipped", reason:"Jornada acima de 10 horas" };
      return {
        date, label, punches, status:"ready", note:"2 marcações; saldo final "+balanceText(balance)+"; intervalo não informado (0 min)",
        record:withReport({ date, type:"trabalho", start:punches[0], end:punches[1], break:0 })
      };
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
    return { date, label, punches, status:"ready", record:withReport({ date, type:"trabalho", start:punches[0], end:punches[3], break:breakMinutes }) };
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

  function pdfRows(items, width = 792) {
    const scale=792/width;
    const positioned=items.filter((item)=>Array.isArray(item.transform) && Number.isFinite(item.transform[4]) && Number.isFinite(item.transform[5]))
      .map((item)=>({ text:String(item.str || "").trim(), x:item.transform[4]*scale, y:item.transform[5] }));
    const anchors=positioned.filter((item)=>dateCell.test(item.text) && item.x<180).sort((a,b)=>b.y-a.y);
    return anchors.map((anchor)=>{
      const line=positioned.filter((item)=>Math.abs(item.y-anchor.y)<2.5);
      const label=line.filter((item)=>item!==anchor && item.x>anchor.x && item.x<175).sort((a,b)=>a.x-b.x).map((item)=>item.text).join(" ");
      const row={ A:anchor.text+(label ? " "+label : ""), F:"", G:"", H:"", I:"", S:"" };
      const columns=[{ x:196.8,key:"F" },{ x:226,key:"G" },{ x:255.1,key:"H" },{ x:284.3,key:"I" }];
      for (const item of line) {
        if (item.x<180 || item.x>310 || (!clock.test(item.text) && !/^COMPENSA DIA$/i.test(item.text))) continue;
        const nearest=columns.reduce((best,column)=>Math.abs(column.x-item.x)<Math.abs(best.x-item.x) ? column : best);
        if (Math.abs(nearest.x-item.x)<=18) row[nearest.key]=item.text;
      }
      const saldo=line.filter((item)=>item.x>=590).sort((a,b)=>a.x-b.x).map((item)=>item.text).join("");
      if (/^[+-]?\d{1,3}:[0-5]\d$/.test(saldo)) row.S=saldo;
      return row;
    });
  }

  function parsePdfPages(pages) {
    const detailed=[];
    for (const page of pages) {
      const rows=pdfRows(page.items,page.width);
      if (!rows.some((row)=>/\s\S+-\S+/.test(row.A) || [row.F,row.G,row.H,row.I].some(Boolean))) continue;
      const scale=792/(page.width || 792);
      const hasSaldoHeader=page.items.some((item)=>/\bSALDO\b/i.test(String(item.str || "")) && item.transform?.[4]*scale>=590 && item.transform?.[4]*scale<=650);
      if (!hasSaldoHeader) throw new Error("Layout do PDF não reconhecido: coluna de saldo ausente ou deslocada. Nenhum dia foi importado.");
      let recognizedTotal=0;
      for (const row of rows) {
        const date=row.A.slice(0,10);
        const anchor=page.items.find((item)=>String(item.str || "").startsWith(date) && item.transform?.[4]*scale<180);
        if (!anchor) continue;
        const observed=page.items.filter((item)=>Math.abs(item.transform?.[5]-anchor.transform[5])<2.5 && item.transform?.[4]*scale>=150 && item.transform?.[4]*scale<=330 && (clock.test(String(item.str || "").trim()) || /^COMPENSA DIA$/i.test(String(item.str || "").trim()))).length;
        const recognized=[row.F,row.G,row.H,row.I].filter(Boolean).length;
        recognizedTotal+=recognized;
        if (observed!==recognized) throw new Error("Layout do PDF não reconhecido: marcações fora das colunas esperadas. Nenhum dia foi importado.");
      }
      if (!recognizedTotal && page.items.some((item)=>item.transform?.[4]*scale>=150 && item.transform?.[4]*scale<=450 && clock.test(String(item.str || "").trim()))) {
        throw new Error("Layout do PDF não reconhecido: horários não encontrados nas colunas de marcação. Nenhum dia foi importado.");
      }
      detailed.push(...rows);
    }
    const blocks=parseRows(detailed);
    if (!blocks.length) throw new Error("Nenhum dia detalhado reconhecido no PDF. Use o relatório Forponto com texto selecionável, não uma digitalização.");
    return blocks;
  }

  async function parsePdfFile(file) {
    const bytes=new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0,5))!=="%PDF-") throw new Error("O arquivo selecionado não é um PDF válido.");
    const pdfjs=await import(new URL("./assets/js/vendor/pdf.min.mjs",document.baseURI).href);
    pdfjs.GlobalWorkerOptions.workerSrc=new URL("./assets/js/vendor/pdf.worker.min.mjs",document.baseURI).href;
    const task=pdfjs.getDocument({ data:bytes, isEvalSupported:false, verbosity:pdfjs.VerbosityLevel.ERRORS });
    try {
      const document=await task.promise;
      if (document.numPages>MAX_PDF_PAGES) throw new Error("O PDF excede o limite de 50 páginas.");
      const pages=[];
      for (let number=1;number<=document.numPages;number++) {
        const page=await document.getPage(number);
        const content=await page.getTextContent();
        if (content.items.length>MAX_PDF_ITEMS_PER_PAGE) throw new Error("O PDF contém texto demais para importar com segurança.");
        pages.push({ items:content.items, width:page.view[2]-page.view[0] });
      }
      return parsePdfPages(pages);
    } finally { await task.destroy(); }
  }

  async function parseFile(file, unzip) {
    if (!/\.(xlsx|pdf)$/i.test(file.name) || file.size>MAX_FILE_BYTES) throw new Error("Selecione um arquivo XLSX ou PDF do Forponto de até 5 MB.");
    if (/\.pdf$/i.test(file.name)) return parsePdfFile(file);
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

  return { parseRows, parsePdfPages, parseFile };
});
