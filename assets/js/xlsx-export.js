// @ts-check
/** UMD: gera uma planilha XLSX mínima (uma aba, cabeçalho em negrito, datas reais) usando o fflate injetado. */
(function exposeXlsx(/** @type {any} */ root, factory) {
  const xlsx = factory();
  if (typeof module === "object" && module.exports) module.exports = xlsx;
  if (root) root.HoursXlsx = xlsx;
})(typeof globalThis !== "undefined" ? globalThis : this, function createXlsx() {
  /** @param {unknown} value */
  function escapeXml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** @param {number} index coluna 0 = A */
  function columnName(index) {
    let number = index + 1, name = "";
    while (number > 0) {
      const remainder = (number - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      number = Math.floor((number - 1) / 26);
    }
    return name;
  }

  /** Número de série do Excel (sistema 1900) para AAAA-MM-DD. @param {string} iso */
  function serial(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000);
  }

  /** @param {any} cell @param {string} ref */
  function cellXml(cell, ref) {
    if (cell === null || cell === undefined || cell === "") return "";
    if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
    if (typeof cell === "object" && cell.date) return `<c r="${ref}" s="2"><v>${serial(cell.date)}</v></c>`;
    if (typeof cell === "object" && cell.bold !== undefined) return `<c r="${ref}" t="inlineStr" s="1"><is><t xml:space="preserve">${escapeXml(cell.bold)}</t></is></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
  }

  /**
   * @param {{sheetName?:string, header:string[], rows:any[][], widths?:number[]}} sheet
   * @param {{strToU8:(text:string)=>Uint8Array, zipSync:(files:Record<string,Uint8Array>)=>Uint8Array}} zipTools
   */
  function build({ sheetName = "Horas", header, rows, widths = [] }, zipTools) {
    const safeName = escapeXml(sheetName.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Horas");
    const all = [header.map((title) => ({ bold: title })), ...rows];
    const sheetData = all.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => cellXml(cell, columnName(c) + (r + 1))).join("")}</row>`).join("");
    const cols = widths.length ? `<cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>` : "";
    const header_ = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files = {
      "[Content_Types].xml": `${header_}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      "_rels/.rels": `${header_}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `${header_}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `${header_}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": `${header_}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
      "xl/worksheets/sheet1.xml": `${header_}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${sheetData}</sheetData></worksheet>`,
    };
    /** @type {Record<string, Uint8Array>} */
    const encoded = {};
    for (const [name, content] of Object.entries(files)) encoded[name] = zipTools.strToU8(content);
    return zipTools.zipSync(encoded);
  }

  return { build, serial, columnName };
});
