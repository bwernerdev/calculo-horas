// Previsão de saída, intervalo do histórico, lembrete de backup e saldo manual/simulação.
function updateForecast() {
  const visible = $("#day-type").value === "trabalho";
  document.querySelectorAll(".work-field").forEach((field) => field.hidden = !visible);
  $("#exit-forecast").hidden = !visible;
  const start=normalizeClock($("#start-time").value);
  if (!visible || !start) { $("#exit-forecast").textContent="Informe um horário de entrada válido."; return; }
  const date=$("#work-date").value, cycle=HoursCycle.rangeForMonth(HoursCycle.monthForDate(date)), editingId=$("#editing-id").value;
  const basisRecords=(historyRange ? filteredRecords() : recordsInRange(cycle)).filter((record)=>record.id!==editingId);
  const currentBalance=HoursCalculator.summarize(basisRecords,settings.target).balance;
  const breakMinutes=Number($("#break-time").value);
  if (!Number.isInteger(breakMinutes) || breakMinutes<0 || breakMinutes>600) { $("#exit-forecast").textContent="Informe um intervalo entre 0 e 600 minutos."; return; }
  const suggestion=HoursCalculator.suggestExit(start,settings.target,breakMinutes,currentBalance,SUGGESTED_DAILY_LIMIT_MINUTES);
  const balanceClass=currentBalance>0 ? "value-positive" : currentBalance<0 ? "value-negative" : "";
  const pending=suggestion.worked===SUGGESTED_DAILY_LIMIT_MINUTES && suggestion.remainingBalance<0 ? `<span class="forecast__warning"><b>Margem preventiva de 15 min aplicada</b> antes do limite de 10h. Saldo restante: <b>${signed(suggestion.remainingBalance)}</b></span>` : "";
  $("#exit-forecast").innerHTML = `<span>Saída-base: <b>${suggestion.baseExit}</b></span><span>Saldo atual: <b class="${balanceClass}">${signed(currentBalance)}</b></span><strong>Saída sugerida: ${suggestion.suggestedExit}</strong>${pending}`;
}

function recordsInRange(range) { return range ? records.filter((record)=>record.date>=range.from && record.date<=range.to).sort((a,b)=>b.date.localeCompare(a.date)) : []; }
function selectedRange() { return historyRange || HoursCycle.rangeForMonth($("#month-filter").value); }
function filteredRecords() {
  return recordsInRange(selectedRange());
}
function previousCycleRange() {
  if (historyRange) return null;
  const range=selectedRange(); if (!range) return null;
  const day=new Date(range.from+"T12:00:00"); day.setDate(day.getDate()-1);
  return HoursCycle.rangeForMonth(HoursCycle.monthForDate(localDate(day)));
}
function historyPeriodLabel() {
  const range=selectedRange();
  return range ? range.from.split("-").reverse().join("/")+" a "+range.to.split("-").reverse().join("/") : "Período inválido";
}
function historyFilenameSuffix() {
  const range=selectedRange();
  return range ? range.from+"-a-"+range.to : "periodo-invalido";
}
function clearHistoryRange() {
  historyRange=null;
  $("#history-range-form").reset();
  $("#history-range-message").textContent="";
  $("#history-range-message").classList.remove("history-range__message--error");
}
function backupReminderKey(kind) { return `controle-horas-backup-${kind}:${loadedUserId}`; }
function renderBackupReminder() {
  const lastBackup=Number(appStorage.getItem(backupReminderKey("last"))) || 0;
  const snoozedUntil=Number(appStorage.getItem(backupReminderKey("snooze"))) || 0;
  $("#backup-reminder").hidden=!loadedUserId || records.length===0 || Date.now()-lastBackup<BACKUP_REMINDER_DAYS*DAY_MS || snoozedUntil>Date.now();
}
function applyImportedPeriod(dates) {
  if (!dates.length) { clearHistoryRange(); return; }
  const sorted=[...dates].sort();
  historyRange={ from:sorted[0], to:sorted.at(-1) };
  $("#month-filter").value=HoursCycle.monthForDate(historyRange.to);
  $("#history-date-from").value=historyRange.from;
  $("#history-date-to").value=historyRange.to;
  $("#history-range-message").classList.remove("history-range__message--error");
  $("#history-range-message").textContent="Período importado aplicado automaticamente: "+historyPeriodLabel()+". Os ajustes manuais continuam vinculados ao mês selecionado.";
}
function parseManualDuration(value) { return parseDuration(value) ?? 0; }
function manualBalanceStorageKey() { return `${MANUAL_BALANCE_KEY}:${loadedUserId || "anonymous"}:${$("#month-filter").value || "current"}`; }
function pendingBalanceKey(month) { return `${MANUAL_BALANCE_KEY}-pending:${loadedUserId}:${month}`; }
function pendingBalance(month) {
  try {
    const value=JSON.parse(appStorage.getItem(pendingBalanceKey(month)) || "null");
    return value && typeof value.positive==="string" && typeof value.negative==="string" ? value : null;
  } catch { return null; }
}
function renderManualSyncStatus(state) {
  const status=$("#manual-sync-status"), retry=$("#manual-sync-retry");
  status.textContent=state==="saving" ? "Sincronizando saldo com sua conta..." : state==="pending" ? "Saldo salvo neste dispositivo; sincronização pendente." : "Saldo sincronizado com sua conta.";
  status.dataset.state=state;
  retry.hidden=state!=="pending";
}
function saveSettingsQueued(nextSettings) {
  const currentUseCases=useCases;
  const operation=settingsSaveChain.catch(()=>{}).then(()=>currentUseCases.saveSettings(nextSettings));
  settingsSaveChain=operation;
  return operation;
}
function manualDurationInput(minutes) { return minutes ? `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}` : ""; }
function loadManualBalance() {
  const month=$("#month-filter").value;
  const remote=settings.manualBalances?.[month];
  let saved={};
  try { saved=JSON.parse(appStorage.getItem(manualBalanceStorageKey()) || "{}"); } catch {}
  const pending=pendingBalance(month);
  $("#manual-positive").value=pending ? pending.positive : remote ? manualDurationInput(remote.positive) : typeof saved.positive==="string" ? saved.positive : "";
  $("#manual-negative").value=pending ? pending.negative : remote ? manualDurationInput(remote.negative) : typeof saved.negative==="string" ? saved.negative : "";
  $("#simulator-start-time").value=typeof saved.start==="string" && isValidClockTime(saved.start) ? saved.start : "08:00";
  $("#simulator-end-time").value=typeof saved.end==="string" && isValidClockTime(saved.end) ? saved.end : "17:48";
  renderManualSyncStatus(pending ? "pending" : "synced");
}
function saveManualSimulationLocally() {
  appStorage.setItem(manualBalanceStorageKey(),JSON.stringify({ positive:$("#manual-positive").value, negative:$("#manual-negative").value, start:$("#simulator-start-time").value, end:$("#simulator-end-time").value }));
}
async function syncManualBalance(month, positiveInput, negativeInput) {
  if ([positiveInput,negativeInput].some((value)=>value.trim() && parseDuration(value)===null)) return;
  const userId=loadedUserId, version=manualBalanceVersions.get(month);
  if ($("#month-filter").value===month) renderManualSyncStatus("saving");
  const manualBalances={ ...(settings.manualBalances || {}), [month]:{ positive:parseManualDuration(positiveInput), negative:parseManualDuration(negativeInput) } };
  settings={ ...settings, manualBalances };
  try {
    await saveSettingsQueued(settings);
    if (loadedUserId!==userId || manualBalanceVersions.get(month)!==version) return;
    appStorage.removeItem(pendingBalanceKey(month));
    if ($("#month-filter").value===month) renderManualSyncStatus("synced");
  } catch (error) {
    captureError(error,"manual-balance-sync");
    if (loadedUserId===userId && manualBalanceVersions.get(month)===version) {
      if ($("#month-filter").value===month) renderManualSyncStatus("pending");
      showToast("Saldo salvo neste dispositivo; a sincronização com sua conta falhou.","error");
    }
  }
}
function updateManualBalance(monthlyBalance) {
  const positive=parseManualDuration($("#manual-positive").value), negative=parseManualDuration($("#manual-negative").value);
  const adjustment=positive-negative, projected=monthlyBalance+adjustment;
  $("#simulator-current-balance").textContent=signed(monthlyBalance);
  $("#simulator-adjustment").textContent=signed(adjustment);
  $("#simulator-projected-balance").textContent=signed(projected);
  for (const [element,value] of [[$("#simulator-current-balance"),monthlyBalance],[$("#simulator-adjustment"),adjustment],[$("#simulator-projected-balance"),projected]]) element.className=value>0 ? "value-positive" : value<0 ? "value-negative" : "";
  const start=normalizeClock($("#simulator-start-time").value), end=normalizeClock($("#simulator-end-time").value);
  const informedElement=$("#simulator-informed-balance"), suggestedElement=$("#simulator-suggested-exit"), warning=$("#simulator-limit-warning");
  warning.hidden=true; warning.textContent="";
  if (!start) { informedElement.textContent="—"; informedElement.className=""; suggestedElement.textContent="—"; return; }
  const suggestion=HoursCalculator.suggestExit(start,settings.target,FIXED_BREAK_MINUTES,projected,SUGGESTED_DAILY_LIMIT_MINUTES);
  suggestedElement.textContent=suggestion.suggestedExit;
  if (suggestion.worked===SUGGESTED_DAILY_LIMIT_MINUTES && suggestion.remainingBalance<0) {
    warning.textContent=`Margem preventiva de 15 minutos aplicada antes do limite de 10 horas. Ainda restariam ${signed(suggestion.remainingBalance)}.`;
    warning.hidden=false;
  }
  if (!end) { informedElement.textContent="—"; informedElement.className=""; return; }
  const informed=HoursCalculator.calculate({ type:"trabalho",start,end,break:FIXED_BREAK_MINUTES },settings.target);
  if (informed.worked<0 || informed.worked>MAX_DAILY_WORK_MINUTES) {
    informedElement.textContent="Horário inválido"; informedElement.className="value-negative";
    warning.textContent="A saída informada deve resultar em uma jornada entre 0 e 10 horas trabalhadas."; warning.hidden=false; return;
  }
  const informedBalance=projected+informed.balance;
  informedElement.textContent=signed(informedBalance); informedElement.className=informedBalance>0 ? "value-positive" : informedBalance<0 ? "value-negative" : "";
}