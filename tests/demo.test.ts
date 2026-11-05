import { afterEach, describe, expect, it } from "vitest";
import { FeldbuchDB, ownData } from "@/lib/local/db";
import {
  DEMO_DATABASE,
  DEMO_OWNER,
  appPath,
  demoMode,
  isDemoPath,
  sectionPath,
} from "@/lib/demo/mode";
import {
  DEMO_PHOTOS,
  demoBook,
  demoEntries,
  demoMedia,
  demoPeriods,
  demoPreferences,
  demoProfile,
  demoVersion,
} from "@/lib/demo/data";
import { seedDemo } from "@/lib/demo/seed";
import {
  bookSchema,
  bookVersionSchema,
  entrySchema,
  mediaSchema,
  periodSchema,
  preferencesSchema,
  profileSchema,
} from "@/lib/domain/models";
import { inPeriod } from "@/lib/domain/dates";
import { demoRecords } from "./fixtures/notebook";

const opened: FeldbuchDB[] = [];
afterEach(async () => {
  for (const database of opened.splice(0)) {
    database.close();
    await database.delete();
  }
});
const open = (name: string) => {
  const database = new FeldbuchDB(name);
  opened.push(database);
  return database;
};
const photo = async () => new Blob(["demo"], { type: "image/jpeg" });

describe("demo routing", () => {
  it("recognises only /demo paths and maps app paths into the demo", () => {
    expect(isDemoPath("/demo")).toBe(true);
    expect(isDemoPath("/demo/calendar")).toBe(true);
    expect(isDemoPath("/demonstration")).toBe(false);
    expect(isDemoPath("/")).toBe(false);
    expect(appPath("/", true)).toBe("/demo");
    expect(appPath("/profile", true)).toBe("/demo/profile");
    expect(appPath("/profile", false)).toBe("/profile");
    expect(sectionPath("/demo", true)).toBe("/");
    expect(sectionPath("/demo/statistics", true)).toBe("/statistics");
    expect(sectionPath("/statistics", false)).toBe("/statistics");
  });
  it("is off outside the browser, so the regular app keeps its database", () => {
    expect(demoMode).toBe(false);
  });
});

describe("demo data", () => {
  it("matches the app's schemas", () => {
    profileSchema.parse(demoProfile);
    demoPeriods.forEach((p) => periodSchema.parse(p));
    demoEntries.forEach((e) => entrySchema.parse(e));
    demoMedia.forEach(({ file: _file, ...m }) => mediaSchema.parse(m));
    bookSchema.parse(demoBook);
    bookVersionSchema.parse(demoVersion);
    preferencesSchema.parse(demoPreferences);
  });
  it("is complete enough to show the main features", () => {
    const rs = demoPeriods.find((p) => p.type === "RS")!;
    expect(demoPeriods.some((p) => p.type === "WK")).toBe(true);
    expect(demoEntries.length).toBeGreaterThanOrEqual(15);
    expect(demoEntries.filter((e) => e.milestone).length).toBeGreaterThan(3);
    expect(demoEntries.some((e) => e.media_ids.length > 1)).toBe(true);
    expect(new Set(demoEntries.map((e) => e.mood)).size).toBeGreaterThan(8);
    expect(demoPreferences.active_period_id).toBe(rs.id);
    for (const e of demoEntries) {
      const period = demoPeriods.find((p) => p.id === e.period_id)!;
      expect(inPeriod(e.date, period.start_date, period.end_date)).toBe(true);
    }
  });
  it("keeps every reference inside the demo notebook", () => {
    const ids = [
      demoProfile.id,
      ...demoPeriods.map((p) => p.id),
      ...demoEntries.map((e) => e.id),
      ...demoMedia.map((m) => m.id),
      demoBook.id,
      demoVersion.id,
    ];
    expect(new Set(ids.slice(1)).size).toBe(ids.length - 1);
    const media = new Set(demoMedia.map((m) => m.id));
    const entries = new Set(demoEntries.map((e) => e.id));
    for (const e of demoEntries) {
      e.media_ids.forEach((id) => expect(media.has(id)).toBe(true));
      expect(demoMedia.filter((m) => m.entry_id === e.id).length).toBe(
        e.media_ids.length,
      );
    }
    for (const item of demoBook.chapters.flatMap((c) => c.items)) {
      if (item.entry_id) expect(entries.has(item.entry_id)).toBe(true);
      item.media_ids.forEach((id) => expect(media.has(id)).toBe(true));
    }
    expect(
      demoBook.chapters.flatMap((c) => c.items.map((i) => i.kind)),
    ).toEqual(expect.arrayContaining(["entry", "text", "gallery"]));
    for (const record of [
      demoProfile,
      demoPreferences,
      demoBook,
      demoVersion,
      ...demoPeriods,
      ...demoEntries,
      ...demoMedia,
    ])
      expect(record.owner_id).toBe(DEMO_OWNER);
    expect(demoMedia.every((m) => m.storage_path === null)).toBe(true);
    expect(DEMO_PHOTOS.map(([file]) => file)).toEqual(
      expect.arrayContaining([...new Set(demoMedia.map((m) => m.file))]),
    );
  });
  it("contains no contact data, credentials or public visibility", () => {
    const text = JSON.stringify([
      demoProfile,
      demoPeriods,
      demoEntries,
      demoBook,
    ]);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/\+41|\b756\.\d{4}/);
    expect(text).not.toMatch(/passwor|token|secret/i);
    expect(demoProfile.unit).toMatch(/fiktiv/);
    expect(demoProfile.discoverable).toBe(false);
    expect(demoEntries.every((e) => e.visibility === "private")).toBe(true);
  });
});

describe("demo database", () => {
  it("refuses to seed any database other than the demo database", async () => {
    const personal = open("feldbuch-v1");
    await expect(seedDemo(personal, photo)).rejects.toThrow(/Demo-Datenbank/);
    expect(await personal.profiles.count()).toBe(0);
  });
  it("seeds the isolated demo database and leaves the personal notebook untouched", async () => {
    const personal = open("feldbuch-v1"),
      demo = open(DEMO_DATABASE);
    const own = demoRecords(crypto.randomUUID());
    await personal.profiles.put(own.profile);
    await personal.diary_entries.bulkPut(own.entries);
    await seedDemo(demo, photo);
    const data = await ownData(DEMO_OWNER, demo);
    expect(data.profiles).toHaveLength(1);
    expect(data.service_periods).toHaveLength(demoPeriods.length);
    expect(data.diary_entries).toHaveLength(demoEntries.length);
    expect(data.entry_media).toHaveLength(demoMedia.length);
    expect(data.entry_media.every((m) => m.blob instanceof Blob)).toBe(true);
    expect(data.books).toHaveLength(1);
    expect(data.book_versions).toHaveLength(1);
    expect(await demo.operations.count()).toBe(0);
    expect(await personal.profiles.get(own.profile.id)).toEqual(own.profile);
    expect(await personal.diary_entries.count()).toBe(own.entries.length);
    expect(await personal.profiles.get(DEMO_OWNER)).toBeUndefined();
  });
  it("resets visitor changes and survives missing photos", async () => {
    const demo = open(DEMO_DATABASE);
    await seedDemo(demo, photo);
    await demo.diary_entries.put({
      ...demoEntries[0],
      id: crypto.randomUUID(),
      subtitle: "Von Besuchenden geschrieben",
    });
    await demo.diary_entries.delete(demoEntries[1].id);
    await seedDemo(demo, async () => undefined);
    const entries = await demo.diary_entries.toArray();
    expect(entries).toHaveLength(demoEntries.length);
    expect(entries.some((e) => e.subtitle.startsWith("Von Besuchenden"))).toBe(
      false,
    );
    expect((await demo.entry_media.toArray()).every((m) => !m.blob)).toBe(true);
  });
});
