// @ts-check
/** UMD: expõe o módulo como global no navegador e via module.exports no Node. */
(function (/** @type {any} */ root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HoursCycle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /**
   * @param {string} date AAAA-MM-DD
   * @returns {string|null} mês de fechamento AAAA-MM
   */
  function monthForDate(date) {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(date)) return null;
    let year = Number(date.slice(0, 4));
    let month = Number(date.slice(5, 7));
    if (Number(date.slice(8, 10)) >= 16) {
      month += 1;
      if (month === 13) { month = 1; year += 1; }
    }
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  }

  /**
   * @param {string} monthKey AAAA-MM
   * @returns {{from:string,to:string}|null} intervalo 16→15
   */
  function rangeForMonth(monthKey) {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(monthKey)) return null;
    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));
    const previousYear = month === 1 ? year - 1 : year;
    const previousMonth = month === 1 ? 12 : month - 1;
    return {
      from: `${String(previousYear).padStart(4, "0")}-${String(previousMonth).padStart(2, "0")}-16`,
      to: `${monthKey}-15`,
    };
  }

  return { monthForDate, rangeForMonth };
});
