import Dexie, { type Table } from "dexie";
import { DEMO_DATABASE, demoMode } from "../demo/mode";
import type {
  Profile,
  Period,
  Entry,
  Book,
  Preferences,
  Media,
  BookVersion,
  EntityTable,
  Entity,
} from "../domain/models";
export type Operation = {
  id: string;
  owner_id: string;
  table: EntityTable;
  entity_id: string;
  payload: Entity;
  base_version: number;
  attempts: number;
  next_at: number;
  status: "pending" | "conflict" | "error";
  error?: string;
  remote?: Entity;
  source?: "device" | "server";
  progress?: number;
};
export class FeldbuchDB extends Dexie {
  profiles!: Table<Profile>;
  service_periods!: Table<Period>;
  diary_entries!: Table<Entry>;
  books!: Table<Book>;
  user_preferences!: Table<Preferences>;
  entry_media!: Table<Media>;
  book_versions!: Table<BookVersion>;
  operations!: Table<Operation>;
  drafts!: Table<{
    id: string;
    owner_id: string;
    data: Entry;
    updated_at: string;
  }>;
  constructor(name = "feldbuch-v1") {
    super(name);
    this.version(1).stores({
      profiles: "id,owner_id",
      service_periods: "id,owner_id",
      diary_entries: "id,owner_id,period_id,date",
      books: "id,owner_id,period_id",
      user_preferences: "id,owner_id",
      entry_media: "id,owner_id,entry_id",
      book_versions: "id,owner_id,book_id",
      operations: "id,owner_id,[table+entity_id],status",
      drafts: "id,owner_id",
    });
  }
}
// The public demo (/demo) gets its own database and never opens the personal one.
export const db = new FeldbuchDB(demoMode ? DEMO_DATABASE : "feldbuch-v1");
export async function saveEntity<T extends Entity>(
  table: EntityTable,
  value: T,
  mode: "cloud" | "local",
  database = db,
  baseline?: Entity,
): Promise<T> {
  return database.transaction(
    "rw",
    database.table(table),
    database.operations,
    async () => {
      const old = (await database.table(table).get(value.id)) as
        Entity | undefined;
      const pending = await database.operations
        .where("[table+entity_id]")
        .equals([table, value.id])
        .first();
      const next = {
        ...value,
        ...("version" in value
          ? {
              version: old && "version" in old ? old.version : 0,
              updated_at: new Date().toISOString(),
            }
          : {}),
      } as T;
      const comparable = (record: unknown): unknown => {
        if (Array.isArray(record)) return record.map(comparable);
        if (!record || typeof record !== "object") return record;
        return Object.fromEntries(
          Object.entries(record)
            .filter(
              ([key]) =>
                !["version", "updated_at", "search_document", "blob"].includes(
                  key,
                ),
            )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [key, comparable(value)]),
        );
      };
      const collision = !!(
        old &&
        baseline &&
        JSON.stringify(comparable(old)) !== JSON.stringify(comparable(baseline))
      );
      await database.table(table).put(next);
      if (mode === "cloud" || collision || pending?.status === "conflict") {
        await database.operations
          .where("[table+entity_id]")
          .equals([table, value.id])
          .delete();
        await database.operations.put({
          id: crypto.randomUUID(),
          owner_id: value.owner_id,
          table,
          entity_id: value.id,
          payload: next,
          base_version:
            pending?.base_version ??
            (old && "version" in old ? old.version : 0),
          attempts: 0,
          next_at: 0,
          status:
            collision || pending?.status === "conflict"
              ? "conflict"
              : "pending",
          remote: collision ? old : pending?.remote,
          error: collision
            ? "Dieser Inhalt wurde während des Schreibens auf diesem Gerät geändert. Beide Fassungen bleiben erhalten."
            : pending?.error,
          source: collision ? "device" : pending?.source,
        });
      }
      return next;
    },
  );
}
export async function ownData(owner: string, database = db) {
  const tables = [
    "profiles",
    "service_periods",
    "diary_entries",
    "books",
    "user_preferences",
    "entry_media",
    "book_versions",
  ] as const;
  const data = await Promise.all(
    tables.map((t) =>
      database.table(t).where("owner_id").equals(owner).toArray(),
    ),
  );
  return Object.fromEntries(tables.map((t, i) => [t, data[i]])) as {
    profiles: Profile[];
    service_periods: Period[];
    diary_entries: Entry[];
    books: Book[];
    user_preferences: Preferences[];
    entry_media: Media[];
    book_versions: BookVersion[];
  };
}
export async function clearOwner(owner: string) {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.where("owner_id").equals(owner).delete();
  });
}
