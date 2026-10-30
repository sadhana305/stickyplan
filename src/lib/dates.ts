/** All date-only values are stored as "YYYY-MM-DD" strings in UTC to avoid timezone bugs. */

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0 = Sunday
}

export function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + "T00:00:00Z").getTime();
  const b = new Date(toStr + "T00:00:00Z").getTime();
  return Math.round((b - a) / (24 * 3600 * 1000));
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayName(weekday: number): string {
  return DAY_NAMES[weekday] ?? "";
}

export function prettyDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${DAY_NAMES[d.getUTCDay()].slice(0, 3)}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function relativeDay(dateStr: string): string {
  const diff = daysBetween(todayStr(), dateStr);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days ago`;
  if (diff < 7) return `In ${diff} days`;
  return prettyDate(dateStr);
}
