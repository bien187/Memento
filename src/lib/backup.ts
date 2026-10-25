import JSZip from "jszip";
import { z } from "zod";
import { db, ownData, saveEntity } from "./local/db";
import {
  schemas,
  bookVersionSchema,
  timestampSchema,
  type EntityTable,
  type BookVersion,
  type Snapshot,
  type Entity,
} from "./domain/models";
import { supabase, cloudConfigured } from "./supabase/browser";
export const backupSchema = z.object({
  format: z.literal("feldbuch"),
  schema_version: z.literal(1),
  exported_at: timestampSchema,
  owner_id: z.uuid(),
  data: z.object({
    profiles: z.array(schemas.profiles).max(1),
    service_periods: z.array(schemas.service_periods).max(1000),
    diary_entries: z.array(schemas.diary_entries).max(50000),
    entry_media: z.array(schemas.entry_media).max(200000),
    books: z.array(schemas.books).max(1000),
    book_versions: z.array(bookVersionSchema).max(5000),
    user_preferences: z.array(schemas.user_preferences).max(1),
  }),
});
export type Backup = z.infer<typeof backupSchema>;
export type ImportPreview = {
  backup: Backup;
  blobs: Map<string, Blob>;
  duplicates: number;
};
export async function exportBackup(owner: string, zipMedia = true) {
  const data = await ownData(owner);
  const entryIds = new Set(data.diary_entries.map((e) => e.id));
  const media = data.entry_media.filter(
    (m) => !m.entry_id || entryIds.has(m.entry_id),
  );
  const backup: Backup = {
    format: "feldbuch",
    schema_version: 1,
    exported_at: new Date().toISOString(),
    owner_id: owner,
    data: { ...data, entry_media: media.map(({ blob: _, ...m }) => m) },
  };
  if (!zipMedia)
    return new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
  const zip = new JSZip();
  zip.file("feldbuch.json", JSON.stringify(backup, null, 2));
  for (const m of media) {
    let blob = m.blob;
    if (!blob && m.storage_path && cloudConfigured) {
      const { data, error } = await supabase()
        .storage.from("diary-media")
        .download(m.storage_path);
      if (error)
        throw new Error(`Bild ${m.name} konnte nicht gesichert werden.`);
      blob = data;
    }
    if (!blob)
      throw new Error(`Bild ${m.name} fehlt. Bitte zuerst synchronisieren.`);
    zip.file(`media/${m.id}`, await blob.arrayBuffer());
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
export async function inspectBackup(
  file: File,
  owner: string,
): Promise<ImportPreview> {
  if (file.size > 250 * 1024 * 1024)
    throw new Error("Backups sind auf 250 MB begrenzt.");
  let raw: string;
  const blobs = new Map<string, Blob>();
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (signature[0] === 0x50 && signature[1] === 0x4b) {
    const zip = await JSZip.loadAsync(file);
    const manifest = zip.file("feldbuch.json");
    if (!manifest) throw new Error("feldbuch.json fehlt im ZIP.");
    raw = await manifest.async("string");
    if (raw.length > 30 * 1024 * 1024)
      throw new Error("Datenmanifest zu gross.");
    const parsed = backupSchema.parse(JSON.parse(raw));
    let total = raw.length;
    for (const media of parsed.data.entry_media) {
      const entry = zip.file(`media/${media.id}`);
      if (!entry) throw new Error(`Bild ${media.name} fehlt im Archiv.`);
      const bytes = await entry.async("uint8array");
      total += bytes.byteLength;
      if (bytes.byteLength > 5 * 1024 * 1024 || total > 250 * 1024 * 1024)
        throw new Error("Entpackte Daten überschreiten das Limit.");
      const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const png = bytes[0] === 137 && bytes[1] === 80;
      const webp = String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      if (!(
        (jpg && media.mime === "image/jpeg") ||
        (png && media.mime === "image/png") ||
        (webp && media.mime === "image/webp")
      ))
        throw new Error("Ungültiges Bildformat im Backup.");
      blobs.set(
        media.id,
        new Blob([bytes.buffer as ArrayBuffer], { type: media.mime }),
      );
    }
  } else raw = await file.text();
  const backup = backupSchema.parse(JSON.parse(raw));
  if (backup.data.entry_media.length && !blobs.size)
    throw new Error(
      "Dieses JSON enthält Bildverweise. Für eine vollständige Wiederherstellung bitte das ZIP-Backup verwenden.",
    );
  validateRelations(backup);
  const ids = new Set((await ownData(owner)).diary_entries.map((e) => e.id));
  const duplicates = backup.data.diary_entries.filter((e) =>
    ids.has(e.id),
  ).length;
  return { backup, blobs, duplicates };
}
export function validateRelations(backup: Backup) {
  const { data, owner_id } = backup;
  const periods = new Set(data.service_periods.map((p) => p.id)),
    entries = new Set(data.diary_entries.map((e) => e.id)),
    media = new Set(data.entry_media.map((m) => m.id)),
    books = new Set(data.books.map((b) => b.id));
  for (const records of Object.values(data))
    for (const r of records)
      if (r.owner_id !== owner_id)
        throw new Error("Das Backup enthält fremde Eigentümer.");
  for (const e of data.diary_entries)
    if (!periods.has(e.period_id) || e.media_ids.some((id) => !media.has(id)))
      throw new Error("Ungültige Eintragsverknüpfung.");
  for (const m of data.entry_media)
    if (m.entry_id && !entries.has(m.entry_id))
      throw new Error("Ungültige Medienverknüpfung.");
  for (const b of data.books)
    if (
      !periods.has(b.period_id) ||
      b.chapters.some((c) =>
        c.items.some(
          (i) =>
            (i.entry_id && !entries.has(i.entry_id)) ||
            i.media_ids.some((id) => !media.has(id)),
        ),
      )
    )
      throw new Error("Ungültige Buchverknüpfung.");
  for (const v of data.book_versions)
    if (
      !books.has(v.book_id) ||
      v.snapshot.entries.some((e) => e.owner_id !== owner_id) ||
      v.snapshot.media.some((m) => m.owner_id !== owner_id || !media.has(m.id))
    )
      throw new Error("Ungültige Buchversion.");
}
export async function importBackup(
  preview: ImportPreview,
  owner: string,
  mode: "cloud" | "local",
  strategy: "merge" | "restore",
) {
  const { backup, blobs } = preview;
  const ids = new Map<string, string>();
  async function id(old: string | null): Promise<string | null> {
    if (!old) return null;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        old,
      )
    )
      return old;
    if (old === backup.owner_id) return owner;
    if (backup.owner_id === owner) return old;
    if (ids.has(old)) return ids.get(old)!;
    const bytes = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${owner}:${old}`),
      ),
    );
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const s = [...bytes.slice(0, 16)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const result = `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    ids.set(old, result);
    return result;
  }
  async function remap(record: unknown): Promise<unknown> {
    if (Array.isArray(record)) return Promise.all(record.map(remap));
    if (!record || typeof record !== "object") return record;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === "owner_id") result[key] = owner;
      else if (
        (key === "id" || key.endsWith("_id")) &&
        (typeof value === "string" || value === null)
      )
        result[key] = await id(value as string | null);
      else if (key === "media_ids")
        result[key] = await Promise.all((value as string[]).map(id));
      else if (key === "storage_path") result[key] = null;
      else if (key === "version") result[key] = 0;
      else result[key] = await remap(value);
    }
    return result;
  }
  const prepared: Partial<Record<EntityTable, Entity[]>> = {};
  for (const [table, records] of Object.entries(backup.data))
    prepared[table as EntityTable] = await Promise.all(
      records.map(async (record) => {
        const result = (await remap(record)) as Entity;
        if (table === "diary_entries" && backup.owner_id !== owner)
          return { ...result, visibility: "private" } as Entity;
        if (table === "entry_media")
          return { ...result, blob: blobs.get(record.id) };
        return result;
      }),
    );
  await db.transaction("rw", db.tables, async () => {
    if (strategy === "restore") {
      for (const table of [
        "diary_entries",
        "books",
        "service_periods",
      ] as const) {
        const existing = await db
          .table(table)
          .where("owner_id")
          .equals(owner)
          .toArray();
        for (const record of existing)
          await saveEntity(
            table,
            { ...record, deleted_at: new Date().toISOString() },
            mode,
          );
      }
    }
    for (const table of [
      "profiles",
      "service_periods",
      "diary_entries",
      "entry_media",
      "books",
      "book_versions",
      "user_preferences",
    ] as const) {
      for (const record of prepared[table] ?? []) {
        const existing = await db.table(table).get(record.id);
        if (
          existing &&
          (strategy === "merge" ||
            table === "book_versions" ||
            table === "entry_media")
        )
          continue;
        await saveEntity(table, record, mode);
      }
    }
  });
}
