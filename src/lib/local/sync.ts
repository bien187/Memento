import { db, type Operation, type FeldbuchDB } from "./db";
import { supabase } from "../supabase/browser";
import { z } from "zod";
import { parseEntity, mediaSchema, itemSchema } from "../domain/models";
import type { Entity, EntityTable } from "../domain/models";
import { message } from "../utils";
import { uploadPrivateBlob } from "./upload";
const running = new Map<string, Promise<void>>();
export async function acceptSync(
  op: Operation,
  result: unknown,
  database: FeldbuchDB = db,
) {
  const record = parseEntity(op.table, result);
  await database.transaction(
    "rw",
    database.table(op.table),
    database.operations,
    async () => {
      const pending = await database.operations
        .where("[table+entity_id]")
        .equals([op.table, op.entity_id])
        .first();
      const local = await database.table(op.table).get(op.entity_id);
      if (pending?.id === op.id) {
        await database
          .table(op.table)
          .put({ ...record, ...(local?.blob ? { blob: local.blob } : {}) });
        await database.operations.delete(op.id);
      } else if (pending && "version" in record) {
        const extra =
          op.table === "entry_media" && "storage_path" in record
            ? { storage_path: record.storage_path }
            : op.table === "diary_entries" && "created_at" in record
              ? { created_at: record.created_at }
              : {};
        await database.operations.update(pending.id, {
          base_version: record.version,
          payload: parseEntity(op.table, {
            ...pending.payload,
            ...extra,
            version: record.version,
          }),
        });
        await database
          .table(op.table)
          .put({ ...local, ...extra, version: record.version });
      }
    },
  );
}
export async function mergeRemote(
  table: EntityTable,
  records: unknown[],
  database: FeldbuchDB = db,
) {
  // Validate the complete batch before writing any remote records.
  const validated = records.map((record) => parseEntity(table, record));
  await database.transaction(
    "rw",
    database.table(table),
    database.operations,
    async () => {
      for (const record of validated) {
        const pending = await database.operations
          .where("[table+entity_id]")
          .equals([table, record.id])
          .first();
        if (pending) continue;
        const local = await database.table(table).get(record.id);
        if (!local || !("version" in record) || record.version >= local.version)
          await database
            .table(table)
            .put({ ...record, ...(local?.blob ? { blob: local.blob } : {}) });
      }
    },
  );
}
export function syncPayload(table: EntityTable, value: Entity) {
  const record = parseEntity(table, value);
  if (!("updated_at" in record)) return record;
  const { updated_at: _, ...mutable } = record;
  if (table === "diary_entries" && "created_at" in mutable) {
    const { created_at: __, ...input } = mutable;
    return input;
  }
  return mutable;
}
const responseSchema = z.object({
  conflict: z.boolean().optional(),
  record: z.unknown(),
});
const remoteChapterSchema = z.object({
  id: z.uuid(),
  book_id: z.uuid(),
  title: z.string().max(160),
  position: z.number().int().nonnegative(),
  book_items: z.array(
    itemSchema.extend({ position: z.number().int().nonnegative() }),
  ),
});
async function syncWork(owner: string) {
  const client = supabase();
  const operations = await db.operations
    .where("owner_id")
    .equals(owner)
    .toArray();
  const order: EntityTable[] = [
    "profiles",
    "user_preferences",
    "service_periods",
    "diary_entries",
    "entry_media",
    "books",
    "book_versions",
  ];
  for (const op of operations.sort(
    (a, b) =>
      (a.table === "diary_entries" &&
      "deleted_at" in a.payload &&
      a.payload.deleted_at
        ? -1
        : order.indexOf(a.table)) -
      (b.table === "diary_entries" &&
      "deleted_at" in b.payload &&
      b.payload.deleted_at
        ? -1
        : order.indexOf(b.table)),
  )) {
    if (op.status !== "pending" || op.next_at > Date.now()) continue;
    try {
      let payload = syncPayload(op.table, op.payload);
      if (op.table === "entry_media") {
        const media = mediaSchema.parse(op.payload);
        const local = await db.entry_media.get(media.id);
        if (!media.storage_path && local?.blob) {
          const path = `${owner}/${media.id}.${media.mime.split("/")[1]}`;
          await uploadPrivateBlob(path, local.blob, (progress) => {
            void db.operations.update(op.id, { progress }).catch(() => {});
          });
          payload = syncPayload(op.table, { ...media, storage_path: path });
        }
      }
      const { data, error } = await client.rpc("sync_entity", {
        entity_table: op.table,
        payload,
        expected_version: op.base_version,
        operation_id: op.id,
      });
      if (error) throw error;
      const response = responseSchema.parse(data);
      if (response.conflict) {
        const latest = await db.operations
          .where("[table+entity_id]")
          .equals([op.table, op.entity_id])
          .first();
        if (latest)
          await db.operations.update(latest.id, {
            status: "conflict",
            remote:
              response.record === null
                ? undefined
                : parseEntity(op.table, response.record),
            error: "Dieser Datensatz wurde auf einem anderen Gerät geändert.",
            source: "server",
          });
        continue;
      }
      await acceptSync(op, parseEntity(op.table, response.record));
    } catch (error) {
      const attempts = op.attempts + 1;
      await db.operations.update(op.id, {
        attempts,
        next_at: Date.now() + Math.min(300000, 2000 * 2 ** attempts),
        error: message(error),
        status: attempts >= 8 ? "error" : "pending",
      });
    }
  }
  for (const table of order) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("owner_id", owner);
    if (error) throw error;
    if (table === "books") {
      const { data: chapters, error: ce } = await client
        .from("book_chapters")
        .select("*,book_items(*)")
        .eq("owner_id", owner);
      if (ce) throw ce;
      const remoteChapters = z.array(remoteChapterSchema).parse(chapters ?? []);
      const books = z
        .array(z.record(z.string(), z.unknown()))
        .parse(data ?? []);
      await mergeRemote(
        table,
        books.map((b) => ({
          ...b,
          chapters: remoteChapters
            .filter((c) => c.book_id === b.id)
            .sort((a, b) => a.position - b.position)
            .map((c) => ({
              id: c.id,
              title: c.title,
              items: c.book_items
                .sort((a, b) => a.position - b.position)
                .map((i) => ({
                  id: i.id,
                  kind: i.kind,
                  entry_id: i.entry_id,
                  title: i.title,
                  text: i.text,
                  media_ids: i.media_ids,
                })),
            })),
        })),
      );
    } else await mergeRemote(table, data ?? []);
  }
}
async function drainSync(owner: string) {
  // Edits queued while an RPC is in flight are processed in the same refresh.
  // Future retries and conflicts must never cause an immediate retry loop.
  for (let pass = 0; pass < 5 && navigator.onLine; pass++) {
    await syncWork(owner);
    const due = await db.operations
      .where("owner_id")
      .equals(owner)
      .filter((op) => op.status === "pending" && op.next_at <= Date.now())
      .count();
    if (!due) return;
  }
}
export async function sync(owner: string) {
  if (!navigator.onLine) return;
  const existing = running.get(owner);
  if (existing) return existing;
  const work = (
    navigator.locks
      ? navigator.locks.request(`feldbuch-sync-${owner}`, () =>
          drainSync(owner),
        )
      : drainSync(owner)
  ).finally(() => running.delete(owner));
  running.set(owner, work);
  return work;
}
export async function resolveConflict(
  op: Operation,
  choice: "local" | "remote",
  mode: "cloud" | "local" = "cloud",
) {
  if (choice === "remote") {
    await db.transaction("rw", db.table(op.table), db.operations, async () => {
      if (op.remote) await db.table(op.table).put(op.remote);
      else await db.table(op.table).delete(op.entity_id);
      await db.operations.delete(op.id);
    });
  } else {
    if (mode !== "cloud") {
      await db.operations.delete(op.id);
      return;
    }
    const version = op.remote && "version" in op.remote ? op.remote.version : 0;
    await db.operations.update(op.id, {
      base_version: version,
      status: "pending",
      attempts: 0,
      next_at: 0,
      error: undefined,
    });
  }
}
