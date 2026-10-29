// Validação e exportação do backup JSON e lembrete de backup.

async function photoAsDataUrl(value, recordId, kind) {
  if (!value || value.startsWith("data:image/")) return value || "";
  const displayUrl=value.startsWith("blob:") ? value : await repository.loadPhoto(recordId,kind);
  const response = await fetch(displayUrl); if (!response.ok) throw new Error("foto indisponível");
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}

function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year,month,day]=value.split("-").map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day;
}
function isValidClockTime(value) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
function parseBackupImportData(value) {
  if (value === undefined) return {};
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Dados de importação inválidos no backup.");
  if (Object.keys(value).length===0) return {};
  if (value.source!=="forponto" || typeof value.label!=="string" || value.label.length>100 ||
      !Array.isArray(value.punches) || value.punches.length!==4 ||
      value.punches.some((punch)=>typeof punch!=="string" || (punch!=="" && !/^COMPENSA DIA$/i.test(punch) && !isValidClockTime(punch))) ||
      (value.officialBalanceMinutes!==null && (!Number.isInteger(value.officialBalanceMinutes) || Math.abs(value.officialBalanceMinutes)>1440))) {
    throw new Error("Dados de importação inválidos no backup.");
  }
  return { source:"forponto", label:value.label, punches:[...value.punches], officialBalanceMinutes:value.officialBalanceMinutes };
}
function parseBackupRecord(item,targetMinutes) {
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!item || !uuid.test(String(item.id)) || !isValidCalendarDate(item.data) || !Object.hasOwn(TYPES,item.tipo)) throw new Error("Há um registro com identificação, data ou tipo inválido.");
  const breakMinutes=Number(item.intervaloMinutos);
  if (!Number.isInteger(breakMinutes) || breakMinutes<0 || breakMinutes>MAX_DAILY_WORK_MINUTES) throw new Error(`O intervalo de ${item.data} é inválido.`);
  const importData=parseBackupImportData(item.dadosImportacao);
  const record={ id:String(item.id), date:item.data, type:item.tipo, start:item.entrada || "", end:item.saida || "", break:item.tipo==="trabalho" ? breakMinutes : 0, ...(Object.keys(importData).length ? { importData } : {}), photos:{ entrada:"", saida:"" } };
  if (item.tipo==="trabalho") {
    if (!isValidClockTime(record.start) || !isValidClockTime(record.end)) throw new Error(`A jornada de ${item.data} possui horários inválidos.`);
    const worked=HoursCalculator.calculate(record,targetMinutes).worked;
    if (worked<0 || worked>MAX_DAILY_WORK_MINUTES) throw new Error(`A jornada de ${item.data} ultrapassa os limites permitidos.`);
  }
  const photos=item.fotos || { entrada:item.foto || "", saida:"" };
  for (const kind of ["entrada","saida"]) {
    const photo=photos[kind] || "";
    if (photo && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length>MAX_BACKUP_PHOTO_LENGTH)) throw new Error(`A foto de ${kind} de ${item.data} é inválida ou excede 2 MB.`);
    record.photos[kind]=photo;
  }
  return record;
}

$("#export-json").addEventListener("click",async (event)=>{
  const button = event.currentTarget; button.disabled = true; button.textContent = "Preparando backup...";
  try {
    const backupRecords = [];
    let estimatedBytes=0, photosComplete=true, unavailablePhotos=false;
    for (const record of records) {
      const item={ id:record.id, data:record.date, tipo:record.type, entrada:record.start, saida:record.end, intervaloMinutos:record.break, dadosImportacao:record.importData || {}, fotos:{ entrada:"", saida:"" } };
      backupRecords.push(item);
      estimatedBytes+=new Blob([JSON.stringify(item)]).size;
      if (photosComplete) {
        const photos=recordPhotos(record);
        for (const kind of ["entrada","saida"]) {
          try { item.fotos[kind]=await photoAsDataUrl(photos[kind],record.id,kind); }
          catch (error) { captureError(error,"backup-photo-load",{ recordId:record.id,kind }); photosComplete=false; unavailablePhotos=true; break; }
          estimatedBytes+=item.fotos[kind].length;
          if (estimatedBytes>MAX_BACKUP_FILE_BYTES) { photosComplete=false; break; }
        }
      }
    }
  const backup={
    versao:1,
    exportadoEm:new Date().toISOString(),
    configuracoes:{ metaDiariaMinutos:settings.target, intervaloPadraoMinutos:settings.break, metasPorDiaSemana:settings.weekdayTargets || {}, tema:settings.theme, saldosManuais:settings.manualBalances || {} },
    registros:backupRecords
  };
  let content=JSON.stringify(backup);
  let filename=`backup-horas-${localDate()}.json`;
  let withoutPhotos=false;
  if (!photosComplete || new Blob([content]).size>MAX_BACKUP_FILE_BYTES) {
    const reason=unavailablePhotos ? "Uma ou mais fotos estão indisponíveis no Supabase agora." : "O backup completo excede 50 MB e não pode ser restaurado neste site.";
    if (!await requestConfirmation(`${reason} Baixar uma cópia restaurável dos registros sem as fotos? As fotos já enviadas continuarão no Supabase.`)) return;
    for (const item of backupRecords) item.fotos={ entrada:"", saida:"" };
    content=JSON.stringify(backup);
    filename=`backup-horas-sem-fotos-${localDate()}.json`;
    withoutPhotos=true;
    if (new Blob([content]).size>MAX_BACKUP_FILE_BYTES) throw new Error("Mesmo sem fotos, o backup excede 50 MB.");
  }
  downloadFile(content,filename,"application/json;charset=utf-8");
  if (withoutPhotos) showToast("Backup dos registros baixado sem fotos; as imagens permanecem no Supabase.","error");
  appStorage.setItem(backupReminderKey("last"),String(Date.now()));
  appStorage.removeItem(backupReminderKey("snooze"));
  renderBackupReminder();
  } catch (error) { captureError(error,"backup-export"); showToast("Não foi possível incluir as fotos no backup.","error"); }
  finally { button.disabled = false; button.textContent = "Baixar backup"; }
});
$("#backup-reminder-download").addEventListener("click",()=>$("#export-json").click());
$("#backup-reminder-later").addEventListener("click",()=>{
  appStorage.setItem(backupReminderKey("snooze"),String(Date.now()+BACKUP_SNOOZE_DAYS*DAY_MS));
  renderBackupReminder();
});
