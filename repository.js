(function exposeRepository(root, factory) {
  const repository = factory();
  if (typeof module === "object" && module.exports) module.exports = repository;
  if (root) root.HoursRepository = repository;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRepository() {
  function readJson(storage, key, fallback) {
    try {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function createLocalStorageRepository(storage, keys) {
    return {
      findAllRecords() {
        const records = readJson(storage, keys.records, []);
        return Array.isArray(records) ? records : [];
      },
      saveAllRecords(records) {
        storage.setItem(keys.records, JSON.stringify(records));
      },
      getSettings() {
        const settings = readJson(storage, keys.settings, {});
        return settings && typeof settings === "object" ? settings : {};
      },
      saveSettings(settings) {
        storage.setItem(keys.settings, JSON.stringify(settings));
      }
    };
  }

  function createSupabaseRepository(client, userId) {
    let knownIds = null;
    const toRecord = (row) => ({ id: row.id, date: row.date, type: row.type, start: row.start_time, end: row.end_time, break: row.break_minutes, photos: row.photos || { entrada: "", saida: "" } });
    const toRow = (record) => ({ id: record.id, user_id: userId, date: record.date, type: record.type, start_time: record.start || "", end_time: record.end || "", break_minutes: record.break || 0, photos: record.photos || { entrada: "", saida: "" }, updated_at: new Date().toISOString() });
    const throwIfError = (error) => { if (error) throw new Error(error.message); };
    return {
      async findAllRecords() {
        const { data, error } = await client.from("records").select("*").order("date", { ascending: false });
        throwIfError(error); knownIds = new Set(data.map((row) => row.id)); return data.map(toRecord);
      },
      async saveAllRecords(records) {
        if (knownIds === null) await this.findAllRecords();
        const nextIds = new Set(records.map((record) => record.id));
        const removed = [...knownIds].filter((id) => !nextIds.has(id));
        if (removed.length) { const { error } = await client.from("records").delete().in("id", removed); throwIfError(error); }
        if (records.length) { const { error } = await client.from("records").upsert(records.map(toRow)); throwIfError(error); }
        knownIds = nextIds;
      },
      async getSettings() {
        const { data, error } = await client.from("settings").select("target_minutes, theme").maybeSingle();
        throwIfError(error); return data ? { target: data.target_minutes, theme: data.theme } : {};
      },
      async saveSettings(settings) {
        const { error } = await client.from("settings").upsert({ user_id: userId, target_minutes: settings.target, theme: settings.theme, updated_at: new Date().toISOString() });
        throwIfError(error);
      }
    };
  }

  return { createLocalStorageRepository, createSupabaseRepository };
});
