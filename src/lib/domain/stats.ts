import type { Entry } from "./models";
import { serviceWeek } from "./dates";
export function average(values: (number | null)[]) {
  const known = values.filter((v): v is number => v !== null);
  return known.length
    ? Math.round(known.reduce((a, b) => a + b, 0) / known.length)
    : null;
}
export function statistics(entries: Entry[], start: string) {
  const weeks = new Map<number, Entry[]>();
  entries.forEach((e) => {
    const w = serviceWeek(start, e.date);
    weeks.set(w, [...(weeks.get(w) ?? []), e]);
  });
  return {
    count: entries.length,
    days: new Set(entries.map((e) => e.date)).size,
    milestones: entries.filter((e) => e.milestone).length,
    mood: average(entries.map((e) => e.mood)),
    condition: average(entries.map((e) => e.condition)),
    weeks: [...weeks]
      .sort((a, b) => a[0] - b[0])
      .map(([week, items]) => ({
        label: `W${week}`,
        mood: average(items.map((e) => e.mood)),
        condition: average(items.map((e) => e.condition)),
      })),
  };
}
