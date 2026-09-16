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
    const load = () => {
      const records = readJson(storage, keys.records, []);
      return Array.isArray(records) ? records : [];
    };
    const persist = (records) => storage.setItem(keys.records, JSON.stringify(records));
    return {
      findAllRecords: load,
      saveRecord(record) {
        const records = load();
        const index = records.findIndex((item) => item.id === record.id);
        if (index >= 0) records[index] = record;
        else records.push(record);
        persist(records);
        return record;
      },
      deleteRecord(id) { persist(load().filter((item) => item.id !== id)); },
      deleteAllRecords() { persist([]); return { photoCleanupFailed:0 }; },
      getSettings() {
        const settings = readJson(storage, keys.settings, {});
        return settings && typeof settings === "object" ? settings : {};
      },
      saveSettings(settings) { storage.setItem(keys.settings, JSON.stringify(settings)); },
      restoreBackup(records, settings) {
        persist(records);
        storage.setItem(keys.settings, JSON.stringify(settings));
        return records;
      },
      dispose() {}
    };
  }

  function createSupabaseRepository(client, userId) {
    const PAGE_SIZE = 500;
    let knownIds = new Set();
    const knownPhotoPaths = new Map();
    const recordObjectUrls = new Map();
    const objectUrls = new Set();
    const bucket = client.storage.from("point-photos");
    const throwIfError = (error) => { if (error) throw new Error(error.message); };
    const missingBalanceColumn = (error) => error && (error.code === "42703" || /balance_adjustments/i.test(error.message || ""));
    const emptyPhotos = () => ({ entrada: "", saida: "" });
    const isInlinePhoto = (value) => typeof value === "string" && value.startsWith("data:image/");
    const isDisplayUrl = (value) => typeof value === "string" && /^(?:https?:|blob:)/.test(value);
    const storedPaths = (record) => ({ ...emptyPhotos(), ...(knownPhotoPaths.get(record.id) || record.photoPaths || {}) });

    function revokeObjectUrl(value) {
      if (typeof value === "string" && value.startsWith("blob:") && objectUrls.has(value)) {
        URL.revokeObjectURL(value);
        objectUrls.delete(value);
      }
    }

    async function photoUrl(path) {
      if (!path || isInlinePhoto(path) || isDisplayUrl(path)) return path || "";
      const { data, error } = await bucket.download(path);
      throwIfError(error);
      const url = URL.createObjectURL(data);
      objectUrls.add(url);
      return url;
    }

    async function toRecord(row) {
      (recordObjectUrls.get(row.id) || []).forEach(revokeObjectUrl);
      const paths = { ...emptyPhotos(), ...(row.photos || {}) };
      knownPhotoPaths.set(row.id, paths);
      const photos = {};
      for (const kind of ["entrada", "saida"]) photos[kind] = await photoUrl(paths[kind]);
      recordObjectUrls.set(row.id, Object.values(photos).filter((value) => value.startsWith?.("blob:")));
      return { id: row.id, date: row.date, type: row.type, start: row.start_time, end: row.end_time, break: row.break_minutes, importData:row.import_data || {}, photos, photoPaths: paths };
    }

    function materializeRecord(record, paths) {
      const photos = { ...emptyPhotos(), ...(record.photos || {}) };
      const keptUrls = Object.values(photos).filter((value) => value.startsWith?.("blob:"));
      (recordObjectUrls.get(record.id) || []).filter((url) => !keptUrls.includes(url)).forEach(revokeObjectUrl);
      recordObjectUrls.set(record.id, keptUrls);
      knownPhotoPaths.set(record.id, paths);
      return { ...record, photos, photoPaths:paths };
    }

    const toRow = (record, photos) => ({
      id: record.id,
      user_id: userId,
      date: record.date,
      type: record.type,
      start_time: record.start || "",
      end_time: record.end || "",
      break_minutes: record.break || 0,
      ...(record.importData ? { import_data:record.importData } : {}),
      photos,
      updated_at: new Date().toISOString()
    });

    async function removeFiles(paths) {
      const files = [...new Set(paths.filter((path) => path && !isInlinePhoto(path) && !isDisplayUrl(path)))];
      if (!files.length) return;
      const { error } = await bucket.remove(files);
      if (error) console.warn("Não foi possível remover fotos antigas do Storage:", error.message);
    }

    async function stagePhotos(record) {
      const previous = storedPaths(record);
      const stored = emptyPhotos();
      const uploaded = [];
      try {
        for (const kind of ["entrada", "saida"]) {
          const value = record.photos?.[kind] || "";
          if (isInlinePhoto(value)) {
            const token = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const path = `${userId}/${record.id}/${kind}-${token}.jpg`;
            const blob = await (await fetch(value)).blob();
            const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg", upsert: false });
            throwIfError(error);
            stored[kind] = path;
            uploaded.push(path);
          } else if (value && !isDisplayUrl(value)) {
            stored[kind] = value;
          } else if (value) {
            stored[kind] = previous[kind] || "";
          }
        }
      } catch (error) {
        await removeFiles(uploaded);
        throw error;
      }
      const obsolete = ["entrada", "saida"].filter((kind) => previous[kind] && previous[kind] !== stored[kind]).map((kind) => previous[kind]);
      return { stored, uploaded, obsolete };
    }

    async function cleanupStaged(stages) {
      await removeFiles(stages.flatMap((stage) => stage.uploaded));
    }

    return {
      async findAllRecords() {
        const rows = [];
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await client.from("records").select("*").order("date", { ascending: false }).range(from, from + PAGE_SIZE - 1);
          throwIfError(error);
          rows.push(...data);
          if (data.length < PAGE_SIZE) break;
        }
        knownIds = new Set(rows.map((row) => row.id));
        return Promise.all(rows.map(toRecord));
      },

      async saveRecord(record) {
        const stage = await stagePhotos(record);
        const { data, error } = await client.from("records").upsert(toRow(record, stage.stored), { onConflict: "id" }).select("*").single();
        if (error) {
          await cleanupStaged([stage]);
          throwIfError(error);
        }
        await removeFiles(stage.obsolete);
        knownIds.add(record.id);
        return materializeRecord({ ...record, date:data.date },stage.stored);
      },

      async deleteRecord(id) {
        const paths = Object.values(knownPhotoPaths.get(id) || {});
        const { error } = await client.from("records").delete().eq("id", id);
        throwIfError(error);
        knownIds.delete(id);
        knownPhotoPaths.delete(id);
        (recordObjectUrls.get(id) || []).forEach(revokeObjectUrl);
        recordObjectUrls.delete(id);
        await removeFiles(paths);
      },

      async deleteAllRecords() {
        const paths=[];
        for (let from=0; ; from+=PAGE_SIZE) {
          const { data, error } = await client.from("records")
            .select("photos").eq("user_id",userId).order("id",{ ascending:true })
            .range(from,from+PAGE_SIZE-1);
          throwIfError(error);
          for (const row of data) paths.push(...Object.values(row.photos || {}));
          if (data.length<PAGE_SIZE) break;
        }
        const { error } = await client.from("records").delete().eq("user_id",userId);
        throwIfError(error);
        knownIds.clear();
        knownPhotoPaths.clear();
        recordObjectUrls.forEach((urls)=>urls.forEach(revokeObjectUrl));
        recordObjectUrls.clear();
        const files=[...new Set(paths.filter((path)=>typeof path==="string" && path.startsWith(userId+"/")))];
        let photoCleanupFailed=0;
        for (let from=0;from<files.length;from+=100) {
          const batch=files.slice(from,from+100);
          try {
            const result=await bucket.remove(batch);
            if (result.error) photoCleanupFailed+=batch.length;
          } catch {
            photoCleanupFailed+=batch.length;
          }
        }
        return { photoCleanupFailed };
      },

      async getSettings() {
        let { data, error } = await client.from("settings").select("target_minutes, theme, balance_adjustments").maybeSingle();
        if (missingBalanceColumn(error)) ({ data, error } = await client.from("settings").select("target_minutes, theme").maybeSingle());
        throwIfError(error);
        return data ? { target: data.target_minutes, theme: data.theme, manualBalances:data.balance_adjustments || {} } : {};
      },

      async saveSettings(settings) {
        const row={ user_id:userId, target_minutes:settings.target, theme:settings.theme, balance_adjustments:settings.manualBalances || {}, updated_at:new Date().toISOString() };
        let { error } = await client.from("settings").upsert(
          row,
          { onConflict: "user_id" }
        );
        if (missingBalanceColumn(error)) ({ error } = await client.from("settings").upsert(
          { user_id:row.user_id, target_minutes:row.target_minutes, theme:row.theme, updated_at:row.updated_at },
          { onConflict:"user_id" }
        ));
        throwIfError(error);
      },

      async restoreBackup(records, settings) {
        const hasForpontoData=records.some((record)=>record.importData?.source==="forponto");
        if (hasForpontoData) {
          const { error } = await client.from("records").select("import_data").limit(1);
          if (error) throw new Error("Aplique a migração Forponto no Supabase antes de restaurar este backup.");
        }
        const stages = [];
        try {
          for (const record of records) stages.push(await stagePhotos(record));
        } catch (error) {
          await cleanupStaged(stages);
          throw error;
        }
        const rows = records.map((record, index) => toRow(record, stages[index].stored));
        let { error } = await client.rpc("restore_user_backup", {
          p_records: rows,
          p_target_minutes: settings.target,
          p_theme: settings.theme,
          p_balance_adjustments: settings.manualBalances || {}
        });
        if (error && !hasForpontoData && /p_balance_adjustments|schema cache|function.*restore_user_backup/i.test(error.message || "")) ({ error } = await client.rpc("restore_user_backup", {
          p_records:rows,
          p_target_minutes:settings.target,
          p_theme:settings.theme
        }));
        if (error) {
          await cleanupStaged(stages);
          throwIfError(error);
        }
        await removeFiles([
          ...stages.flatMap((stage) => stage.obsolete),
          ...[...knownIds].filter((id) => !records.some((record) => record.id === id)).flatMap((id) => Object.values(knownPhotoPaths.get(id) || {}))
        ]);
        knownPhotoPaths.clear();
        recordObjectUrls.forEach((urls) => urls.forEach(revokeObjectUrl));
        recordObjectUrls.clear();
        knownIds = new Set(records.map((record) => record.id));
        return records.map((record,index) => materializeRecord(record,stages[index].stored));
      },

      dispose() {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.clear();
        knownPhotoPaths.clear();
        recordObjectUrls.clear();
        knownIds.clear();
      }
    };
  }

  return { createLocalStorageRepository, createSupabaseRepository };
});
