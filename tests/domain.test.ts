import { describe, it, expect } from "vitest";
import {
  today,
  serviceDay,
  serviceWeek,
  addDays,
  dayNumber,
  entryTitle,
  monthDays,
} from "@/lib/domain/dates";
import { average, statistics } from "@/lib/domain/stats";
import { entrySchema } from "@/lib/domain/models";
import { demoRecords } from "@/lib/local/demo";
describe("Swiss calendar dates", () => {
  it("starts on day one and changes week after seven calendar days", () => {
    expect(serviceDay("2026-01-12", "2026-01-12")).toBe(1);
    expect(serviceWeek("2026-01-12", "2026-01-18")).toBe(1);
    expect(serviceWeek("2026-01-12", "2026-01-19")).toBe(2);
  });
  it("does not drift over DST changes or leap days", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(serviceDay("2026-10-24", "2026-10-26")).toBe(3);
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(() => dayNumber("2026-02-29")).toThrow();
  });
  it("uses Zurich rather than the UTC date", () => {
    expect(today(new Date("2026-06-20T22:30:00Z"))).toBe("2026-06-21");
    expect(today(new Date("2026-12-20T23:30:00Z"))).toBe("2026-12-21");
  });
  it("recalculates labels from the current start date", () => {
    expect(entryTitle("2026-03-09", "2025-12-22")).toBe(
      "Montag, Woche 12 (09.03.)",
    );
    expect(serviceWeek("2026-03-02", "2026-03-09")).toBe(2);
    expect(monthDays("2026-03")).toHaveLength(42);
  });
});
describe("entry validation and statistics", () => {
  const { entries } = demoRecords(crypto.randomUUID());
  const entry = entries[0];
  it("allows no photos and optional independent assessments", () => {
    expect(
      entrySchema.parse({ ...entry, mood: null, condition: 0 }).condition,
    ).toBe(0);
    expect(entrySchema.safeParse({ ...entry, media_ids: [] }).success).toBe(
      true,
    );
  });
  it("rejects five photos, fractional or out-of-range assessments and foreign covers", () => {
    expect(
      entrySchema.safeParse({
        ...entry,
        media_ids: Array.from({ length: 5 }, () => crypto.randomUUID()),
      }).success,
    ).toBe(false);
    for (const mood of [-1, 101, 1.5])
      expect(entrySchema.safeParse({ ...entry, mood }).success).toBe(false);
    expect(
      entrySchema.safeParse({ ...entry, cover_id: crypto.randomUUID() })
        .success,
    ).toBe(false);
  });
  it("never converts a missing assessment into zero", () => {
    expect(average([null, null])).toBeNull();
    expect(average([null, 0, 100])).toBe(50);
    const s = statistics(
      [
        { ...entry, mood: 80, condition: null },
        { ...entry, id: crypto.randomUUID(), mood: null, condition: 0 },
      ],
      entry.date,
    );
    expect(s.mood).toBe(80);
    expect(s.condition).toBe(0);
    expect(s.days).toBe(1);
  });
});
