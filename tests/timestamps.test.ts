import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  entryInputSchema,
  entrySchema,
  timestampSchema,
  bookVersionSchema,
} from "@/lib/domain/models";
import { db, FeldbuchDB, saveEntity } from "@/lib/local/db";
import { acceptSync, mergeRemote, sync, syncPayload } from "@/lib/local/sync";
import { message } from "@/lib/utils";
import { demoRecords } from "./fixtures/notebook";

const cloud = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({
  supabase: () => ({
    rpc: cloud.rpc,
    from: () => ({
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
    }),
  }),
}));
const databases: FeldbuchDB[] = [];
const setup = () => {
  const database = new FeldbuchDB(`timestamps-${crypto.randomUUID()}`);
  databases.push(database);
  return { database, ...demoRecords(crypto.randomUUID()) };
};
afterEach(async () => {
  for (const database of databases) await database.delete();
  databases.length = 0;
  for (const table of db.tables) await table.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cloud.rpc.mockReset();
});

describe("entry metadata and form validation", () => {
  it("drains edits queued while the first RPC is in flight", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const { entries } = demoRecords(crypto.randomUUID());
    const entry = entries[0];
    await saveEntity("diary_entries", entry, "cloud");
    const created_at = "2026-10-25T09:00:00+00:00";
    cloud.rpc.mockImplementationOnce(async () => {
      await saveEntity(
        "diary_entries",
        { ...entry, content: "Während Anfrage ergänzt" },
        "cloud",
      );
      void sync(entry.owner_id);
      return {
        data: { record: { ...entry, version: 1, created_at } },
        error: null,
      };
    });
    cloud.rpc.mockResolvedValueOnce({
      data: {
        record: {
          ...entry,
          content: "Während Anfrage ergänzt",
          version: 2,
          created_at,
        },
      },
      error: null,
    });
    await sync(entry.owner_id);
    expect(cloud.rpc).toHaveBeenCalledTimes(2);
    expect(cloud.rpc.mock.calls[1][1].expected_version).toBe(1);
    expect(await db.operations.count()).toBe(0);
    expect(await db.diary_entries.get(entry.id)).toMatchObject({
      content: "Während Anfrage ergänzt",
      version: 2,
      created_at,
    });
  });
  it("reproduces the old UTC-only rejection and accepts PostgreSQL offsets without losing precision", () => {
    const timestamp = "2026-10-25T09:30:00.123456+00:00";
    expect(z.iso.datetime().safeParse(timestamp).success).toBe(false);
    expect(timestampSchema.parse(timestamp)).toBe(timestamp);
    for (const value of ["2026-10-25T09:30:00Z", "2026-10-25T11:30:00+02:00"])
      expect(timestampSchema.safeParse(value).success).toBe(true);
  });
  it("rejects empty, absent, null, invalid Date, timezone-free and malformed timestamps", () => {
    const { entries } = setup();
    for (const invalid of [
      "",
      null,
      undefined,
      new Date("invalid"),
      "2026-10-25T09:30:00",
      "2026-02-30T09:30:00Z",
      "yesterday",
      "2026-10-25T25:00:00Z",
    ])
      for (const key of ["created_at", "updated_at"])
        expect(
          entrySchema.safeParse({ ...entries[0], [key]: invalid }).success,
        ).toBe(false);
  });
  it("validates content independently and supplies only optional content defaults", () => {
    const { period } = setup();
    const input = entryInputSchema.parse({
      period_id: period.id,
      date: period.start_date,
      content: "Ein Gedanke.",
    });
    expect(input).not.toHaveProperty("created_at");
    expect(input).not.toHaveProperty("updated_at");
    expect(input).toMatchObject({
      subtitle: "",
      mood: null,
      condition: null,
      milestone: false,
      media_ids: [],
      cover_id: null,
      visibility: "private",
    });
    expect(
      entryInputSchema.safeParse({ ...input, date: "2026-02-30" }).success,
    ).toBe(false);
  });
  it("creates and edits a local entry while retaining creation date, image selection and assessments", async () => {
    const { database, entries } = setup();
    const image = crypto.randomUUID();
    const entry = {
      ...entries[0],
      subtitle: "Mein Tag",
      mood: 0,
      condition: 100,
      milestone: true,
      media_ids: [image],
      cover_id: image,
      created_at: "2026-10-01T10:00:00+02:00",
    };
    const first = await saveEntity("diary_entries", entry, "local", database);
    const second = await saveEntity(
      "diary_entries",
      { ...first, subtitle: "Ergänzt", created_at: "2000-01-01T00:00:00Z" },
      "local",
      database,
    );
    expect(second.created_at).toBe(entry.created_at);
    expect(second.date).toBe(entry.date);
    expect(second).toMatchObject({
      subtitle: "Ergänzt",
      mood: 0,
      condition: 100,
      milestone: true,
      media_ids: [image],
      cover_id: image,
    });
    expect(timestampSchema.safeParse(second.updated_at).success).toBe(true);
    expect((await database.diary_entries.get(entry.id))?.subtitle).toBe(
      "Ergänzt",
    );
  });
  it("omits mutable technical timestamps from cloud input while preserving published snapshots", () => {
    const { entries, version } = setup();
    const payload = syncPayload("diary_entries", entries[0]);
    expect(payload).not.toHaveProperty("created_at");
    expect(payload).not.toHaveProperty("updated_at");
    expect(payload).toHaveProperty("date", entries[0].date);
    expect(
      bookVersionSchema.parse(syncPayload("book_versions", version)),
    ).toEqual(version);
  });
  it("rejects a malformed remote batch atomically and accepts offset records", async () => {
    const { database, entries } = setup();
    const remote = {
      ...entries[0],
      updated_at: "2026-10-25T09:00:00+00:00",
      created_at: "2026-10-25T09:00:00.123456+00:00",
    };
    await expect(
      mergeRemote(
        "diary_entries",
        [remote, { ...entries[1], created_at: "" }],
        database,
      ),
    ).rejects.toThrow();
    expect(await database.diary_entries.count()).toBe(0);
    await mergeRemote("diary_entries", [remote], database);
    expect((await database.diary_entries.get(remote.id))?.created_at).toBe(
      remote.created_at,
    );
  });
  it("logs validation details but shows a readable message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = timestampSchema.safeParse("");
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected invalid input");
    expect(message(result.error)).not.toMatch(/invalid_format|\[|ISO datetime/);
    expect(log).toHaveBeenCalled();
  });
  it("retains a saved entry after a network failure and retries the same operation successfully", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const { entries } = demoRecords(crypto.randomUUID());
    const entry = {
      ...entries[0],
      content: "Offline bleibt erhalten.",
      media_ids: [],
      cover_id: null,
    };
    await saveEntity("diary_entries", entry, "cloud");
    const operation = (await db.operations.toArray())[0];
    cloud.rpc.mockResolvedValueOnce({
      data: null,
      error: new TypeError("Failed to fetch"),
    });
    await sync(entry.owner_id);
    expect((await db.diary_entries.get(entry.id))?.content).toBe(entry.content);
    expect((await db.operations.get(operation.id))?.attempts).toBe(1);
    expect((await db.operations.get(operation.id))?.status).toBe("pending");
    await db.operations.update(operation.id, { next_at: 0 });
    const record = {
      ...entry,
      version: 1,
      created_at: "2026-10-25T09:00:00+00:00",
      updated_at: "2026-10-25T09:00:00+00:00",
    };
    cloud.rpc.mockResolvedValueOnce({ data: { record }, error: null });
    await sync(entry.owner_id);
    expect(await db.operations.count()).toBe(0);
    expect((await db.diary_entries.get(entry.id))?.version).toBe(1);
    expect(cloud.rpc.mock.calls[1][1].operation_id).toBe(operation.id);
    expect(cloud.rpc.mock.calls[1][1].payload).not.toHaveProperty("updated_at");
  });
  it("adopts the server creation instant without losing edits made during a request", async () => {
    const { database, entries } = setup();
    const entry = entries[0];
    await saveEntity("diary_entries", entry, "cloud", database);
    const sent = (await database.operations.toArray())[0];
    await saveEntity(
      "diary_entries",
      { ...entry, content: "Weitergeschrieben" },
      "cloud",
      database,
    );
    const created_at = "2026-10-25T09:00:00+00:00";
    await acceptSync(sent, { ...entry, version: 1, created_at }, database);
    const saved = await database.diary_entries.get(entry.id);
    expect(saved?.content).toBe("Weitergeschrieben");
    expect(saved?.created_at).toBe(created_at);
    expect((await database.operations.toArray())[0].payload).toHaveProperty(
      "created_at",
      created_at,
    );
  });
});
