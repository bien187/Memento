import { afterEach, describe, it, expect } from "vitest";
import { FeldbuchDB } from "@/lib/local/db";
import { removeRetiredDemo } from "@/lib/local/retired-demo";
import { demoRecords } from "./fixtures/notebook";

const databases: FeldbuchDB[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});
function fixture() {
  const database = new FeldbuchDB(crypto.randomUUID());
  databases.push(database);
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  return { database, values, storage };
}
describe("retired example account cleanup", () => {
  it("removes only the marked example owner's records and identity", async () => {
    const { database, values, storage } = fixture();
    const demo = demoRecords(crypto.randomUUID()),
      personal = demoRecords(crypto.randomUUID());
    values.set(
      "feldbuch.identity",
      JSON.stringify({ id: demo.profile.id, mode: "demo" }),
    );
    values.set("feldbuch.demo-id", demo.profile.id);
    values.set("feldbuch.local-id", personal.profile.id);
    await database.profiles.bulkPut([demo.profile, personal.profile]);
    await database.service_periods.bulkPut([demo.period, personal.period]);
    await database.diary_entries.bulkPut([
      ...demo.entries,
      ...personal.entries,
    ]);
    await database.drafts.put({
      id: crypto.randomUUID(),
      owner_id: demo.profile.id,
      data: demo.entries[0],
      updated_at: new Date().toISOString(),
    });
    await removeRetiredDemo(storage, database);
    expect(await database.profiles.get(demo.profile.id)).toBeUndefined();
    expect(await database.drafts.count()).toBe(0);
    expect(await database.diary_entries.count()).toBe(35);
    expect(await database.profiles.get(personal.profile.id)).toEqual(
      personal.profile,
    );
    expect(storage.getItem("feldbuch.identity")).toBeNull();
    expect(storage.getItem("feldbuch.demo-id")).toBeNull();
    expect(storage.getItem("feldbuch.local-id")).toBe(personal.profile.id);
  });
  it("preserves cloud and personal identities even if a stale demo key refers to them", async () => {
    for (const mode of ["cloud", "local"] as const) {
      const { database, values, storage } = fixture();
      const personal = demoRecords(crypto.randomUUID());
      values.set(
        "feldbuch.identity",
        JSON.stringify({ id: personal.profile.id, mode }),
      );
      values.set("feldbuch.demo-id", personal.profile.id);
      if (mode === "local")
        values.set("feldbuch.local-id", personal.profile.id);
      await database.profiles.put(personal.profile);
      await removeRetiredDemo(storage, database);
      expect(await database.profiles.get(personal.profile.id)).toEqual(
        personal.profile,
      );
      expect(JSON.parse(storage.getItem("feldbuch.identity")!).mode).toBe(mode);
    }
  });
  it("ignores invalid legacy identifiers without deleting an unrelated notebook", async () => {
    const { database, values, storage } = fixture();
    const personal = demoRecords(crypto.randomUUID());
    await database.profiles.put(personal.profile);
    values.set("feldbuch.demo-id", "not-a-user-id");
    values.set("feldbuch.identity", "invalid json");
    await removeRetiredDemo(storage, database);
    expect(await database.profiles.count()).toBe(1);
    expect(storage.getItem("feldbuch.demo-id")).toBeNull();
  });
});
