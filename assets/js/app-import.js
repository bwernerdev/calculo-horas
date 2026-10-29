// Importação Forponto (XLSX/PDF) e restauração de backup JSON.
$("#import-json").addEventListener("click",()=>$("#json-file").click());
$("#import-forponto").addEventListener("click",()=>$("#forponto-file").click());
function closeForpontoPreview() {
  if ($("#forponto-dialog").open) $("#forponto-dialog").close();
  forpontoBlocks=[];
  $("#forponto-preview-body").replaceChildren();
  $("#forponto-block").replaceChildren();
  $("#forponto-update-existing").checked=false;
}
function renderForpontoPreview() {
  const block=$("#forponto-block").value==="" ? null : forpontoBlocks[Number($("#forponto-block").value)];
  const body=$("#forponto-preview-body");
  body.replaceChildren();
  if (!block) { $("#forponto-summary").textContent="Selecione um bloco para conferir os dados."; $("#forponto-confirm").disabled=true; return; }
  let ready=0, duplicates=0, updates=0, skipped=0;
  const updateExisting=$("#forponto-update-existing").checked;
  const knownDates=new Set(records.map((record)=>record.date));
  for (const day of block.days) {
    const duplicate=knownDates.has(day.date);
    const status=duplicate && !updateExisting ? "Já registrado — preservado"
      : duplicate && day.status==="ready" ? "Atualizar: "+(day.note || "saldo e marcações do relatório")
      : day.status==="ready" ? day.note || "Pronto para importar" : day.reason;
    if (duplicate && !updateExisting) duplicates++;
    else if (duplicate && day.status==="ready") updates++;
    else if (day.status==="ready") ready++;
    else skipped++;
    const tr=document.createElement("tr");
    for (const value of [day.date.split("-").reverse().join("/"),day.label || "—",day.punches?.join(" · ") || "—",status]) {
      const td=document.createElement("td");
      td.textContent=value;
      tr.append(td);
    }
    body.append(tr);
  }
  $("#forponto-summary").textContent=ready+" novo(s), "+updates+" para atualizar, "+duplicates+" preservado(s), "+skipped+" pendente(s). O saldo oficial do Forponto é preservado quando informado.";
  $("#forponto-confirm").disabled=ready+updates===0;
  $("#forponto-confirm").textContent="Aplicar "+(ready+updates)+" dia(s)";
}
$("#forponto-block").addEventListener("change",renderForpontoPreview);
$("#forponto-update-existing").addEventListener("change",renderForpontoPreview);
$("#forponto-cancel").addEventListener("click",closeForpontoPreview);
$("#forponto-dialog").addEventListener("cancel",(event)=>{ if ($("#forponto-cancel").disabled) event.preventDefault(); });
$("#forponto-dialog").addEventListener("close",()=>{ forpontoBlocks=[]; });
$("#forponto-file").addEventListener("change",async(event)=>{
  const file=event.target.files?.[0];
  if (!file) return;
  const button=$("#import-forponto");
  button.disabled=true;
  try {
    forpontoBlocks=await ForpontoImport.parseFile(file,fflate.unzipSync);
    $("#forponto-block").replaceChildren();
    const placeholder=document.createElement("option");
    placeholder.value=""; placeholder.textContent="Selecione o bloco correto"; $("#forponto-block").append(placeholder);
    forpontoBlocks.forEach((block,index)=>{
      const option=document.createElement("option");
      option.value=String(index);
      option.textContent="Bloco "+(index+1)+(block.header ? " — "+block.header : "")+" — "+block.days.length+" dia(s), "+block.days.filter((day)=>day.punches?.length).length+" com marcações";
      $("#forponto-block").append(option);
    });
    $("#forponto-block").value="";
    $("#forponto-update-existing").checked=false;
    renderForpontoPreview();
    forpontoGeneration=applicationGeneration;
    $("#forponto-dialog").showModal();
  } catch (error) {
    captureError(error,"forponto-parse");
    showToast(error.message || "Não foi possível ler o relatório XLSX ou PDF.","error");
  } finally { event.target.value=""; button.disabled=false; }
});
$("#forponto-confirm").addEventListener("click",async()=>{
  const block=$("#forponto-block").value==="" ? null : forpontoBlocks[Number($("#forponto-block").value)];
  if (!block || forpontoGeneration!==applicationGeneration || !useCases) return;
  const knownDates=new Map(records.map((record)=>[record.date,record]));
  const updateExisting=$("#forponto-update-existing").checked;
  const pending=block.days.filter((day)=>day.status==="ready" && (updateExisting || !knownDates.has(day.date)));
  const button=$("#forponto-confirm");
  button.disabled=true;
  $("#forponto-cancel").disabled=true;
  try {
    const updates=pending.filter((day)=>knownDates.has(day.date)).length;
    if (updates && !await requestConfirmation("Atualizar "+updates+" data(s) existente(s) com as marcações e o saldo do Forponto? As fotos serão mantidas.")) return;
    if (forpontoGeneration!==applicationGeneration) throw new Error("A sessão mudou durante a importação.");
    const importedRecords=pending.map((day)=>{
      const existing=knownDates.get(day.date);
      return { ...day.record, id:existing?.id || crypto.randomUUID(), photos:existing ? recordPhotos(existing) : { entrada:"", saida:"" } };
    });
    const updatedRecords=await useCases.importForpontoRecords(importedRecords,targetFor,records,updateExisting);
    if (forpontoGeneration!==applicationGeneration) return;
    records=updatedRecords;
    if (pending.length) applyImportedPeriod(pending.map((day)=>day.date));
    loadManualBalance();
    render();
    closeForpontoPreview();
    showToast(pending.length+" dia(s) aplicado(s) em conjunto. Os demais não foram alterados.");
  } catch (error) {
    captureError(error,"forponto-import",{ count:pending.length });
    renderForpontoPreview();
    render();
    const guidance=/import_forponto_records|schema cache/i.test(error.message || "")
      ? "Aplique a migração de importação atômica no Supabase antes de importar."
      : /import_data|records_type_check|compensacao/i.test(error.message || "")
        ? "Aplique a migração Forponto no Supabase antes de importar." : error.message;
    showToast("Nenhum dia foi importado: "+guidance,"error");
  } finally { button.disabled=false; $("#forponto-cancel").disabled=false; }
});
$("#json-file").addEventListener("change",async(event)=>{
  const file=event.target.files[0]; if (!file) return;
  const importButton=$("#import-json"); importButton.disabled=true; importButton.textContent="Validando backup...";
  try {
    if (file.size>MAX_BACKUP_FILE_BYTES) throw new Error("O arquivo excede o limite de 50 MB.");
    const backup=JSON.parse(await file.text());
    const config=backup.configuracoes;
    if (backup.versao!==1 || !config || !Array.isArray(backup.registros)) throw new Error("estrutura inválida");
    if (backup.registros.length>MAX_BACKUP_RECORDS) throw new Error(`O backup excede ${MAX_BACKUP_RECORDS} registros.`);
    if (!Number.isInteger(config.metaDiariaMinutos) || config.metaDiariaMinutos<1 || config.metaDiariaMinutos>MAX_DAILY_WORK_MINUTES || !Number.isInteger(config.intervaloPadraoMinutos) || config.intervaloPadraoMinutos<0 || config.intervaloPadraoMinutos>MAX_DAILY_WORK_MINUTES || !["light","dark"].includes(config.tema)) throw new Error("As configurações do backup são inválidas.");
    const imported=backup.registros.map((item)=>parseBackupRecord(item,config.metaDiariaMinutos));
    if (new Set(imported.map((item)=>item.id)).size!==imported.length || new Set(imported.map((item)=>item.date)).size!==imported.length) throw new Error("registros duplicados");
    if (!await requestConfirmation(`Restaurar ${imported.length} registro(s)? Os dados atuais serão substituídos.`)) return;
    importButton.textContent="Restaurando...";
    const manualBalances=config.saldosManuais || {};
    if (!manualBalances || typeof manualBalances!=="object" || Array.isArray(manualBalances) || Object.keys(manualBalances).length>240 || Object.entries(manualBalances).some(([month,balance])=>!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(balance?.positive) || balance.positive<0 || balance.positive>599999 || !Number.isInteger(balance?.negative) || balance.negative<0 || balance.negative>599999)) throw new Error("Os saldos manuais do backup são inválidos.");
    const weekdayTargets=config.metasPorDiaSemana ?? {};
    if (!weekdayTargets || typeof weekdayTargets!=="object" || Array.isArray(weekdayTargets) || Object.entries(weekdayTargets).some(([day,minutes])=>!/^[0-6]$/.test(day) || !Number.isInteger(minutes) || minutes<1 || minutes>MAX_DAILY_WORK_MINUTES)) throw new Error("As metas por dia da semana do backup são inválidas.");
    const nextSettings={ target:config.metaDiariaMinutos, break:config.intervaloPadraoMinutos, weekdayTargets, theme:config.tema==="dark" ? "dark" : "light", manualBalances };
    records=await repository.restoreBackup(imported,nextSettings); settings=nextSettings;
    await saveSettingsQueued(nextSettings).catch((error)=>captureError(error,"restore-preferences"));
    for (const [month,balance] of Object.entries(manualBalances)) appStorage.setItem(`${MANUAL_BALANCE_KEY}:${loadedUserId}:${month}`,JSON.stringify({ positive:manualDurationInput(balance.positive), negative:manualDurationInput(balance.negative) }));
    fillSettingsForm(); applyTheme(); applyImportedPeriod(records.map((record)=>record.date)); loadManualBalance(); resetForm(); render();
    showToast("Backup restaurado com sucesso.");
  } catch (error) {
    captureError(error,"backup-import");
    const message=String(error?.message || "Backup inválido");
    const guidance=/restore_user_backup|schema cache/i.test(message) ? "Atualize o banco aplicando as migrações pendentes do Supabase." : message;
    showToast(`Não foi possível importar: ${guidance}`,"error");
  }
  finally { event.target.value=""; importButton.disabled=false; importButton.textContent="Importar backup"; }
});