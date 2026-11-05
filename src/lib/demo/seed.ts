import type { FeldbuchDB } from "../local/db";
import type { Media } from "../domain/models";
import {
  demoBook,
  demoEntries,
  demoMedia,
  demoPeriods,
  demoPreferences,
  demoProfile,
  demoVersion,
  type DemoPhoto,
} from "./data";
import { DEMO_DATABASE } from "./mode";

export type PhotoLoader = (file: DemoPhoto) => Promise<Blob | undefined>;
export const loadDemoPhoto: PhotoLoader = async (file) => {
  try {
    const response = await fetch(`/demo/photos/${file}`);
    return response.ok ? await response.blob() : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Replaces the whole content of the demo database with the fictional notebook.
 * Refuses to touch any other database, so the personal notebook is never affected.
 */
export async function seedDemo(
  database: FeldbuchDB,
  loadPhoto: PhotoLoader = loadDemoPhoto,
) {
  if (database.name !== DEMO_DATABASE)
    throw new Error(
      "Demo-Daten dürfen nur in die Demo-Datenbank geschrieben werden.",
    );
  const files = [...new Set(demoMedia.map((m) => m.file))];
  const blobs = new Map(
    await Promise.all(files.map(async (f) => [f, await loadPhoto(f)] as const)),
  );
  const media: Media[] = demoMedia.map(({ file, ...record }) => {
    const blob = blobs.get(file);
    return blob ? { ...record, size: blob.size, blob } : record;
  });
  await database.transaction("rw", database.tables, async () => {
    for (const table of database.tables) await table.clear();
    await database.profiles.put(structuredClone(demoProfile));
    await database.service_periods.bulkPut(structuredClone(demoPeriods));
    await database.diary_entries.bulkPut(structuredClone(demoEntries));
    await database.entry_media.bulkPut(media);
    await database.books.put(structuredClone(demoBook));
    await database.book_versions.put(structuredClone(demoVersion));
    await database.user_preferences.put(structuredClone(demoPreferences));
  });
}
