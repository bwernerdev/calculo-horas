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
    const knownPhotoPaths = new Map();
    const bucket = client.storage.from("point-photos");
    const throwIfError = (error) => { if (error) throw new Error(error.message); };
    const emptyPhotos = () => ({ entrada: "", saida: "" });
    const isInlinePhoto = (value) => typeof value === "string" && value.startsWith("data:image/");
    const isUrl = (value) => typeof value === "string" && /^https?:\/\//.test(value);
    async function photoUrl(path) {
      if (!path || isInlinePhoto(path) || isUrl(path)) return path || "";
      const { data, error } = await bucket.createSignedUrl(path, 60 * 60);
      throwIfError(error); return data.signedUrl;
    }
    async function toRecord(row) {
      const paths = { ...emptyPhotos(), ...(row.photos || {}) };
      knownPhotoPaths.set(row.id, paths);
      const photos = {};
      for (const kind of ["entrada", "saida"]) photos[kind] = await photoUrl(paths[kind]);
      return { id: row.id, date: row.date, type: row.type, start: row.start_time, end: row.end_time, break: row.break_minutes, photos, photoPaths: paths };
    }
    const toRow = (record, photos) => ({ id: record.id, user_id: userId, date: record.date, type: record.type, start_time: record.start || "", end_time: record.end || "", break_minutes: record.break || 0, photos, updated_at: new Date().toISOString() });
    async function preparePhotos(record) {
      const previous = { ...emptyPhotos(), ...(knownPhotoPaths.get(record.id) || record.photoPaths || {}) };
      const stored = emptyPhotos();
      record.photoPaths = { ...previous };
      for (const kind of ["entrada", "saida"]) {
        const value = record.photos?.[kind] || "";
        if (isInlinePhoto(value)) {
          const path = `${userId}/${record.id}/${kind}.jpg`;
          const blob = await (await fetch(value)).blob();
          const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg", upsert: true });
          throwIfError(error); stored[kind] = path; record.photoPaths[kind] = path; record.photos[kind] = await photoUrl(path);
        } else if (value) {
          stored[kind] = previous[kind] || (isUrl(value) ? "" : value);
        }
        if (previous[kind] && previous[kind] !== stored[kind] && !isInlinePhoto(previous[kind]) && !isUrl(previous[kind])) {
          const { error } = await bucket.remove([previous[kind]]); throwIfError(error);
        }
      }
      record.photoPaths = stored;
      return stored;
    }
    return {
      async findAllRecords() {
        const { data, error } = await client.from("records").select("*").order("date", { ascending: false });
        throwIfError(error); knownIds = new Set(data.map((row) => row.id)); return Promise.all(data.map(toRecord));
      },
      async saveAllRecords(records) {
        if (knownIds === null) await this.findAllRecords();
        const nextIds = new Set(records.map((record) => record.id));
        const removed = [...knownIds].filter((id) => !nextIds.has(id));
        if (removed.length) {
          const files = removed.flatMap((id) => Object.values(knownPhotoPaths.get(id) || {}).filter((path) => path && !isInlinePhoto(path) && !isUrl(path)));
          if (files.length) { const { error } = await bucket.remove(files); throwIfError(error); }
          const { error } = await client.from("records").delete().in("id", removed); throwIfError(error);
          removed.forEach((id) => knownPhotoPaths.delete(id));
        }
        if (records.length) {
          const rows = [];
          for (const record of records) { const photos = await preparePhotos(record); rows.push(toRow(record, photos)); knownPhotoPaths.set(record.id, photos); }
          const { error } = await client.from("records").upsert(rows); throwIfError(error);
        }
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
