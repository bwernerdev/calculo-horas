const STORAGE_KEY = "controle-horas-registros-v1";
const SETTINGS_KEY = "controle-horas-config-v1";
const THEME_PREFERENCE_KEY = "controle-horas-tema-v1";
const TYPES = { trabalho:"Trabalho", folga:"Folga", feriado:"Feriado", ferias:"Férias", falta:"Falta" };
const $ = (selector) => document.querySelector(selector);
const form = $("#hours-form");
const { toMinutes, toClock, duration, signed } = HoursCalculator;
const FIXED_BREAK_MINUTES = 60;
const MAX_DAILY_WORK_MINUTES = 10 * 60;
const SUGGESTED_DAILY_LIMIT_MINUTES = 9 * 60 + 45;
const authLinkType = new URLSearchParams(window.location.hash.slice(1)).get("type") || new URLSearchParams(window.location.search).get("type");
let requiresPasswordSetup = authLinkType === "invite" || authLinkType === "recovery";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const turnstileWidgetIds = { login: null, signup: null, recovery: null };
const captchaTokens = { login: "", signup: "", recovery: "" };
let turnstileScriptPromise = null;
let repository;
let useCases;
let records = [];
let settings = { target: 528, break: FIXED_BREAK_MINUTES, theme: localStorage.getItem(THEME_PREFERENCE_KEY) === "dark" ? "dark" : "light" };
let pendingPhotos = { entrada:"", saida:"" };
let capturedPhoto = "";
let cameraStream;

function localDate(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date - offset).toISOString().slice(0,10); }
function escapeCell(value) { const text = String(value ?? ""); return /[";,\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }

function calculate(record) { return HoursCalculator.calculate(record,settings.target); }
function recordPhotos(record) { return record.photos || { entrada:record.photo || "", saida:"" }; }

function updateForecast() {
  const visible = $("#day-type").value === "trabalho";
  document.querySelectorAll(".work-field").forEach((field) => field.hidden = !visible);
  $("#exit-forecast").hidden = !visible;
  if (!visible || !$("#start-time").value) return;
  const date=$("#work-date").value, month=date.slice(0,7), editingId=$("#editing-id").value;
  const monthRecords=records.filter((record)=>record.date.startsWith(month) && record.id!==editingId);
  const currentBalance=HoursCalculator.summarize(monthRecords,settings.target).balance;
  const suggestion=HoursCalculator.suggestExit($("#start-time").value,settings.target,FIXED_BREAK_MINUTES,currentBalance,SUGGESTED_DAILY_LIMIT_MINUTES);
  const balanceClass=currentBalance>0 ? "value-positive" : currentBalance<0 ? "value-negative" : "";
  const pending=suggestion.worked===SUGGESTED_DAILY_LIMIT_MINUTES && suggestion.remainingBalance<0 ? `<span class="forecast__warning"><b>Margem preventiva de 15 min aplicada</b> antes do limite de 10h. Saldo restante: <b>${signed(suggestion.remainingBalance)}</b></span>` : "";
  $("#exit-forecast").innerHTML = `<span>Saída-base: <b>${suggestion.baseExit}</b></span><span>Saldo atual: <b class="${balanceClass}">${signed(currentBalance)}</b></span><strong>Saída sugerida: ${suggestion.suggestedExit}</strong>${pending}`;
}

function filteredRecords() { return records.filter((record) => record.date.startsWith($("#month-filter").value)).sort((a,b) => b.date.localeCompare(a.date)); }
function render() {
  const list = filteredRecords();
  $("#records-body").innerHTML = list.map((record) => {
    const calc = calculate(record); const css = calc.balance > 0 ? "value-positive" : calc.balance < 0 ? "value-negative" : "";
    const date = new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR");
    const photos=recordPhotos(record);
    const photoButtons=[photos.entrada ? `<button class="table-action" data-photo="${record.id}" data-photo-kind="entrada">Entrada</button>` : "",photos.saida ? `<button class="table-action" data-photo="${record.id}" data-photo-kind="saida">Saída</button>` : ""].filter(Boolean).join(" ");
    return `<tr><td>${date}</td><td><span class="tag">${TYPES[record.type]}</span></td><td>${record.start || "—"}</td><td>${record.end || "—"}</td><td>${record.type === "trabalho" ? `${record.break} min` : "—"}</td><td>${duration(calc.worked)}</td><td class="${css}">${signed(calc.balance)}</td><td>${photoButtons} <button class="table-action" data-edit="${record.id}">Editar</button> <button class="table-action table-action--delete" data-delete="${record.id}">Excluir</button></td></tr>`;
  }).join("");
  $("#empty-state").hidden = list.length > 0;
  const photos=list.flatMap((record)=>Object.entries(recordPhotos(record)).filter(([,photo])=>photo).map(([kind,photo])=>({record,kind,photo})));
  $("#photo-history").hidden=photos.length===0; $("#photo-count").textContent=`${photos.length} ${photos.length===1 ? "foto" : "fotos"}`;
  $("#photo-gallery").innerHTML=photos.map(({record,kind,photo})=>{
    const date=new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR");
    return `<button class="photo-card" type="button" data-view-photo="${record.id}" data-photo-kind="${kind}" aria-label="Ver foto de ${kind} de ${date}"><img src="${photo}" alt="" loading="lazy"><span class="photo-card__info"><strong>${date}</strong><small>${kind === "entrada" ? "Entrada" : "Saída"} · ${TYPES[record.type]}</small></span></button>`;
  }).join("");
  const totals = HoursCalculator.summarize(list,settings.target);
  $("#monthly-worked").textContent = duration(totals.worked); $("#monthly-balance").textContent = signed(totals.balance);
  $("#monthly-positive").textContent = `+${duration(totals.positive)}`;
  $("#monthly-negative").textContent = `-${duration(totals.negative)}`;
  $("#monthly-balance").className = totals.balance > 0 ? "value-positive" : totals.balance < 0 ? "value-negative" : "";
  $("#registered-days").textContent = list.length; $("#target-summary").textContent = duration(settings.target);
  updateForecast();
}

function resetForm() {
  form.reset(); $("#editing-id").value=""; $("#work-date").value=localDate(); $("#break-time").value=FIXED_BREAK_MINUTES;
  $("#form-title").textContent="Registrar jornada"; $("#submit-button").textContent="Adicionar registro";
  $("#cancel-edit").hidden=true; $("#error-message").hidden=true; pendingPhotos={entrada:"",saida:""}; capturedPhoto=""; updatePhotoPreview(); updateForecast();
}
function showError(message) { $("#error-message").textContent=message; $("#error-message").hidden=false; }
function showToast(message,type="success") {
  const toast=document.createElement("div"); toast.className=`toast toast--${type}`; toast.textContent=message;
  $("#toast-region").append(toast); setTimeout(()=>toast.remove(),4000);
}
function requestConfirmation(message) {
  const dialog=$("#confirm-dialog"), accept=$("#confirm-accept"), cancel=$("#confirm-cancel");
  $("#confirm-message").textContent=message; dialog.showModal();
  return new Promise((resolve)=>{
    const finish=(answer)=>{ accept.removeEventListener("click",onAccept); cancel.removeEventListener("click",onCancel); dialog.removeEventListener("cancel",onCancel); dialog.close(); resolve(answer); };
    const onAccept=()=>finish(true), onCancel=(event)=>{ event.preventDefault(); finish(false); };
    accept.addEventListener("click",onAccept); cancel.addEventListener("click",onCancel); dialog.addEventListener("cancel",onCancel);
  });
}
function updatePhotoPreview() {
  $("#photo-preview").hidden=!pendingPhotos.entrada && !pendingPhotos.saida;
  for (const kind of ["entrada","saida"]) {
    $(`#${kind === "entrada" ? "entry" : "exit"}-photo-preview`).hidden=!pendingPhotos[kind];
    $(`#${kind === "entrada" ? "entry" : "exit"}-photo-image`).src=pendingPhotos[kind] || "";
  }
}
function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach((track)=>track.stop());
  cameraStream=undefined; $("#camera-preview").srcObject=null;
}
$("#open-camera").addEventListener("click",async()=>{
  if (!navigator.mediaDevices?.getUserMedia) return showToast("A câmera interna não é suportada neste navegador.","error");
  try {
    cameraStream=await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" } }, audio:false });
    $("#camera-preview").srcObject=cameraStream; $("#camera-dialog").showModal(); await $("#camera-preview").play();
  } catch (error) { stopCamera(); showToast("Não foi possível acessar a câmera. Verifique a permissão do aplicativo.","error"); }
});
$("#capture-photo").addEventListener("click",()=>{
  const video=$("#camera-preview");
  if (!video.videoWidth || !video.videoHeight) return showToast("A câmera ainda está carregando. Tente novamente.","error");
  const maxSize=720, scale=Math.min(1,maxSize/Math.max(video.videoWidth,video.videoHeight));
  const canvas=document.createElement("canvas"); canvas.width=Math.round(video.videoWidth*scale); canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height); capturedPhoto=canvas.toDataURL("image/jpeg",0.65);
  stopCamera(); $("#camera-dialog").close(); $("#photo-type-dialog").showModal();
});
function closeCamera() { stopCamera(); if ($("#camera-dialog").open) $("#camera-dialog").close(); }
$("#camera-close").addEventListener("click",closeCamera);
$("#camera-dialog").addEventListener("cancel",(event)=>{ event.preventDefault(); closeCamera(); });
document.addEventListener("visibilitychange",()=>{ if (document.hidden && cameraStream) closeCamera(); });
document.querySelectorAll("[data-photo-type]").forEach((button)=>button.addEventListener("click",()=>{
  const kind=button.dataset.photoType; pendingPhotos[kind]=capturedPhoto; capturedPhoto=""; $("#photo-type-dialog").close(); updatePhotoPreview(); showToast(`Foto de ${kind} anexada.`);
}));
function cancelPhotoType() { capturedPhoto=""; $("#photo-type-dialog").close(); }
$("#photo-type-cancel").addEventListener("click",cancelPhotoType);
$("#photo-type-dialog").addEventListener("cancel",(event)=>{ event.preventDefault(); cancelPhotoType(); });
$("#photo-preview").addEventListener("click",(event)=>{ const kind=event.target.dataset.removePhoto; if (kind) { pendingPhotos[kind]=""; updatePhotoPreview(); showToast(`Foto de ${kind} removida.`); } });
$("#photo-dialog-close").addEventListener("click",()=>$("#photo-dialog").close());
$("#photo-dialog").addEventListener("close",()=>$("#photo-dialog-image").removeAttribute("src"));

form.addEventListener("submit", async (event) => {
  event.preventDefault(); const type=$("#day-type").value;
  const record={ id:$("#editing-id").value || crypto.randomUUID(), date:$("#work-date").value, type, start:type==="trabalho" ? $("#start-time").value : "", end:type==="trabalho" ? $("#end-time").value : "", break:type==="trabalho" ? FIXED_BREAK_MINUTES : 0, photos:{...pendingPhotos} };
  try {
    const result=await useCases.saveRecord(record,settings.target);
    records=result.records;
    resetForm(); render(); showToast(result.editing ? "Registro atualizado com sucesso." : "Jornada registrada com sucesso.");
  } catch (error) {
    const message=error instanceof Error ? error.message : "Não há espaço suficiente no navegador para salvar esta foto. Tente remover fotos antigas.";
    showError(message);
  }
});

function editRecord(id) {
  const record=records.find((item)=>item.id===id); if (!record) return;
  $("#editing-id").value=record.id; $("#work-date").value=record.date; $("#day-type").value=record.type;
  if (record.start) $("#start-time").value=record.start; if (record.end) $("#end-time").value=record.end; $("#break-time").value=FIXED_BREAK_MINUTES;
  pendingPhotos={...recordPhotos(record)}; updatePhotoPreview(); $("#form-title").textContent="Editar jornada"; $("#submit-button").textContent="Salvar alteração"; $("#cancel-edit").hidden=false; updateForecast(); scrollTo({top:0,behavior:"smooth"});
}
function showRecordPhoto(id,kind) {
  const record=records.find((item)=>item.id===id);
  const photo=record ? recordPhotos(record)[kind] : "";
  if (photo) { $("#photo-dialog-title").textContent=`Foto de ${kind}`; $("#photo-dialog-image").src=photo; $("#photo-dialog").showModal(); }
}
$("#records-body").addEventListener("click", async(event) => {
  const edit=event.target.dataset.edit, remove=event.target.dataset.delete, photo=event.target.dataset.photo; if (edit) editRecord(edit);
  if (photo) showRecordPhoto(photo,event.target.dataset.photoKind);
  if (remove && await requestConfirmation("Deseja excluir este registro? Essa ação não poderá ser desfeita.")) { records=await useCases.deleteRecord(remove); render(); showToast("Registro excluído."); }
});
$("#photo-gallery").addEventListener("click",(event)=>{ const card=event.target.closest("[data-view-photo]"); if (card) showRecordPhoto(card.dataset.viewPhoto,card.dataset.photoKind); });

$("#settings-toggle").addEventListener("click",()=>$("#settings-form").hidden=!$("#settings-form").hidden);
$("#settings-form").addEventListener("submit",async (event)=>{ event.preventDefault(); settings=await useCases.saveSettings({ ...settings, target:toMinutes($("#daily-target").value) }); $("#settings-form").hidden=true; resetForm(); render(); });
$("#day-type").addEventListener("change",updateForecast); $("#work-date").addEventListener("change",updateForecast); $("#start-time").addEventListener("input",updateForecast); $("#break-time").addEventListener("input",updateForecast);
$("#month-filter").addEventListener("change",render); $("#cancel-edit").addEventListener("click",resetForm);
form.addEventListener("reset",()=>setTimeout(()=>{
  $("#editing-id").value=""; $("#work-date").value=localDate(); $("#break-time").value=FIXED_BREAK_MINUTES;
  $("#form-title").textContent="Registrar jornada"; $("#submit-button").textContent="Adicionar registro";
  $("#cancel-edit").hidden=true; $("#error-message").hidden=true; pendingPhotos={entrada:"",saida:""}; capturedPhoto=""; updatePhotoPreview(); updateForecast();
}));

function applyTheme() { document.documentElement.dataset.theme=settings.theme; localStorage.setItem(THEME_PREFERENCE_KEY,settings.theme); $("#theme-toggle").textContent=settings.theme==="dark" ? "☀️" : "🌙"; document.querySelector('meta[name="theme-color"]').content=settings.theme==="dark" ? "#0d1321" : "#3157d5"; }
$("#theme-toggle").addEventListener("click",async ()=>{
  const theme=settings.theme==="dark" ? "light" : "dark";
  if (useCases) settings=await useCases.saveSettings({ ...settings, theme });
  else settings={ ...settings, theme };
  applyTheme();
});
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
  const totals=HoursCalculator.summarize(list,settings.target);
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
  const link=document.createElement("a"), url=URL.createObjectURL(new Blob([content],{type}));
  link.href=url; link.download=filename; link.hidden=true; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}

async function photoAsDataUrl(value) {
  if (!value || value.startsWith("data:image/")) return value || "";
  const response = await fetch(value); if (!response.ok) throw new Error("foto indisponível");
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}

$("#export-json").addEventListener("click",async (event)=>{
  const button = event.currentTarget; button.disabled = true; button.textContent = "Preparando backup...";
  try {
    const backupRecords = [];
    for (const record of records) {
      const photos = recordPhotos(record);
      backupRecords.push({ id:record.id, data:record.date, tipo:record.type, entrada:record.start, saida:record.end, intervaloMinutos:record.break, fotos:{ entrada:await photoAsDataUrl(photos.entrada), saida:await photoAsDataUrl(photos.saida) } });
    }
  const backup={
    versao:1,
    exportadoEm:new Date().toISOString(),
    configuracoes:{ metaDiariaMinutos:settings.target, intervaloPadraoMinutos:FIXED_BREAK_MINUTES, tema:settings.theme },
    registros:backupRecords
  };
  downloadFile(JSON.stringify(backup,null,2),`backup-horas-${localDate()}.json`,"application/json;charset=utf-8");
  } catch { showToast("Não foi possível incluir as fotos no backup.","error"); }
  finally { button.disabled = false; button.textContent = "Baixar backup"; }
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
      const photos=item.fotos || { entrada:item.foto || "", saida:"" };
      for (const kind of ["entrada","saida"]) if (photos[kind] && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photos[kind]) || photos[kind].length>1500000)) throw new Error("foto inválida");
      return { id:String(item.id), date:item.data, type:item.tipo, start:item.entrada || "", end:item.saida || "", break:Number(item.intervaloMinutos) || 0, photos:{ entrada:photos.entrada || "", saida:photos.saida || "" } };
    });
    if (new Set(imported.map((item)=>item.id)).size!==imported.length || new Set(imported.map((item)=>item.date)).size!==imported.length) throw new Error("registros duplicados");
    if (!await requestConfirmation(`Restaurar ${imported.length} registro(s)? Os dados atuais serão substituídos.`)) return;
    records=imported; settings=await useCases.saveSettings({ target:config.metaDiariaMinutos, theme:config.tema==="dark" ? "dark" : "light" });
    await repository.saveAllRecords(records);
    $("#daily-target").value=toClock(settings.target); applyTheme(); resetForm(); render();
    showToast("Backup restaurado com sucesso.");
  } catch (error) { showToast("Não foi possível importar: o arquivo não é um backup válido.","error"); }
  finally { event.target.value=""; }
});

function setAuthMessage(message, type = "error") {
  const element = $("#auth-message"); element.textContent = message; element.hidden = !message;
  element.className = type === "error" ? "error-message" : "auth-success";
}
function setSignupMessage(message, type = "error") {
  const element = $("#signup-message"); element.textContent = message; element.hidden = !message;
  element.className = type === "error" ? "error-message" : "auth-success";
}
function setRecoveryMessage(message, type = "error") {
  const element = $("#recovery-message"); element.textContent = message; element.hidden = !message;
  element.className = type === "error" ? "error-message" : "auth-success";
}
function translateAuthError(error) {
  const translations = {
    invalid_credentials: "E-mail ou senha incorretos.",
    email_not_confirmed: "Confirme seu e-mail antes de entrar.",
    user_already_exists: "Este e-mail já possui uma conta.",
    signup_disabled: "A criação de novas contas está desativada.",
    over_email_send_rate_limit: "Muitos e-mails foram solicitados. Aguarde alguns minutos.",
    weak_password: "A senha não atende aos requisitos de segurança.",
    same_password: "A nova senha deve ser diferente da senha atual.",
    captcha_failed: "Não foi possível validar a proteção contra robôs. Tente novamente."
  };
  return translations[error?.code] || translations[error?.message] || "Não foi possível concluir a operação. Tente novamente.";
}
function passwordRules(password) {
  return { length: password.length >= 8, uppercase: /[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(password), number: /\d/.test(password) };
}
function isStrongPassword(password) { return Object.values(passwordRules(password)).every(Boolean); }
function updatePasswordStrength(input, list) {
  const rules = passwordRules(input.value);
  Object.entries(rules).forEach(([rule, valid]) => list.querySelector(`[data-rule="${rule}"]`).classList.toggle("password-rule--valid", valid));
}
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true; script.onload = () => resolve(window.turnstile); script.onerror = () => reject(new Error("Turnstile indisponível"));
    document.head.append(script);
  });
  return turnstileScriptPromise;
}
function setCaptchaMessage(flow, message) {
  if (flow === "login") setAuthMessage(message);
  else if (flow === "signup") setSignupMessage(message);
  else setRecoveryMessage(message);
}
function resetTurnstile(flow) {
  if (turnstileWidgetIds[flow] !== null && window.turnstile) window.turnstile.reset(turnstileWidgetIds[flow]);
  captchaTokens[flow] = "";
}
async function renderTurnstile(flow) {
  if (!TURNSTILE_SITE_KEY || turnstileWidgetIds[flow] !== null) return;
  const container = $(`#${flow}-turnstile-container`); container.hidden = false; container.textContent = "Carregando validação contra robôs...";
  try {
    const turnstile = await loadTurnstileScript();
    const formId = flow === "login" ? "auth-form" : `${flow}-form`;
    if ($(`#${formId}`).hidden || turnstileWidgetIds[flow] !== null) return;
    container.textContent = "";
    turnstileWidgetIds[flow] = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: settings.theme,
      size: container.clientWidth < 300 ? "compact" : "flexible",
      appearance: "always",
      execution: "render",
      retry: "auto",
      "refresh-expired": "auto",
      callback: (token) => { captchaTokens[flow] = token; },
      "expired-callback": () => { captchaTokens[flow] = ""; },
      "error-callback": () => { captchaTokens[flow] = ""; setCaptchaMessage(flow, "Não foi possível carregar a validação contra robôs. Tente novamente."); }
    });
  } catch { container.textContent = "Validação indisponível."; setCaptchaMessage(flow, "Não foi possível carregar a validação contra robôs. Verifique sua conexão."); }
}
function selectAuthTab(tab) {
  const signup = tab === "signup";
  $("#auth-form").hidden = signup; $("#signup-form").hidden = !signup; $("#recovery-form").hidden = true;
  $("#login-tab").classList.toggle("auth-tab--active", !signup);
  $("#signup-tab").classList.toggle("auth-tab--active", signup);
  $("#login-tab").setAttribute("aria-selected", String(!signup));
  $("#signup-tab").setAttribute("aria-selected", String(signup));
  (signup ? $("#signup-email") : $("#auth-email")).focus();
  renderTurnstile(signup ? "signup" : "login");
}
function showAuthentication() {
  applyTheme(); $("#auth-screen").hidden = false; $("#password-setup-screen").hidden = true; $("#app-content").hidden = true; $("#logout-button").hidden = true;
  renderTurnstile("login");
}
function showPasswordSetup() {
  applyTheme(); $("#auth-screen").hidden = true; $("#password-setup-screen").hidden = false; $("#app-content").hidden = true; $("#logout-button").hidden = false;
}
async function loadApplication(user) {
  repository = HoursRepository.createSupabaseRepository(supabaseClient, user.id);
  useCases = HoursUseCases.createHoursUseCases({ calculator: HoursCalculator, repository, fixedBreakMinutes: FIXED_BREAK_MINUTES, maxDailyWorkMinutes: MAX_DAILY_WORK_MINUTES });
  try {
    [records, settings] = await Promise.all([repository.findAllRecords(), useCases.getSettings()]);
    $("#work-date").value=localDate(); $("#month-filter").value=localDate().slice(0,7); $("#daily-target").value=toClock(settings.target);
    $("#break-time").value=FIXED_BREAK_MINUTES; applyTheme(); updateForecast(); render();
    $("#auth-screen").hidden = true; $("#password-setup-screen").hidden = true; $("#app-content").hidden = false; $("#logout-button").hidden = false;
  } catch (error) { showAuthentication(); setAuthMessage(`Não foi possível carregar seus dados: ${error.message}`); }
}
async function restoreSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) showAuthentication();
  else if (requiresPasswordSetup) showPasswordSetup();
  else await loadApplication(session.user);
}
$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault(); setAuthMessage("");
  const email = $("#auth-email").value.trim(), password = $("#auth-password").value;
  if (TURNSTILE_SITE_KEY && !captchaTokens.login) { setAuthMessage("Confirme que você não é um robô."); return; }
  const options = captchaTokens.login ? { captchaToken: captchaTokens.login } : undefined;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password, options });
  resetTurnstile("login");
  if (error) setAuthMessage(translateAuthError(error));
});
$("#login-tab").addEventListener("click", () => selectAuthTab("login"));
$("#signup-tab").addEventListener("click", () => selectAuthTab("signup"));
$("#forgot-password-button").addEventListener("click", () => {
  $("#auth-form").hidden = true; $("#signup-form").hidden = true; $("#recovery-form").hidden = false;
  $("#recovery-email").value = $("#auth-email").value; $("#recovery-email").focus();
  renderTurnstile("recovery");
});
$("#recovery-back-button").addEventListener("click", () => selectAuthTab("login"));
$("#recovery-form").addEventListener("submit", async (event) => {
  event.preventDefault(); setRecoveryMessage("");
  const email = $("#recovery-email").value.trim();
  if (TURNSTILE_SITE_KEY && !captchaTokens.recovery) { setRecoveryMessage("Confirme que você não é um robô."); return; }
  const submit = event.submitter; submit.disabled = true; submit.textContent = "Enviando...";
  const options = { redirectTo: `${window.location.origin}${window.location.pathname}` };
  if (captchaTokens.recovery) options.captchaToken = captchaTokens.recovery;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, options);
  resetTurnstile("recovery");
  submit.disabled = false; submit.textContent = "Enviar link";
  setRecoveryMessage(error ? translateAuthError(error) : "Link enviado. Confira sua caixa de entrada e o spam.", error ? "error" : "success");
});
document.querySelectorAll("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => {
  const input = document.getElementById(button.dataset.togglePassword);
  const visible = input.type === "text"; input.type = visible ? "password" : "text";
  button.textContent = visible ? "Mostrar" : "Ocultar"; button.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
}));
$("#signup-password").addEventListener("input", () => updatePasswordStrength($("#signup-password"), $("#signup-password-strength")));
$("#new-password").addEventListener("input", () => updatePasswordStrength($("#new-password"), $("#setup-password-strength")));
$("#signup-form").addEventListener("submit", async (event) => {
  event.preventDefault(); setSignupMessage("");
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;
  const confirmation = $("#signup-password-confirmation").value;
  if (!email || !isStrongPassword(password)) {
    setSignupMessage("Use pelo menos 8 caracteres, uma letra maiúscula e um número.");
    return;
  }
  if (password !== confirmation) {
    setSignupMessage("As senhas não coincidem.");
    return;
  }
  if (TURNSTILE_SITE_KEY && !captchaTokens.signup) { setSignupMessage("Confirme que você não é um robô."); return; }
  const button = $("#signup-button");
  button.disabled = true; button.textContent = "Criando conta...";
  const options = { emailRedirectTo: `${window.location.origin}${window.location.pathname}` };
  if (captchaTokens.signup) options.captchaToken = captchaTokens.signup;
  const { data, error } = await supabaseClient.auth.signUp({ email, password, options });
  button.disabled = false; button.textContent = "Criar conta";
  resetTurnstile("signup");
  if (error) { setSignupMessage(translateAuthError(error)); return; }
  $("#resend-confirmation-button").hidden = Boolean(data.session);
  setSignupMessage(
    data.session ? "Conta criada com sucesso." : "Conta criada. Confira seu e-mail para confirmar o cadastro.",
    "success"
  );
});
$("#resend-confirmation-button").addEventListener("click", async () => {
  const email = $("#signup-email").value.trim();
  if (!email) { setSignupMessage("Informe o e-mail usado no cadastro."); return; }
  const button = $("#resend-confirmation-button"); button.disabled = true; button.textContent = "Reenviando...";
  const { error } = await supabaseClient.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } });
  button.disabled = false; button.textContent = "Reenviar confirmação";
  setSignupMessage(error ? translateAuthError(error) : "Confirmação reenviada. Confira também o spam.", error ? "error" : "success");
});
$("#password-setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("#password-setup-message");
  const password = $("#new-password").value;
  const confirmation = $("#confirm-password").value;
  message.hidden = true;
  if (!isStrongPassword(password)) {
    message.textContent = "Use pelo menos 8 caracteres, uma letra maiúscula e um número."; message.hidden = false; return;
  }
  if (password !== confirmation) {
    message.textContent = "As senhas não coincidem."; message.hidden = false; return;
  }
  const submit = event.submitter;
  submit.disabled = true; submit.textContent = "Salvando...";
  const { data, error } = await supabaseClient.auth.updateUser({ password });
  submit.disabled = false; submit.textContent = "Salvar senha e entrar";
  if (error) { message.textContent = translateAuthError(error); message.hidden = false; return; }
  requiresPasswordSetup = false;
  window.history.replaceState({}, document.title, window.location.pathname);
  await loadApplication(data.user);
  showToast("Senha definida com sucesso.");
});
$("#logout-button").addEventListener("click", async () => { await supabaseClient.auth.signOut(); showAuthentication(); });
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (!session) showAuthentication();
  else if (requiresPasswordSetup) showPasswordSetup();
  else loadApplication(session.user);
});
restoreSession();

let deferredInstallPrompt;
const installButton=$("#install-app");
const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone=window.matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;

window.addEventListener("beforeinstallprompt",(event)=>{
  event.preventDefault(); deferredInstallPrompt=event; installButton.hidden=false;
});
if (isIos && !isStandalone) installButton.hidden=false;

installButton.addEventListener("click",async()=>{
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt(); const choice=await deferredInstallPrompt.userChoice;
    if (choice.outcome==="accepted") showToast("Aplicativo instalado com sucesso.");
    deferredInstallPrompt=null; installButton.hidden=true;
  } else if (isIos) showToast("No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.");
});
window.addEventListener("appinstalled",()=>{ deferredInstallPrompt=null; installButton.hidden=true; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch((error)=>console.error("Falha ao ativar o modo offline:",error)));
}
