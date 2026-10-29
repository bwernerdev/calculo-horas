// @ts-check
/** UMD: regras puras de calendário, pendências, previsão e evolução por ciclo (sem DOM). */
(function exposeInsights(/** @type {any} */ root, factory) {
  const insights = factory();
  if (typeof module === "object" && module.exports) module.exports = insights;
  if (root) root.HoursInsights = insights;
})(typeof globalThis !== "undefined" ? globalThis : this, function createInsights() {
  const MAX_DAYS = 400;

  /** @param {string} iso */
  function parse(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  /** @param {Date} date */
  function format(date) {
    return date.toISOString().slice(0, 10);
  }

  /** @param {string} iso @param {number} amount */
  function addDays(iso, amount) {
    const date = parse(iso);
    date.setUTCDate(date.getUTCDate() + amount);
    return format(date);
  }

  /** @param {string} iso 0 = domingo */
  function weekdayOf(iso) {
    return parse(iso).getUTCDay();
  }

  /** @param {string} iso */
  function isWorkday(iso) {
    const weekday = weekdayOf(iso);
    return weekday >= 1 && weekday <= 5;
  }

  /** @param {string} from @param {string} to */
  function datesBetween(from, to) {
    const dates = [];
    for (let day = from; day <= to && dates.length < MAX_DAYS; day = addDays(day, 1)) dates.push(day);
    return dates;
  }

  /** @param {number} minutes saldo em minutos, formato curto como +1:10 */
  function shortBalance(minutes) {
    const sign = minutes > 0 ? "+" : minutes < 0 ? "−" : "";
    const absolute = Math.abs(minutes);
    return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
  }

  /** Intervalo do ciclo anterior ao informado (ou null). */
  function previousRange(/** @type {{from:string,to:string}|null} */ range, /** @type {any} */ cycle) {
    if (!range) return null;
    return cycle.rangeForMonth(cycle.monthForDate(addDays(range.from, -1)));
  }

  /** Dias úteis passados sem registro. */
  function pendingWorkdays(/** @type {{from:string,to:string}} */ range, /** @type {Set<string>} */ recorded, /** @type {string} */ today) {
    return datesBetween(range.from, range.to).filter((date) => isWorkday(date) && date < today && !recorded.has(date));
  }

  /** Dias úteis de hoje até o fim do ciclo ainda sem registro. */
  function remainingWorkdays(/** @type {{from:string,to:string}} */ range, /** @type {Set<string>} */ recorded, /** @type {string} */ today) {
    if (range.to < today) return [];
    return datesBetween(range.from > today ? range.from : today, range.to).filter((date) => isWorkday(date) && !recorded.has(date));
  }

  /**
   * Quanto trabalhar por dia útil restante para fechar o ciclo em zero.
   * @param {{balance:number, remainingDays:number, targetMinutes:number, maxMinutes?:number}} input
   */
  function forecastToZero({ balance, remainingDays, targetMinutes, maxMinutes = 600 }) {
    if (!remainingDays || remainingDays < 1) return null;
    const deltaPerDay = Math.ceil(-balance / remainingDays);
    const workedPerDay = Math.max(0, targetMinutes + deltaPerDay);
    return { remainingDays, deltaPerDay, workedPerDay, exceedsLimit: workedPerDay > maxMinutes };
  }

  /**
   * Saldo por ciclo de fechamento, em ordem cronológica (até `count` ciclos).
   * @param {any[]} records
   * @param {(records:any[]) => number} balanceOf
   * @param {any} cycle
   * @param {number} count
   */
  function cycleBalances(records, balanceOf, cycle, count = 12) {
    /** @type {Map<string, any[]>} */
    const groups = new Map();
    for (const record of records) {
      const month = cycle.monthForDate(record.date);
      if (!month) continue;
      groups.set(month, [...(groups.get(month) || []), record]);
    }
    return [...groups.keys()].sort().slice(-count).map((month) => ({ month, days: groups.get(month)?.length || 0, balance: balanceOf(groups.get(month) || []) }));
  }

  /** Modelo do calendário: células em branco iniciais e dias com estado. */
  function calendarModel(/** @type {{from:string,to:string}} */ range, /** @type {Map<string, any>} */ byDate, /** @type {string} */ today) {
    const dates = datesBetween(range.from, range.to);
    const pending = new Set(pendingWorkdays(range, new Set(byDate.keys()), today));
    return {
      leadingBlanks: dates.length ? weekdayOf(dates[0]) : 0,
      days: dates.map((date) => ({
        date,
        day: Number(date.slice(8)),
        weekday: weekdayOf(date),
        isToday: date === today,
        pending: pending.has(date),
        record: byDate.get(date) || null,
      })),
    };
  }

  return { addDays, weekdayOf, isWorkday, datesBetween, shortBalance, previousRange, pendingWorkdays, remainingWorkdays, forecastToZero, cycleBalances, calendarModel };
});
