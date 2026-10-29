// Salvar/editar/excluir registros, configurações, filtros, apagar tudo e tema.
form.addEventListener("submit", async (event) => {
  event.preventDefault(); const type=$("#day-type").value;
  const record={ id:$("#editing-id").value || crypto.randomUUID(), date:$("#work-date").value, type, start:type==="trabalho" ? normalizeClock($("#start-time").value) : "", end:type==="trabalho" ? normalizeClock($("#end-time").value) : "", break:type==="trabalho" ? Number($("#break-time").value) : 0, photos:{...pendingPhotos} };
  const submit=event.submitter || $("#submit-button"), originalText=submit.textContent;
  submit.disabled=true; submit.textContent="Salvando...";
  try {
    if (type==="trabalho" && (!record.start || !record.end)) throw new Error("Informe horários válidos entre 00:00 e 23:59.");
    const original=records.find((item)=>item.id===record.id);
    if (original?.importData?.source==="forponto") {
      const unchanged=["date","type","start","end","break"].every((key)=>original[key]===record[key]);
      if (unchanged) record.importData=original.importData;
      else {
        if (!await requestConfirmation("Alterar este registro removerá as marcações e o saldo oficial importados do Forponto. Continuar?")) return;
        record.importData={};
      }
    }
    const result=await useCases.saveRecord(record,targetFor,records);
    records=result.records;
    const savedCycle=HoursCycle.monthForDate(record.date);
    if (!historyRange && savedCycle && $("#month-filter").value!==savedCycle) {
      $("#month-filter").value=savedCycle;
      loadManualBalance();
    }
    resetForm(); render(); showToast(result.editing ? "Registro atualizado com sucesso." : "Jornada registrada com sucesso.");
  } catch (error) {
    captureError(error,"record-save");
    const message=error instanceof Error ? error.message : "Não há espaço suficiente no navegador para salvar esta foto. Tente remover fotos antigas.";
    showError(message);
  } finally { submit.disabled=false; if (submit.isConnected) submit.textContent=$("#editing-id").value ? originalText : "Adicionar registro"; }
});

function editRecord(id) {
  setEntryCollapsed(false);
  const record=records.find((item)=>item.id===id); if (!record) return;
  $("#editing-id").value=record.id; $("#work-date").value=record.date; $("#day-type").value=record.type;
  if (record.start) $("#start-time").value=record.start; if (record.end) $("#end-time").value=record.end; $("#break-time").value=record.break;
  pendingPhotos={...recordPhotos(record)}; updatePhotoPreview(); $("#form-title").textContent="Editar jornada"; $("#submit-button").textContent="Salvar alteração"; $("#cancel-edit").hidden=false; updateForecast(); scrollTo({top:0,behavior:"smooth"});
}
async function showRecordPhoto(id,kind) {
  const record=records.find((item)=>item.id===id);
  const photo=record ? recordPhotos(record)[kind] : "";
  if (!photo) return;
  const generation=applicationGeneration;
  try {
    const url=/^(?:blob:|data:image\/)/.test(photo) ? photo : await repository.loadPhoto(id,kind);
    if (generation!==applicationGeneration || !url) return;
    $("#photo-dialog-title").textContent=`Foto de ${kind}`;
    $("#photo-dialog-image").src=url;
    $("#photo-dialog").showModal();
  } catch (error) { captureError(error,"photo-load"); showToast("Não foi possível carregar esta foto. Tente novamente.","error"); }
}
$("#records-body").addEventListener("click", async(event) => {
  const target=event.target.closest("button"); if (!target) return; const edit=target.dataset.edit, remove=target.dataset.delete, photo=target.dataset.photo; if (edit) editRecord(edit);
  if (photo) await showRecordPhoto(photo,target.dataset.photoKind);
  if (remove) scheduleRecordDeletion(remove);
});
$("#photo-gallery").addEventListener("click",(event)=>{ const card=event.target.closest("[data-view-photo]"); if (card) void showRecordPhoto(card.dataset.viewPhoto,card.dataset.photoKind); });

$("#settings-toggle").addEventListener("click",()=>$("#settings-form").hidden=!$("#settings-form").hidden);
function fillSettingsForm() {
  $("#daily-target").value=toClock(settings.target);
  $("#default-break").value=settings.break;
  for (let day=0; day<7; day++) $(`#target-dow-${day}`).value=settings.weekdayTargets?.[day] ? toClock(settings.weekdayTargets[day]) : "";
}
$("#settings-form").addEventListener("submit",async (event)=>{
  event.preventDefault(); const submit=event.submitter; submit.disabled=true;
  try {
    const target=normalizeClock($("#daily-target").value);
    if (!target) throw new Error("Informe uma meta válida, como 8 ou 08:48.");
    const breakMinutes=Number($("#default-break").value);
    if (!Number.isInteger(breakMinutes) || breakMinutes<0 || breakMinutes>600) throw new Error("O intervalo padrão deve estar entre 0 e 600 minutos.");
    const weekdayTargets={};
    for (let day=0; day<7; day++) {
      const raw=$(`#target-dow-${day}`).value.trim(); if (!raw) continue;
      const value=normalizeClock(raw);
      if (!value) throw new Error("Meta inválida para "+WEEKDAY_NAMES[day]+". Use 8 ou 08:48.");
      weekdayTargets[day]=toMinutes(value);
    }
    settings=await saveSettingsQueued({ ...settings, target:toMinutes(target), break:breakMinutes, weekdayTargets });
    fillSettingsForm(); $("#settings-form").hidden=true; resetForm(); render(); showToast("Configuração salva.");
  }
  catch (error) { captureError(error,"settings-save"); showToast(error.message || "Não foi possível salvar a configuração.","error"); }
  finally { submit.disabled=false; }
});
for (let day=0; day<7; day++) {
  const input=$(`#target-dow-${day}`);
  input.addEventListener("blur",()=>{ const formatted=normalizeClock(input.value); if (formatted) { input.value=formatted; input.setCustomValidity(""); } else if (input.value.trim()) { input.setCustomValidity("Digite um horário válido, como 8 ou 08:30."); showToast(input.validationMessage,"error"); } });
  input.addEventListener("input",()=>input.setCustomValidity(""));
}
$("#day-type").addEventListener("change",updateForecast); $("#work-date").addEventListener("change",updateForecast); $("#start-time").addEventListener("input",updateForecast); $("#break-time").addEventListener("input",updateForecast);
$("#month-filter").addEventListener("change",()=>{ clearHistoryRange(); loadManualBalance(); render(); }); $("#cancel-edit").addEventListener("click",resetForm);
$("#history-range-form").addEventListener("submit",(event)=>{
  event.preventDefault();
  const from=$("#history-date-from").value, to=$("#history-date-to").value;
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) {
    $("#history-range-message").textContent="Informe as datas inicial e final.";
    $("#history-range-message").classList.add("history-range__message--error");
    return;
  }
  if (from>to) {
    $("#history-range-message").textContent="A data inicial não pode ser posterior à data final.";
    $("#history-range-message").classList.add("history-range__message--error");
    return;
  }
  historyRange={ from,to };
  $("#history-range-message").classList.remove("history-range__message--error");
  $("#history-range-message").textContent="Exibindo e calculando os registros de "+historyPeriodLabel()+". Os ajustes manuais continuam vinculados ao mês selecionado.";
  render();
});
$("#history-range-clear").addEventListener("click",()=>{
  clearHistoryRange();
  render();
});
for (const input of [$("#manual-positive"),$("#manual-negative")]) {
  input.addEventListener("input",()=>{
    input.setCustomValidity("");
    saveManualSimulationLocally();
    updateManualBalance(HoursCalculator.summarize(filteredRecords(),targetFor).balance);
    const month=$("#month-filter").value;
    clearTimeout(manualBalanceSaveTimers.get(month));
    const positive=$("#manual-positive").value, negative=$("#manual-negative").value;
    manualBalanceVersions.set(month,(manualBalanceVersions.get(month) || 0)+1);
    appStorage.setItem(pendingBalanceKey(month),JSON.stringify({ positive,negative }));
    renderManualSyncStatus("pending");
    manualBalanceSaveTimers.set(month,setTimeout(()=>{
      manualBalanceSaveTimers.delete(month);
      void syncManualBalance(month,positive,negative);
    },700));
  });
  input.addEventListener("blur",()=>{ if (!input.value.trim()) return; const formatted=formatDuration(input.value); if (formatted===null) { input.setCustomValidity("Digite horas inteiras ou horas:minutos, como 1 ou 1:30."); showToast(input.validationMessage,"error"); return; } input.value=formatted; input.setCustomValidity(""); input.dispatchEvent(new Event("input",{ bubbles:true })); });
}
$("#manual-sync-retry").addEventListener("click",()=>{
  const month=$("#month-filter").value, pending=pendingBalance(month);
  if (!pending) return;
  clearTimeout(manualBalanceSaveTimers.get(month));
  manualBalanceSaveTimers.delete(month);
  void syncManualBalance(month,pending.positive,pending.negative);
});
let clearingRecords=false;
$("#clear-records").addEventListener("click",()=>{
  if (!records.length) return;
  $("#clear-records-message").textContent="Serão apagados "+records.length+" registro(s) de todos os meses e as fotos vinculadas. O tema, a meta diária e os saldos manuais serão mantidos. Esta ação não pode ser desfeita; baixe um backup antes se quiser conservar os dados.";
  $("#clear-records-confirmation").value="";
  $("#clear-records-accept").disabled=true;
  $("#clear-records-dialog").showModal();
  $("#clear-records-confirmation").focus();
});
$("#clear-records-confirmation").addEventListener("input",()=>{
  $("#clear-records-accept").disabled=$("#clear-records-confirmation").value.trim()!=="APAGAR";
});
$("#clear-records-cancel").addEventListener("click",()=>$("#clear-records-dialog").close());
$("#clear-records-dialog").addEventListener("cancel",(event)=>{ if (clearingRecords) event.preventDefault(); });
$("#clear-records-form").addEventListener("submit",async(event)=>{
  event.preventDefault();
  if (clearingRecords || $("#clear-records-confirmation").value.trim()!=="APAGAR" || !records.length || !useCases) return;
  clearingRecords=true;
  const generation=applicationGeneration;
  const accept=$("#clear-records-accept"), cancel=$("#clear-records-cancel");
  accept.disabled=true; cancel.disabled=true; accept.textContent="Apagando...";
  try {
    const result=await useCases.deleteAllRecords();
    if (generation!==applicationGeneration) return;
    records=result.records;
    $("#clear-records-dialog").close();
    resetForm();
    render();
    if (result.photoCleanupFailed) showToast("Registros apagados, mas "+result.photoCleanupFailed+" foto(s) não puderam ser removidas do armazenamento.","error");
    else showToast("Todos os registros e fotos vinculadas foram apagados.");
  } catch (error) {
    captureError(error,"records-delete-all");
    if (generation===applicationGeneration) showToast("Não foi possível apagar os registros: "+(error.message || "tente novamente."),"error");
  } finally {
    clearingRecords=false; cancel.disabled=false; accept.textContent="Apagar registros";
    accept.disabled=$("#clear-records-confirmation").value.trim()!=="APAGAR";
  }
});
for (const input of [$("#simulator-start-time"),$("#simulator-end-time")]) input.addEventListener("input",()=>{ saveManualSimulationLocally(); updateManualBalance(HoursCalculator.summarize(filteredRecords(),targetFor).balance); });
for (const input of [$("#daily-target"),$("#start-time"),$("#end-time"),$("#simulator-start-time"),$("#simulator-end-time")]) {
  input.addEventListener("blur",()=>{ const formatted=normalizeClock(input.value); if (!formatted) { if (input.value.trim()) { input.setCustomValidity("Digite um horário válido, como 8, 830 ou 08:30."); showToast(input.validationMessage,"error"); } return; } input.value=formatted; input.setCustomValidity(""); input.dispatchEvent(new Event("input",{ bubbles:true })); });
  input.addEventListener("input",()=>input.setCustomValidity(""));
}
form.addEventListener("reset",()=>setTimeout(()=>{
  $("#editing-id").value=""; $("#work-date").value=localDate(); $("#break-time").value=settings.break;
  $("#form-title").textContent="Registrar jornada"; $("#submit-button").textContent="Adicionar registro";
  $("#cancel-edit").hidden=true; $("#error-message").hidden=true; pendingPhotos={entrada:"",saida:""}; capturedPhoto=""; updatePhotoPreview(); updateForecast();
}));

function applyTheme() { document.documentElement.dataset.theme=settings.theme; appStorage.setItem(THEME_PREFERENCE_KEY,settings.theme); document.querySelector('meta[name="theme-color"]').content=settings.theme==="dark" ? "#0d1321" : "#3157d5"; }
$("#theme-toggle").addEventListener("click",async ()=>{
  const theme=settings.theme==="dark" ? "light" : "dark";
  $("#theme-toggle").disabled=true;
  settings={ ...settings, theme };
  applyTheme();
  try {
    if (useCases) settings=await saveSettingsQueued(settings);
  } catch (error) { captureError(error,"theme-sync"); showToast("Tema salvo neste dispositivo; a sincronização com sua conta falhou.","error"); }
  finally { $("#theme-toggle").disabled=false; }
});
$("#empty-state-add").addEventListener("click",()=>focusNewRecord());

const ENTRY_COLLAPSED_KEY="controle-horas-form-recolhido-v1";
function setEntryCollapsed(collapsed) {
  $("#hours-form").hidden=collapsed;
  if (collapsed) $("#settings-form").hidden=true;
  $("#entry-toggle").setAttribute("aria-expanded",String(!collapsed));
  $("#entry-toggle").setAttribute("aria-label",collapsed ? "Expandir formulário" : "Recolher formulário");
  appStorage.setItem(ENTRY_COLLAPSED_KEY,collapsed ? "1" : "0");
}
function focusNewRecord() {
  setEntryCollapsed(false);
  $("#work-date").scrollIntoView({ block:"center", behavior:"smooth" });
  $("#work-date").focus({ preventScroll:true });
}
if (appStorage.getItem(ENTRY_COLLAPSED_KEY)==="1") setEntryCollapsed(true);
$("#entry-toggle").addEventListener("click",()=>setEntryCollapsed(!$("#hours-form").hidden));
$("#fab-add").addEventListener("click",focusNewRecord);
if ("IntersectionObserver" in window) new IntersectionObserver(([entry])=>{ $("#fab-add").hidden=entry.isIntersecting; }).observe($(".entry-panel"));
else $("#fab-add").hidden=false;

const UNDO_WINDOW_MS=6000;
const pendingDeletions=new Map();
function scheduleRecordDeletion(id) {
  const record=records.find((item)=>item.id===id); if (!record) return;
  records=records.filter((item)=>item.id!==id); render();
  const timer=setTimeout(()=>{ void commitRecordDeletion(id); },UNDO_WINDOW_MS);
  pendingDeletions.set(id,{ record,timer,generation:applicationGeneration,useCases });
  showToast("Registro de "+pt(record.date)+" excluído.","success",{ actionLabel:"Desfazer",duration:UNDO_WINDOW_MS,onAction:()=>undoRecordDeletion(id) });
}
async function commitRecordDeletion(id) {
  const entry=pendingDeletions.get(id); if (!entry) return;
  pendingDeletions.delete(id); clearTimeout(entry.timer);
  try { await entry.useCases.deleteRecord(id,[]); }
  catch (error) {
    captureError(error,"record-delete");
    if (entry.generation===applicationGeneration) { records=[...records,entry.record]; render(); showToast(error.message || "Não foi possível excluir o registro; ele foi restaurado.","error"); }
  }
}
function undoRecordDeletion(id) {
  const entry=pendingDeletions.get(id); if (!entry) return;
  if (records.some((item)=>item.date===entry.record.date)) { showToast("Já existe um registro nesta data; a exclusão foi mantida.","error"); void commitRecordDeletion(id); return; }
  clearTimeout(entry.timer); pendingDeletions.delete(id);
  records=[...records,entry.record]; render(); showToast("Registro restaurado.");
}
async function flushPendingDeletions() { await Promise.all([...pendingDeletions.keys()].map(commitRecordDeletion)); }
document.addEventListener("visibilitychange",()=>{ if (document.hidden) void flushPendingDeletions(); });

function currentClock() { const now=new Date(); return String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0"); }
$("#clock-in-now").addEventListener("click",()=>{
  setEntryCollapsed(false); resetForm();
  setTimeout(()=>{
    const start=currentClock();
    $("#day-type").value="trabalho"; $("#work-date").value=localDate(); $("#start-time").value=start;
    $("#end-time").value=suggestedExit(start,Number($("#break-time").value)).suggestedExit;
    updateForecast(); $("#submit-button").focus();
    showToast("Entrada às "+start+" preenchida com a saída sugerida. Confira e adicione o registro.");
  },0);
});
$("#clock-out-now").addEventListener("click",()=>{
  const today=localDate(), existing=records.find((item)=>item.date===today && item.type==="trabalho");
  if (existing) editRecord(existing.id); else { setEntryCollapsed(false); resetForm(); }
  setTimeout(()=>{
    const end=currentClock();
    $("#day-type").value="trabalho"; $("#work-date").value=today; $("#end-time").value=end;
    updateForecast(); $("#submit-button").focus();
    showToast("Saída às "+end+" preenchida. Confira e salve o registro.");
  },0);
});
