// Backup automático diário (sem fotos) no Supabase e diálogo para baixar as cópias.
const AUTO_BACKUP_INTERVAL_MS = DAY_MS;
const AUTO_BACKUP_KEEP = 7;

function buildBackupPayload(sourceRecords, sourceSettings) {
  return {
    versao:1,
    exportadoEm:new Date().toISOString(),
    configuracoes:{ metaDiariaMinutos:sourceSettings.target, intervaloPadraoMinutos:FIXED_BREAK_MINUTES, tema:sourceSettings.theme, saldosManuais:sourceSettings.manualBalances || {} },
    registros:sourceRecords.map((record) => ({ id:record.id, data:record.date, tipo:record.type, entrada:record.start, saida:record.end, intervaloMinutos:record.break, dadosImportacao:record.importData || {}, fotos:{ entrada:"", saida:"" } }))
  };
}

function isMissingSnapshotTable(error) {
  return /backup_snapshots|schema cache|42P01|PGRST205/i.test(`${error?.code || ""} ${error?.message || ""}`);
}

async function maybeCreateAutoBackup() {
  const generation = applicationGeneration, currentRepository = repository;
  if (!currentRepository || !records.length) return;
  try {
    const [latest] = await currentRepository.listSnapshots();
    if (generation !== applicationGeneration) return;
    if (latest && Date.now() - new Date(latest.created_at).getTime() < AUTO_BACKUP_INTERVAL_MS) return;
    await currentRepository.createSnapshot(buildBackupPayload(records, settings), records.length);
    await currentRepository.pruneSnapshots(AUTO_BACKUP_KEEP);
  } catch (error) {
    // Sem a migração aplicada o recurso fica desligado em silêncio, sem poluir o monitoramento.
    if (!isMissingSnapshotTable(error)) captureError(error, "auto-backup");
  }
}

async function renderAutoBackupList() {
  const list = $("#auto-backup-list"), status = $("#auto-backup-status");
  list.replaceChildren();
  status.textContent = "Carregando cópias...";
  const generation = applicationGeneration;
  try {
    const snapshots = await repository.listSnapshots();
    if (generation !== applicationGeneration) return;
    status.textContent = snapshots.length ? `${snapshots.length} cópia(s) disponível(is).` : "Nenhuma cópia automática ainda. A primeira é criada no próximo acesso com registros.";
    for (const snapshot of snapshots) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const when = new Date(snapshot.created_at).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" });
      label.textContent = `${when} · ${snapshot.record_count} registro(s)`;
      const button = document.createElement("button");
      button.type = "button"; button.className = "button button--secondary"; button.textContent = "Baixar";
      button.setAttribute("aria-label", `Baixar cópia de ${when}`);
      button.dataset.snapshotId = snapshot.id; button.dataset.snapshotDate = snapshot.created_at.slice(0, 10);
      item.append(label, button);
      list.append(item);
    }
  } catch (error) {
    status.textContent = isMissingSnapshotTable(error)
      ? "Aplique a migração de backups automáticos no Supabase para ativar este recurso."
      : "Não foi possível carregar as cópias. Tente novamente.";
    if (!isMissingSnapshotTable(error)) captureError(error, "auto-backup-list");
  }
}

$("#open-auto-backups").addEventListener("click", () => {
  if (!repository) return;
  $("#auto-backup-dialog").showModal();
  void renderAutoBackupList();
});
$("#auto-backup-close").addEventListener("click", () => $("#auto-backup-dialog").close());
$("#auto-backup-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-snapshot-id]");
  if (!button) return;
  button.disabled = true;
  try {
    const payload = await repository.loadSnapshot(button.dataset.snapshotId);
    downloadFile(JSON.stringify(payload), `backup-automatico-${button.dataset.snapshotDate}.json`, "application/json;charset=utf-8");
    showToast("Cópia baixada. Use \"Importar backup\" para restaurá-la.");
  } catch (error) {
    captureError(error, "auto-backup-download");
    showToast("Não foi possível baixar esta cópia.", "error");
  } finally { button.disabled = false; }
});
