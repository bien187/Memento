import { afterEach, describe, it, expect } from "vitest";
import { db, ownData } from "@/lib/local/db";
import { demoRecords } from "@/lib/local/demo";
import { defaultPreferences } from "@/lib/domain/models";
import {
  backupSchema,
  validateRelations,
  importBackup,
  inspectBackup,
  exportBackup,
  type Backup,
} from "@/lib/backup";
const owner = crypto.randomUUID();
function fixture(): Backup {
  const f = demoRecords(owner);
  return {
    format: "feldbuch",
    schema_version: 1,
    exported_at: new Date().toISOString(),
    owner_id: owner,
    data: {
      profiles: [f.profile],
      service_periods: [f.period],
      diary_entries: f.entries,
      books: [f.book],
      book_versions: [f.version],
      entry_media: [],
      user_preferences: [
        { ...defaultPreferences(owner), active_period_id: f.period.id },
      ],
    },
  };
}
afterEach(async () => {
  for (const table of db.tables) await table.clear();
});
describe("versioned private backups", () => {
  it("rejects unknown schema versions and foreign owners", () => {
    const data = fixture();
    expect(
      backupSchema.safeParse({ ...data, schema_version: 99 }).success,
    ).toBe(false);
    data.data.diary_entries[0].owner_id = crypto.randomUUID();
    expect(() => validateRelations(data)).toThrow(/fremde/);
  });
  it("validates all parent references before import", () => {
    const data = fixture();
    data.data.diary_entries[0].period_id = crypto.randomUUID();
    expect(() => validateRelations(data)).toThrow(/Eintragsverknüpfung/);
  });
  it("remaps accounts deterministically while preserving military catalog IDs and privacy", async () => {
    const data = fixture(),
      target = crypto.randomUUID();
    await importBackup(
      { backup: data, blobs: new Map(), duplicates: 0 },
      target,
      "local",
      "merge",
    );
    const first = await ownData(target);
    expect(first.profiles[0].rank_id).toBe("soldat");
    expect(first.profiles[0].function_id).toBe("infanterist");
    expect(first.service_periods[0].branch_id).toBe("infanterie");
    expect(first.diary_entries).toHaveLength(35);
    expect(first.diary_entries.every((e) => e.visibility === "private")).toBe(
      true,
    );
    expect(first.diary_entries[0].period_id).toBe(first.service_periods[0].id);
    await importBackup(
      { backup: data, blobs: new Map(), duplicates: 0 },
      target,
      "local",
      "merge",
    );
    expect((await ownData(target)).diary_entries).toHaveLength(35);
  });
  it("roundtrips JSON and ZIP without overwriting existing versions", async () => {
    const data = fixture();
    await importBackup(
      { backup: data, blobs: new Map(), duplicates: 0 },
      owner,
      "local",
      "merge",
    );
    const original = (await db.book_versions.toArray())[0];
    for (const zip of [false, true]) {
      const blob = await exportBackup(owner, zip);
      const file = new File(
        [await blob.arrayBuffer()],
        zip ? "backup.zip" : "backup.json",
      );
      const inspected = await inspectBackup(file, owner);
      expect(inspected.duplicates).toBe(35);
      await importBackup(inspected, owner, "local", "restore");
      expect((await db.book_versions.get(original.id))?.snapshot).toEqual(
        original.snapshot,
      );
    }
    expect(
      (await ownData(owner)).diary_entries.filter((e) => !e.deleted_at),
    ).toHaveLength(35);
  });
});
