(function exposeCalculator(root, factory) {
  const calculator = factory();
  if (typeof module === "object" && module.exports) module.exports = calculator;
  if (root) root.HoursCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCalculator() {
  function toMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function toClock(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  }

  function duration(minutes) {
    const value = Math.abs(minutes);
    return `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, "0")}min`;
  }

  function signed(minutes) {
    return `${minutes > 0 ? "+" : minutes < 0 ? "-" : ""}${duration(minutes)}`;
  }

  function calculate(record, targetMinutes) {
    if (record.type === "falta") return { worked: 0, balance: -targetMinutes };
    if (record.type !== "trabalho") return { worked: 0, balance: 0 };
    let end = toMinutes(record.end);
    const start = toMinutes(record.start);
    if (end <= start) end += 1440;
    const worked = end - start - Number(record.break);
    return { worked, balance: worked - targetMinutes };
  }

  function summarize(records, targetMinutes) {
    return records.reduce((total, record) => {
      const result = calculate(record, targetMinutes);
      total.worked += result.worked;
      total.balance += result.balance;
      if (result.balance > 0) total.positive += result.balance;
      if (result.balance < 0) total.negative += result.balance;
      return total;
    }, { worked: 0, balance: 0, positive: 0, negative: 0 });
  }

  return { toMinutes, toClock, duration, signed, calculate, summarize };
});
