(function exposeTimeInput(root, factory) {
  const timeInput = factory();
  if (typeof module === "object" && module.exports) module.exports = timeInput;
  if (root) root.HoursTimeInput = timeInput;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTimeInput() {
  function normalizeClock(value) {
    const raw = String(value ?? "").trim();
    let hours, minutes;
    if (/^\d{1,2}$/.test(raw)) {
      hours = Number(raw); minutes = 0;
    } else if (/^\d{3,4}$/.test(raw)) {
      hours = Number(raw.slice(0, -2)); minutes = Number(raw.slice(-2));
    } else {
      const match = raw.match(/^(\d{1,2}):([0-5]\d)$/);
      if (!match) return null;
      hours = Number(match[1]); minutes = Number(match[2]);
    }
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function parseDuration(value) {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^(\d{1,4})(?::([0-5]\d))?$/);
    if (!match) return null;
    const total = Number(match[1]) * 60 + Number(match[2] || 0);
    return total <= 599999 ? total : null;
  }

  function formatDuration(value) {
    const minutes = parseDuration(value);
    if (minutes === null) return null;
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  }

  return { normalizeClock, parseDuration, formatDuration };
});
