// Uso sem internet: cópia local dos registros, fila de alterações e sincronização ao reconectar.
const LAST_USER_KEY="controle-horas-ultimo-usuario-v1";
const offlineKeys=(userId)=>({ queue:`controle-horas-fila-v1:${userId}`, cache:`controle-horas-cache-v1:${userId}` });
let offlineQueue=null;
let offlineMode=false;
let offlineSyncing=false;
let cacheTimer=0;

function setupOfflineForUser(userId) {
  offlineQueue=HoursOffline.createQueue(appStorage,offlineKeys(userId).queue);
  appStorage.setItem(LAST_USER_KEY,userId);
}
function clearOfflineData(userId) {
  appStorage.removeItem(offlineKeys(userId).cache);
  HoursOffline.createQueue(appStorage,offlineKeys(userId).queue).clear();
  appStorage.removeItem(LAST_USER_KEY);
  offlineQueue=null; offlineMode=false;
}
function scheduleCacheSnapshot() {
  if (!loadedUserId) return;
  clearTimeout(cacheTimer);
  cacheTimer=setTimeout(()=>{ if (loadedUserId) HoursOffline.saveSnapshot(appStorage,offlineKeys(loadedUserId).cache,{ records,settings }); },300);
}
function renderOfflineBanner() {
  const banner=$("#offline-banner"), pending=offlineQueue?.size() || 0, offline=navigator.onLine===false;
  banner.hidden=!(offlineMode || offline || pending>0);
  if (banner.hidden) return;
  const pendingText=pending ? " "+pending+(pending===1 ? " alteração aguarda" : " alterações aguardam")+" sincronização." : "";
  banner.textContent=offlineSyncing ? "Sincronizando alterações…"
    : offlineMode ? "Modo offline: exibindo os dados salvos neste dispositivo."+pendingText
    : offline ? "Sem conexão: as alterações ficam neste dispositivo até a internet voltar."+pendingText
    : "Conexão restabelecida."+pendingText;
}

// Salvar: tenta online; sem conexão, valida, guarda localmente e enfileira.
async function saveRecordResilient(record) {
  if (navigator.onLine!==false) {
    try { return await useCases.saveRecord(record,targetFor,records); }
    catch (error) { if (!HoursOffline.isNetworkError(error)) throw error; }
  }
  return saveRecordOffline(record);
}
function saveRecordOffline(record) {
  if (Object.values(record.photos || {}).some((photo)=>typeof photo==="string" && photo.startsWith("data:image/"))) throw new Error("Sem conexão: fotos novas só podem ser anexadas com internet. Remova a foto ou tente novamente online.");
  useCases.validateRecord(record,targetFor);
  if (records.some((item)=>item.date===record.date && item.id!==record.id)) throw new Error("Já existe um registro para esta data. Edite o registro existente.");
  const saved={ ...record, photos:{ entrada:"",saida:"",...(record.photos || {}) }, photoPaths:{ entrada:"",saida:"",...(record.photos || {}) } };
  const index=records.findIndex((item)=>item.id===record.id), updated=[...records];
  if (index>=0) updated[index]=saved; else updated.push(saved);
  offlineQueue.add({ type:"save",record:{ ...record,photos:{ entrada:saved.photos.entrada,saida:saved.photos.saida } } });
  scheduleCacheSnapshot(); renderOfflineBanner();
  showToast("Sem conexão: registro salvo neste dispositivo e será sincronizado depois.");
  return { records:updated,editing:index>=0 };
}
function queueDeleteOffline(id) {
  offlineQueue.add({ type:"delete",id });
  scheduleCacheSnapshot(); renderOfflineBanner();
  showToast("Sem conexão: a exclusão será sincronizada depois.");
}

async function syncOfflineQueue() {
  if (offlineSyncing || !offlineQueue || !offlineQueue.size() || !repository || navigator.onLine===false) return;
  const generation=applicationGeneration, currentRepository=repository, failures=[];
  offlineSyncing=true; renderOfflineBanner();
  try {
    for (const operation of offlineQueue.list()) {
      try {
        if (operation.type==="save") await currentRepository.saveRecord(operation.record); else await currentRepository.deleteRecord(operation.id);
        offlineQueue.remove(operation.key);
      } catch (error) {
        if (HoursOffline.isNetworkError(error)) break;
        failures.push({ operation,error }); offlineQueue.remove(operation.key);
      }
    }
  } finally { offlineSyncing=false; }
  if (generation!==applicationGeneration) return;
  for (const { operation,error } of failures) {
    captureError(error,"offline-sync");
    showToast("Não foi possível sincronizar "+(operation.type==="save" ? "o registro de "+pt(operation.record.date) : "uma exclusão")+": "+(error.message || "erro desconhecido"),"error");
  }
  if (!offlineQueue.size()) {
    try { records=await currentRepository.findAllRecords(); offlineMode=false; if (generation===applicationGeneration) render(); } catch (error) { if (!HoursOffline.isNetworkError(error)) captureError(error,"offline-reload"); }
  }
  renderOfflineBanner();
}
async function handleBackOnline() {
  renderOfflineBanner();
  await syncOfflineQueue();
  if (offlineMode && repository && useCases) {
    const generation=applicationGeneration;
    try {
      const [loadedRecords,loadedSettings]=await Promise.all([repository.findAllRecords(),useCases.getSettings()]);
      if (generation!==applicationGeneration) return;
      records=loadedRecords; settings=loadedSettings; offlineMode=false; fillSettingsForm(); applyTheme(); render();
    } catch (error) { if (!HoursOffline.isNetworkError(error)) captureError(error,"offline-refresh"); }
  }
  renderOfflineBanner();
}
window.addEventListener("online",()=>{ void handleBackOnline(); });
window.addEventListener("offline",renderOfflineBanner);
document.addEventListener("visibilitychange",()=>{ if (!document.hidden) void syncOfflineQueue(); });
