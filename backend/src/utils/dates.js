/** Returns "YYYY-MM-DD" for a Date, in UTC. */
function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

/** Returns today's date at UTC midnight (a Date object). */
function todayUtcMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Number of days in a "YYYY-MM" month string. */
function daysInMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Builds a UTC-midnight Date for the given "YYYY-MM" month + day-of-month. */
function dateForMonthDay(monthStr, day) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Current server local time as "HH:mm" (zero-padded, 24h). */
function currentLocalHHmm() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

module.exports = { toDateOnlyString, todayUtcMidnight, daysInMonth, dateForMonthDay, currentLocalHHmm };
