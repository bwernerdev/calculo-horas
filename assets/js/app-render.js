// Renderização do histórico/resumo, formulário, toasts e confirmação.
function render() {
  const list = filteredRecords();
  $("#records-body").innerHTML = list.map((record) => {
    const calc = calculate(record); const css = calc.balance > 0 ? "balance-pill--positive" : calc.balance < 0 ? "balance-pill--negative" : "";
    const date = new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR");
    const photos=recordPhotos(record);
    const photoButtons=[photos.entrada ? `<button class="table-action" data-photo="${record.id}" data-photo-kind="entrada"><svg class="icon" aria-hidden="true"><use href="#i-camera"/></svg>Entrada</button>` : "",photos.saida ? `<button class="table-action" data-photo="${record.id}" data-photo-kind="saida"><svg class="icon" aria-hidden="true"><use href="#i-camera"/></svg>Saída</button>` : ""].filter(Boolean).join(" ");
    return `<tr><td data-label="Data">${date}</td><td data-label="Tipo"><span class="tag tag--${record.type}">${TYPES[record.type]}</span></td><td data-label="Entrada">${record.start || "—"}</td><td data-label="Saída">${record.end || "—"}</td><td data-label="Intervalo">${record.type === "trabalho" ? `${record.break} min` : "—"}</td><td data-label="Trabalhado">${duration(calc.worked)}</td><td data-label="Saldo"><span class="balance-pill ${css}">${signed(calc.balance)}</span></td><td data-label="Ações" class="history-actions">${photoButtons} <button class="table-action" data-edit="${record.id}" title="Editar"><svg class="icon" aria-hidden="true"><use href="#i-pencil"/></svg><span class="table-action__label">Editar</span></button> <button class="table-action table-action--delete" data-delete="${record.id}" title="Excluir"><svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg><span class="table-action__label">Excluir</span></button></td></tr>`;
  }).join("");
  list.forEach((record,index)=>{
    if (record.importData?.source!=="forponto") return;
    const badge=document.createElement("small");
    badge.className="source-badge";
    const punches=Array.isArray(record.importData.punches) ? record.importData.punches.filter((value)=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) : [];
    badge.textContent="Forponto · "+(punches.length ? punches.join(" / ") : record.type==="compensacao" ? "COMPENSA DIA" : "sem batidas")+" · "+(Number.isInteger(record.importData.officialBalanceMinutes) ? "saldo oficial" : "saldo calculado");
    $("#records-body").rows[index].cells[1].append(badge);
  });
  $("#empty-state").hidden = list.length > 0;
  $("#empty-state-text").textContent=historyRange ? "Nenhum registro neste período." : "Nenhum registro neste ciclo.";
  $("#clear-records").disabled=records.length===0;
  const photos=list.flatMap((record)=>Object.entries(recordPhotos(record)).filter(([,photo])=>photo).map(([kind,photo])=>({record,kind,photo})));
  $("#photo-history-title").textContent=historyRange ? "Fotos do período" : "Fotos do ciclo";
  $("#photo-history").hidden=photos.length===0; $("#photo-count").textContent=`${photos.length} ${photos.length===1 ? "foto" : "fotos"}`;
  $("#photo-gallery").innerHTML=photos.map(({record,kind,photo})=>{
    const date=new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR");
    const preview=/^(?:blob:|data:image\/)/.test(photo) ? `<img src="${photo}" alt="" loading="lazy">` : `<span class="photo-card__placeholder" aria-hidden="true"><svg class="icon"><use href="#i-camera"/></svg></span>`;
    return `<button class="photo-card" type="button" data-view-photo="${record.id}" data-photo-kind="${kind}" aria-label="Ver foto de ${kind} de ${date}">${preview}<span class="photo-card__info"><strong>${date}</strong><small>${kind === "entrada" ? "Entrada" : "Saída"} · ${TYPES[record.type]}</small></span></button>`;
  }).join("");
  const totals = HoursCalculator.summarize(list,targetFor);
  $(".summary-grid").setAttribute("aria-label",historyRange ? "Resumo do período pesquisado" : "Resumo do ciclo de 16 a 15");
  $("#balance-period-label").textContent=historyRange ? "Saldo do período" : "Saldo do ciclo";
  $("#balance-period-dates").textContent=historyPeriodLabel();
  const previousRange=previousCycleRange(), previousRecords=previousRange ? recordsInRange(previousRange) : [], deltaElement=$("#balance-delta");
  deltaElement.hidden=!previousRecords.length;
  if (previousRecords.length) { const change=totals.balance-HoursCalculator.summarize(previousRecords,targetFor).balance; deltaElement.textContent=(change>0 ? "↑ " : change<0 ? "↓ " : "= ")+signed(change)+" em relação ao ciclo anterior"; }
  $("#history-title").textContent=historyRange ? "Registros do período" : "Registros do ciclo";
  $("#simulator-description").textContent=historyRange
    ? "O saldo dos registros considera o período pesquisado. Os ajustes manuais continuam vinculados ao mês selecionado."
    : "Informe saldos anteriores ou ajustes que ainda não aparecem nos registros deste ciclo.";
  $("#monthly-worked").textContent = duration(totals.worked); $("#monthly-balance").textContent = signed(totals.balance);
  $("#monthly-positive").textContent = `+${duration(totals.positive)}`;
  $("#monthly-negative").textContent = `-${duration(totals.negative)}`;
  $("#monthly-balance").className = totals.balance > 0 ? "value-positive" : totals.balance < 0 ? "value-negative" : "";
  const owedMinutes=list.filter((record)=>record.type==="trabalho" || record.type==="falta").reduce((sum,record)=>sum+targetFor(record),0), meter=$("#worked-meter");
  meter.hidden=owedMinutes===0; $("#worked-meter-label").hidden=owedMinutes===0;
  if (owedMinutes) { const percent=Math.round(totals.worked/owedMinutes*100), shown=Math.min(percent,100); meter.setAttribute("aria-valuenow",String(shown)); meter.firstElementChild.style.width=shown+"%"; $("#worked-meter-label").textContent="Meta cumprida: "+percent+"%"; }
  $("#registered-days").textContent = list.length; $("#target-summary").textContent = duration(settings.target);
  updateManualBalance(totals.balance);
  renderCalendar();
  scheduleCacheSnapshot();
  updateForecast();
  renderBackupReminder();
}

function resetForm() {
  form.reset(); $("#editing-id").value=""; $("#work-date").value=localDate(); $("#break-time").value=settings.break;
  $("#form-title").textContent="Registrar jornada"; $("#submit-button").textContent="Adicionar registro";
  $("#cancel-edit").hidden=true; $("#error-message").hidden=true; pendingPhotos={entrada:"",saida:""}; capturedPhoto=""; updatePhotoPreview(); updateForecast();
}
function showError(message) { $("#error-message").textContent=message; $("#error-message").hidden=false; }
function showToast(message,type="success",options={}) {
  const toast=document.createElement("div"); toast.className=`toast toast--${type}`;
  const text=document.createElement("span"); text.textContent=message; toast.append(text);
  if (options.actionLabel) {
    const action=document.createElement("button"); action.type="button"; action.className="toast__action"; action.textContent=options.actionLabel;
    action.addEventListener("click",()=>{ options.onAction?.(); toast.remove(); });
    toast.append(action);
  }
  $("#toast-region").append(toast); setTimeout(()=>toast.remove(),options.duration || 4000);
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