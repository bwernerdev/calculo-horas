// @ts-check
/** UMD: fila de alterações offline e cópia local (sem fotos novas) dos registros, usando um storage injetado. */
(function exposeOffline(/** @type {any} */ root, factory) {
  const offline = factory();
  if (typeof module === "object" && module.exports) module.exports = offline;
  if (root) root.HoursOffline = offline;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOffline() {
  const NETWORK_MESSAGE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|timeout|timed out|offline/i;

  /** Erro causado por falta de conexão (e não por regra de negócio ou permissão). @param {any} error */
  function isNetworkError(error) {
    if (!error) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
    return error instanceof TypeError || NETWORK_MESSAGE.test(String(error.message || error));
  }

  /** @param {any} storage @param {string} key @param {any} fallback */
  function readJson(storage, key, fallback) {
    try {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Fila FIFO de operações {type:"save", record} | {type:"delete", id}; guarda só a última operação de cada registro.
   * @param {any} storage @param {string} key
   */
  function createQueue(storage, key) {
    const load = () => {
      const list = readJson(storage, key, []);
      return Array.isArray(list) ? list.filter((item) => item && typeof item.key === "string") : [];
    };
    /** @param {any[]} list */
    const persist = (list) => storage.setItem(key, JSON.stringify(list));
    return {
      list: load,
      size: () => load().length,
      /** @param {{type:"save", record:any} | {type:"delete", id:string}} operation */
      add(operation) {
        const id = operation.type === "save" ? operation.record.id : operation.id;
        const list = load().filter((item) => item.key !== id);
        list.push({ ...operation, key: id, queuedAt: Date.now() });
        persist(list);
      },
      /** @param {string} id */
      remove(id) { persist(load().filter((item) => item.key !== id)); },
      clear() { try { storage.removeItem(key); } catch { /* sem storage */ } },
    };
  }

  /** Mantém só caminhos do Storage; descarta fotos locais (data:/blob:) e URLs de exibição. @param {any} photos */
  function storedPhotos(photos) {
    const keep = (/** @type {any} */ value) => (typeof value === "string" && value && !/^(?:data:|blob:|https?:)/.test(value) ? value : "");
    return { entrada: keep(photos?.entrada), saida: keep(photos?.saida) };
  }

  /** @param {any} storage @param {string} key @param {{records:any[], settings:any}} snapshot */
  function saveSnapshot(storage, key, { records, settings }) {
    try {
      const slim = records.map((record) => ({ id: record.id, date: record.date, type: record.type, start: record.start || "", end: record.end || "", break: record.break || 0, importData: record.importData || {}, photos: storedPhotos(record.photos) }));
      storage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), records: slim, settings }));
      return true;
    } catch {
      return false;
    }
  }

  /** @param {any} storage @param {string} key */
  function loadSnapshot(storage, key) {
    const data = readJson(storage, key, null);
    if (!data || data.version !== 1 || !Array.isArray(data.records)) return null;
    const valid = data.records.every((record) => record && typeof record.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.date) && typeof record.type === "string");
    if (!valid) return null;
    return {
      savedAt: data.savedAt,
      settings: data.settings || {},
      records: data.records.map((record) => ({ ...record, photoPaths: { ...record.photos } })),
    };
  }

  return { isNetworkError, createQueue, saveSnapshot, loadSnapshot };
});
