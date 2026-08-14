const STORAGE_KEY = "controle-horas-registros-v1";
const SETTINGS_KEY = "controle-horas-config-v1";
const TYPES = { trabalho:"Trabalho", folga:"Folga", feriado:"Feriado", ferias:"Férias", falta:"Falta" };
const $ = (selector) => document.querySelector(selector);
const form = $("#hours-form");
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"target":528,"break":60,"theme":"light"}');

function localDate(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date - offset).toISOString().slice(0,10); }
function toMinutes(time) { const [h,m] = time.split(":").map(Number); return h * 60 + m; }
function toClock(minutes) { minutes = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`; }
function duration(minutes) { const value = Math.abs(minutes); return `${Math.floor(value/60)}h ${String(value%60).padStart(2,"0")}min`; }
function signed(minutes) { return `${minutes > 0 ? "+" : minutes < 0 ? "-" : ""}${duration(minutes)}`; }
function escapeCell(value) { const text = String(value ?? ""); return /[";,\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }

function calculate(record) {
  if (record.type === "falta") return { worked:0, balance:-settings.target };
  if (record.type !== "trabalho") return { worked:0, balance:0 };
  let end = toMinutes(record.end); const start = toMinutes(record.start);
  if (end <= start) end += 1440;
  const worked = end - start - Number(record.break);
  return { worked, balance:worked - settings.target };
}

function updateForecast() {
  const visible = $("#day-type").value === "trabalho";
  document.querySelectorAll(".work-field").forEach((field) => field.hidden = !visible);
  $("#exit-forecast").hidden = !visible;
  if (!visible || !$("#start-time").value) return;
  const forecast = toMinutes($("#start-time").value) + settings.target + Number($("#break-time").value || 0);
  $("#exit-forecast").innerHTML = `Saída prevista: <strong>${toClock(forecast)}</strong>`;
}

function filteredRecords() { return records.filter((record) => record.date.startsWith($("#month-filter").value)).sort((a,b) => b.date.localeCompare(a.date)); }
function render() {
  const list = filteredRecords();
  $("#records-body").innerHTML = list.map((record) => {
    const calc = calculate(record); const css = calc.balance > 0 ? "value-positive" : calc.balance < 0 ? "value-negative" : "";
    const date = new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR");
    return `<tr><td>${date}</td><td><span class="tag">${TYPES[record.type]}</span></td><td>${record.start || "—"}</td><td>${record.end || "—"}</td><td>${record.type === "trabalho" ? `${record.break} min` : "—"}</td><td>${duration(calc.worked)}</td><td class="${css}">${signed(calc.balance)}</td><td><button class="table-action" data-edit="${record.id}">Editar</button> <button class="table-action table-action--delete" data-delete="${record.id}">Excluir</button></td></tr>`;
  }).join("");
  $("#empty-state").hidden = list.length > 0;
  const totals = list.reduce((sum,record) => {
    const calc=calculate(record); sum.worked+=calc.worked; sum.balance+=calc.balance;
    if (calc.balance>0) sum.positive+=calc.balance; if (calc.balance<0) sum.negative+=calc.balance;
    return sum;
  }, {worked:0,balance:0,positive:0,negative:0});
  $("#monthly-worked").textContent = duration(totals.worked); $("#monthly-balance").textContent = signed(totals.balance);
  $("#monthly-positive").textContent = `+${duration(totals.positive)}`;
  $("#monthly-negative").textContent = `-${duration(totals.negative)}`;
  $("#monthly-balance").className = totals.balance > 0 ? "value-positive" : totals.balance < 0 ? "value-negative" : "";
  $("#registered-days").textContent = list.length; $("#target-summary").textContent = duration(settings.target);
}

function resetForm() {
  form.reset(); $("#editing-id").value=""; $("#work-date").value=localDate(); $("#break-time").value=settings.break;
  $("#form-title").textContent="Registrar jornada"; $("#submit-button").textContent="Adicionar registro";
  $("#cancel-edit").hidden=true; $("#error-message").hidden=true; updateForecast();
}
function showError(message) { $("#error-message").textContent=message; $("#error-message").hidden=false; }

form.addEventListener("submit", (event) => {
  event.preventDefault(); const type=$("#day-type").value;
  const record={ id:$("#editing-id").value || crypto.randomUUID(), date:$("#work-date").value, type, start:type==="trabalho" ? $("#start-time").value : "", end:type==="trabalho" ? $("#end-time").value : "", break:type==="trabalho" ? Number($("#break-time").value) : 0 };
  if (type==="trabalho") { if (!record.start || !record.end) return showError("Informe os horários de entrada e saída."); if (calculate(record).worked < 0) return showError("O intervalo não pode superar a jornada."); }
  if (records.find((item) => item.date===record.date && item.id!==record.id)) return showError("Já existe um registro para esta data. Edite o registro existente.");
  const index=records.findIndex((item) => item.id===record.id); if (index>=0) records[index]=record; else records.push(record);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(records)); resetForm(); render();
});

function editRecord(id) {
  const record=records.find((item)=>item.id===id); if (!record) return;
  $("#editing-id").value=record.id; $("#work-date").value=record.date; $("#day-type").value=record.type;
  if (record.start) $("#start-time").value=record.start; if (record.end) $("#end-time").value=record.end; $("#break-time").value=record.break;
  $("#form-title").textContent="Editar jornada"; $("#submit-button").textContent="Salvar alteração"; $("#cancel-edit").hidden=false; updateForecast(); scrollTo({top:0,behavior:"smooth"});
}
$("#records-body").addEventListener("click", (event) => {
  const edit=event.target.dataset.edit, remove=event.target.dataset.delete; if (edit) editRecord(edit);
  if (remove && confirm("Excluir este registro?")) { records=records.filter((item)=>item.id!==remove); localStorage.setItem(STORAGE_KEY,JSON.stringify(records)); render(); }
});

$("#settings-toggle").addEventListener("click",()=>$("#settings-form").hidden=!$("#settings-form").hidden);
$("#settings-form").addEventListener("submit",(event)=>{ event.preventDefault(); settings.target=toMinutes($("#daily-target").value); settings.break=Number($("#default-break").value); localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); $("#settings-form").hidden=true; resetForm(); render(); });
$("#day-type").addEventListener("change",updateForecast); $("#start-time").addEventListener("input",updateForecast); $("#break-time").addEventListener("input",updateForecast);
$("#month-filter").addEventListener("change",render); $("#cancel-edit").addEventListener("click",resetForm);
form.addEventListener("reset",()=>setTimeout(()=>{
  $("#editing-id").value=""; $("#work-date").value=localDate(); $("#break-time").value=settings.break;
  $("#form-title").textContent="Registrar jornada"; $("#submit-button").textContent="Adicionar registro";
  $("#cancel-edit").hidden=true; $("#error-message").hidden=true; updateForecast();
}));

function applyTheme() { document.documentElement.dataset.theme=settings.theme; $("#theme-toggle").textContent=settings.theme==="dark" ? "☀️" : "🌙"; }
$("#theme-toggle").addEventListener("click",()=>{ settings.theme=settings.theme==="dark" ? "light" : "dark"; applyTheme(); localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); });
$("#export-csv").addEventListener("click",()=>{
  const header=["Data","Tipo","Entrada","Saída","Intervalo (min)","Trabalhado","Saldo"];
  const rows=filteredRecords().map((r)=>{ const c=calculate(r); return [r.date,TYPES[r.type],r.start,r.end,r.break,duration(c.worked),signed(c.balance)]; });
  const csv="\uFEFF"+[header,...rows].map((row)=>row.map(escapeCell).join(";")).join("\r\n"); const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); link.download=`horas-${$("#month-filter").value}.csv`; link.click(); URL.revokeObjectURL(link.href);
});
function pdfText(value) {
  return String(value).replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)");
}

function buildPdf() {
  const list=filteredRecords();
  const totals=list.reduce((sum,record)=>{ const calc=calculate(record); sum.worked+=calc.worked; sum.balance+=calc.balance; if (calc.balance>0) sum.positive+=calc.balance; if (calc.balance<0) sum.negative+=calc.balance; return sum; },{worked:0,balance:0,positive:0,negative:0});
  const rows=list.map((record)=>({record,calc:calculate(record)}));
  const pages=[]; let position=0;
  if (!rows.length) pages.push([]);
  while (position<rows.length) { const capacity=pages.length===0 ? 22 : 29; pages.push(rows.slice(position,position+capacity)); position+=capacity; }
  const regularFontId=3+pages.length*2, boldFontId=regularFontId+1, objects=[];
  objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds=pages.map((_,index)=>3+index*2); objects[2]=`<< /Type /Pages /Kids [${pageIds.map((id)=>`${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  const text=(value,x,y,size=9,font="F1",color="0.10 0.15 0.24")=>`BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(value)}) Tj ET`;
  const fill=(x,y,width,height,color)=>`${color} rg ${x} ${y} ${width} ${height} re f`;
  const line=(x1,y1,x2,y2,color="0.86 0.89 0.94")=>`${color} RG ${x1} ${y1} m ${x2} ${y2} l S`;
  pages.forEach((page,index)=>{
    const pageId=3+index*2, contentId=pageId+1;
    const commands=[fill(0,760,595,82,"0.12 0.25 0.68"),text("CONTROLE DE JORNADA",42,810,9,"F2","0.76 0.82 1"),text("Relatório mensal de horas",42,783,21,"F2","1 1 1"),text(`Período: ${$("#month-filter").value}   |   Meta diária: ${duration(settings.target)}`,390,787,8,"F1","0.88 0.91 1")];
    let tableTop;
    if (index===0) {
      const cards=[
        {label:"SALDO DO MÊS",value:signed(totals.balance),bg:"0.91 0.93 1",fg:"0.12 0.25 0.68"},
        {label:"HORAS POSITIVAS",value:`+${duration(totals.positive)}`,bg:"0.89 0.97 0.93",fg:"0.02 0.42 0.24"},
        {label:"HORAS NEGATIVAS",value:`-${duration(totals.negative)}`,bg:"1 0.91 0.90",fg:"0.70 0.14 0.10"},
        {label:"TOTAL TRABALHADO",value:duration(totals.worked),bg:"0.95 0.96 0.98",fg:"0.10 0.15 0.24"}
      ];
      cards.forEach((card,cardIndex)=>{ const x=42+cardIndex*130; commands.push(fill(x,675,120,64,card.bg),text(card.label,x+10,719,7,"F2","0.38 0.43 0.52"),text(card.value,x+10,692,14,"F2",card.fg)); });
      tableTop=646;
    } else tableTop=735;
    commands.push(text("REGISTROS DO PERÍODO",42,tableTop+13,9,"F2","0.24 0.31 0.43"));
    const headerY=tableTop-22; commands.push(fill(42,headerY,511,24,"0.12 0.25 0.68"));
    const columns=[42,105,180,230,278,349,439];
    ["Data","Tipo","Entrada","Saída","Intervalo","Trabalhado","Saldo"].forEach((label,column)=>commands.push(text(label,columns[column]+6,headerY+8,7,"F2","1 1 1")));
    let rowY=headerY-23;
    page.forEach(({record,calc},rowIndex)=>{
      if (rowIndex%2===0) commands.push(fill(42,rowY,511,23,"0.97 0.98 1"));
      const values=[record.date.split("-").reverse().join("/"),TYPES[record.type],record.start||"-",record.end||"-",record.type==="trabalho"?`${record.break} min`:"-",duration(calc.worked),signed(calc.balance)];
      values.forEach((value,column)=>{ const balanceColor=column===6 ? (calc.balance>0 ? "0.02 0.42 0.24" : calc.balance<0 ? "0.70 0.14 0.10" : "0.38 0.43 0.52") : "0.16 0.21 0.30"; commands.push(text(value,columns[column]+6,rowY+8,7.5,column===6?"F2":"F1",balanceColor)); });
      commands.push(line(42,rowY,553,rowY)); rowY-=23;
    });
    if (!page.length) commands.push(text("Nenhum registro no mês selecionado.",42,rowY-12,10,"F1","0.38 0.43 0.52"));
    commands.push(line(42,44,553,44),text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} | Meu Banco de Horas`,42,27,7,"F1","0.45 0.49 0.57"),text(`Página ${index+1} de ${pages.length}`,493,27,7,"F1","0.45 0.49 0.57"));
    const stream=commands.join("\n");
    objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[regularFontId]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[boldFontId]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  let pdf="%PDF-1.4\n%âãÏÓ\n"; const offsets=[0];
  for (let id=1;id<objects.length;id++) { offsets[id]=pdf.length; pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref=pdf.length; pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id=1;id<objects.length;id++) pdf+=`${String(offsets[id]).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array([...pdf].map((character)=>character.charCodeAt(0)&255));
}

$("#export-pdf").addEventListener("click",()=>downloadFile(buildPdf(),`relatorio-horas-${$("#month-filter").value}.pdf`,"application/pdf"));

function downloadFile(content, filename, type) {
  const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob([content],{type})); link.download=filename; link.click(); URL.revokeObjectURL(link.href);
}

$("#export-json").addEventListener("click",()=>{
  const backup={
    versao:1,
    exportadoEm:new Date().toISOString(),
    configuracoes:{ metaDiariaMinutos:settings.target, intervaloPadraoMinutos:settings.break, tema:settings.theme },
    registros:records.map((record)=>({ id:record.id, data:record.date, tipo:record.type, entrada:record.start, saida:record.end, intervaloMinutos:record.break }))
  };
  downloadFile(JSON.stringify(backup,null,2),`backup-horas-${localDate()}.json`,"application/json;charset=utf-8");
});

$("#import-json").addEventListener("click",()=>$("#json-file").click());
$("#json-file").addEventListener("change",async(event)=>{
  const file=event.target.files[0]; if (!file) return;
  try {
    const backup=JSON.parse(await file.text());
    const config=backup.configuracoes;
    if (backup.versao!==1 || !config || !Array.isArray(backup.registros)) throw new Error("estrutura inválida");
    if (!Number.isInteger(config.metaDiariaMinutos) || config.metaDiariaMinutos<=0 || !Number.isInteger(config.intervaloPadraoMinutos) || config.intervaloPadraoMinutos<0) throw new Error("configuração inválida");
    const imported=backup.registros.map((item)=>{
      if (!/^[A-Za-z0-9-]+$/.test(String(item.id)) || !/^\d{4}-\d{2}-\d{2}$/.test(item.data) || Number.isNaN(Date.parse(`${item.data}T12:00:00`)) || !TYPES[item.tipo]) throw new Error("registro inválido");
      if (item.tipo==="trabalho" && (!/^\d{2}:\d{2}$/.test(item.entrada) || !/^\d{2}:\d{2}$/.test(item.saida) || !Number.isFinite(Number(item.intervaloMinutos)))) throw new Error("jornada inválida");
      return { id:String(item.id), date:item.data, type:item.tipo, start:item.entrada || "", end:item.saida || "", break:Number(item.intervaloMinutos) || 0 };
    });
    if (new Set(imported.map((item)=>item.id)).size!==imported.length || new Set(imported.map((item)=>item.date)).size!==imported.length) throw new Error("registros duplicados");
    if (!confirm(`Restaurar ${imported.length} registro(s)? Os dados atuais serão substituídos.`)) return;
    records=imported; settings={ target:config.metaDiariaMinutos, break:config.intervaloPadraoMinutos, theme:config.tema==="dark" ? "dark" : "light" };
    localStorage.setItem(STORAGE_KEY,JSON.stringify(records)); localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
    $("#daily-target").value=toClock(settings.target); $("#default-break").value=settings.break; applyTheme(); resetForm(); render();
    alert("Backup restaurado com sucesso.");
  } catch (error) { alert("Não foi possível importar: o arquivo não é um backup válido."); }
  finally { event.target.value=""; }
});

$("#work-date").value=localDate(); $("#month-filter").value=localDate().slice(0,7); $("#daily-target").value=toClock(settings.target);
$("#default-break").value=settings.break; $("#break-time").value=settings.break; applyTheme(); updateForecast(); render();
