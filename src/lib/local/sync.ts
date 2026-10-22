import { db, type Operation, type FeldbuchDB } from "./db";
import { supabase } from "../supabase/browser";
import type {
  Entity,
  EntityTable,
  Media,
  Book,
  Chapter,
  BookItem,
} from "../domain/models";
import { message } from "../utils";
import { uploadPrivateBlob } from "./upload";
const running = new Map<string, Promise<void>>();
export async function acceptSync(
  op: Operation,
  result: Entity,
  database: FeldbuchDB = db,
) {
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
          .put({ ...result, ...(local?.blob ? { blob: local.blob } : {}) });
        await database.operations.delete(op.id);
      } else if (pending && "version" in result) {
        const extra =
          op.table === "entry_media" && "storage_path" in result
            ? { storage_path: result.storage_path }
            : {};
        await database.operations.update(pending.id, {
          base_version: result.version,
          payload: {
            ...pending.payload,
            ...extra,
            version: result.version,
          } as Entity,
        });
        await database
          .table(op.table)
          .put({ ...local, ...extra, version: result.version });
      }
    },
  );
}
export async function mergeRemote(
  table: EntityTable,
  records: Entity[],
  database: FeldbuchDB = db,
) {
  await database.transaction(
    "rw",
    database.table(table),
    database.operations,
    async () => {
      for (const record of records) {
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
      let payload = op.payload;
      if (op.table === "entry_media") {
        const media = payload as Media;
        const local = await db.entry_media.get(media.id);
        if (!media.storage_path && local?.blob) {
          const path = `${owner}/${media.id}.${media.mime.split("/")[1]}`;
          await uploadPrivateBlob(path, local.blob, (progress) => {
            void db.operations.update(op.id, { progress }).catch(() => {});
          });
          payload = { ...media, storage_path: path };
        }
        const { blob: _, ...clean } = payload as Media;
        payload = clean;
      }
      const { data, error } = await client.rpc("sync_entity", {
        entity_table: op.table,
        payload,
        expected_version: op.base_version,
        operation_id: op.id,
      });
      if (error) throw error;
      if (data.conflict) {
        const latest = await db.operations
          .where("[table+entity_id]")
          .equals([op.table, op.entity_id])
          .first();
        if (latest)
          await db.operations.update(latest.id, {
            status: "conflict",
            remote: data.record,
            error: "Dieser Datensatz wurde auf einem anderen Gerät geändert.",
            source: "server",
          });
        continue;
      }
      await acceptSync(op, data.record);
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
      await mergeRemote(
        table,
        ((data ?? []) as Omit<Book, "chapters">[]).map((b) => ({
          ...b,
          chapters: (
            (chapters ?? []) as (Chapter & {
              book_id: string;
              position: number;
              book_items: (BookItem & { position: number })[];
            })[]
          )
            .filter((c) => c.book_id === b.id)
            .sort((a, b) => a.position - b.position)
            .map((c) => ({
              id: c.id,
              title: c.title,
              items: c.book_items
                .sort(
                  (a: { position: number }, b: { position: number }) =>
                    a.position - b.position,
                )
                .map((i: BookItem) => ({
                  id: i.id,
                  kind: i.kind,
                  entry_id: i.entry_id,
                  title: i.title,
                  text: i.text,
                  media_ids: i.media_ids,
                })),
            })),
        })) as Book[],
      );
    } else await mergeRemote(table, (data ?? []) as Entity[]);
  }
}
export async function sync(owner: string) {
  if (!navigator.onLine) return;
  const existing = running.get(owner);
  if (existing) return existing;
  const work = (
    navigator.locks
      ? navigator.locks.request(`feldbuch-sync-${owner}`, () => syncWork(owner))
      : syncWork(owner)
  ).finally(() => running.delete(owner));
  running.set(owner, work);
  return work;
}
export async function resolveConflict(
  op: Operation,
  choice: "local" | "remote",
  mode: "cloud" | "local" | "demo" = "cloud",
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
