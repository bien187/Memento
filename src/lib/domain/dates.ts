const DAY = 86_400_000;
export const ZONE = "Europe/Zurich";
export function today(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ungültiges Datum");
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.toISOString().slice(0, 10) !== value)
    throw new Error("Ungültiges Datum");
  return Math.floor(date.getTime() / DAY);
}
export function addDays(value: string, days: number) {
  return new Date((dayNumber(value) + days) * DAY).toISOString().slice(0, 10);
}
export function serviceDay(start: string, date: string) {
  return dayNumber(date) - dayNumber(start) + 1;
}
export function serviceWeek(start: string, date: string) {
  return Math.floor((serviceDay(start, date) - 1) / 7) + 1;
}
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat("de-CH", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(dayNumber(date) * DAY));
}
export function entryTitle(date: string, start: string) {
  return `${dateLabel(date, { weekday: "long" })}, Woche ${serviceWeek(start, date)} (${dateLabel(date, { day: "2-digit", month: "2-digit" })})`;
}
export function inPeriod(date: string, start: string, end: string) {
  return date >= start && date <= end;
}
export function monthDays(month: string) {
  const start = `${month}-01`;
  const weekday = (new Date(dayNumber(start) * DAY).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(start, i - weekday));
}
