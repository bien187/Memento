import { describe, it, expect, afterEach } from "vitest";
import { FeldbuchDB, saveEntity } from "@/lib/local/db";
import { acceptSync, mergeRemote } from "@/lib/local/sync";
import { demoRecords } from "@/lib/local/demo";
const databases: FeldbuchDB[] = [];
const setup = () => {
  const database = new FeldbuchDB(`test-${crypto.randomUUID()}`);
  databases.push(database);
  const { entries } = demoRecords(crypto.randomUUID());
  return { database, entry: entries[0] };
};
afterEach(async () => {
  for (const database of databases) await database.delete();
  databases.length = 0;
});
describe("durable offline operations", () => {
  it("atomically saves the entry and coalesces changes without losing the base version", async () => {
    const { database, entry } = setup();
    await saveEntity("diary_entries", entry, "cloud", database);
    await saveEntity(
      "diary_entries",
      { ...entry, content: "neu" },
      "cloud",
      database,
    );
    expect(await database.diary_entries.count()).toBe(1);
    expect(await database.operations.count()).toBe(1);
    const op = (await database.operations.toArray())[0];
    expect(op.base_version).toBe(0);
    expect("content" in op.payload && op.payload.content).toBe("neu");
  });
  it("keeps pending edits during a remote refresh", async () => {
    const { database, entry } = setup();
    await saveEntity("diary_entries", entry, "cloud", database);
    await mergeRemote(
      "diary_entries",
      [{ ...entry, content: "remote", version: 5 }],
      database,
    );
    expect((await database.diary_entries.get(entry.id))?.content).toBe(
      entry.content,
    );
  });
  it("acknowledges the saved revision while retaining newer typing", async () => {
    const { database, entry } = setup();
    await saveEntity("diary_entries", entry, "cloud", database);
    const sent = (await database.operations.toArray())[0];
    await saveEntity(
      "diary_entries",
      { ...entry, content: "newer typing" },
      "cloud",
      database,
    );
    await acceptSync(sent, { ...entry, version: 1 }, database);
    expect((await database.diary_entries.get(entry.id))?.content).toBe(
      "newer typing",
    );
    expect((await database.operations.toArray())[0].base_version).toBe(1);
    const next = (await database.operations.toArray())[0];
    await acceptSync(
      next,
      { ...entry, content: "newer typing", version: 2 },
      database,
    );
    expect(await database.operations.count()).toBe(0);
    expect((await database.diary_entries.get(entry.id))?.version).toBe(2);
  });
  it("keeps different owners in separate query results", async () => {
    const { database, entry } = setup();
    await saveEntity("diary_entries", entry, "local", database);
    const other = {
      ...entry,
      id: crypto.randomUUID(),
      owner_id: crypto.randomUUID(),
    };
    await saveEntity("diary_entries", other, "local", database);
    expect(
      await database.diary_entries
        .where("owner_id")
        .equals(entry.owner_id)
        .count(),
    ).toBe(1);
    expect(await database.operations.count()).toBe(0);
  });
});

testLocalCollision();
function testLocalCollision() {
  it("preserves both versions when another tab changes an open editor", async () => {
    const { database, entry } = setup();
    await saveEntity("diary_entries", entry, "local", database);
    await saveEntity(
      "diary_entries",
      { ...entry, content: "other tab" },
      "local",
      database,
    );
    await saveEntity(
      "diary_entries",
      { ...entry, content: "my unfinished draft" },
      "local",
      database,
      entry,
    );
    const op = (await database.operations.toArray())[0];
    expect(op.status).toBe("conflict");
    expect(op.source).toBe("device");
    expect(op.remote && "content" in op.remote && op.remote.content).toBe(
      "other tab",
    );
    expect((await database.diary_entries.get(entry.id))?.content).toBe(
      "my unfinished draft",
    );
  });
}
