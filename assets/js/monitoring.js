(function initializeMonitoring(root) {
  const STORAGE_KEY = "controle-horas-erros-v1";
  const MAX_REPORTS = 20;
  const MAX_TEXT_LENGTH = 1200;
  let reporter;
  let flushing = false;

  function sanitizeText(value) {
    return String(value || "Erro desconhecido")
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
      .replace(/(?:Bearer\s+)?eyJ[A-Za-z0-9._-]+/g, "[token]")
      .replace(/([?&#](?:token|code|access_token|refresh_token)=)[^&#\s]+/gi, "$1[redacted]")
      .slice(0, MAX_TEXT_LENGTH);
  }

  function readQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.slice(-MAX_REPORTS) : [];
    } catch {
      return [];
    }
  }

  function writeQueue(queue) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_REPORTS))); } catch {}
  }

  function normalize(error, context = {}) {
    const source = typeof context.source === "string" ? context.source : "application";
    const safeContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (key === "source" || /email|password|photo|token|record/i.test(key)) continue;
      if (["string", "number", "boolean"].includes(typeof value)) safeContext[key] = sanitizeText(value);
    }
    return {
      event_id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      environment: root.APP_CONFIG?.environment || "unknown",
      app_version: root.APP_CONFIG?.version || "unknown",
      source: sanitizeText(source),
      message: sanitizeText(error?.message || error),
      stack: sanitizeText(error?.stack || ""),
      context: safeContext,
      occurred_at: new Date().toISOString(),
    };
  }

  async function flush() {
    if (!reporter || flushing || !navigator.onLine) return;
    flushing = true;
    const pending = readQueue();
    const remaining = [];
    for (const report of pending) {
      try { await reporter(report); } catch { remaining.push(report); }
    }
    writeQueue(remaining);
    flushing = false;
  }

  function capture(error, context) {
    const report = normalize(error, context);
    writeQueue([...readQueue(), report]);
    queueMicrotask(flush);
    return report.event_id;
  }

  root.addEventListener("error", (event) => capture(event.error || event.message, { source: "window.error" }));
  root.addEventListener("unhandledrejection", (event) => capture(event.reason, { source: "unhandledrejection" }));
  root.addEventListener("online", flush);

  root.AppMonitor = Object.freeze({
    capture,
    flush,
    setReporter(nextReporter) {
      reporter = typeof nextReporter === "function" ? nextReporter : undefined;
    },
    pendingCount: () => readQueue().length,
  });
})(window);
