(function initializeStorageAndTheme() {
  const memory = new Map();
  let nativeStorage;
  let persistent = false;
  try {
    nativeStorage = window.localStorage;
    const probe = "controle-horas-storage-probe";
    nativeStorage.setItem(probe, "1");
    nativeStorage.removeItem(probe);
    persistent = true;
  } catch {}

  const storage = {
    onFailure: null,
    get persistent() { return persistent; },
    getItem(key) {
      if (!persistent) return memory.get(key) ?? null;
      try { return nativeStorage.getItem(key); }
      catch { this.markUnavailable(); return memory.get(key) ?? null; }
    },
    setItem(key, value) {
      const text = String(value);
      if (persistent) {
        try { nativeStorage.setItem(key, text); return; }
        catch { this.markUnavailable(); }
      }
      memory.set(key, text);
    },
    removeItem(key) {
      if (persistent) {
        try { nativeStorage.removeItem(key); return; }
        catch { this.markUnavailable(); }
      }
      memory.delete(key);
    },
    markUnavailable() {
      if (!persistent) return;
      persistent = false;
      this.onFailure?.();
    },
  };
  window.AppStorage = storage;
  document.documentElement.dataset.theme = storage.getItem("controle-horas-tema-v1") === "dark" ? "dark" : "light";
})();
