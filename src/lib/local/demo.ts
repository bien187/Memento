import {
  baseRecord,
  defaultPreferences,
  type Profile,
  type Period,
  type Entry,
  type Book,
  type BookVersion,
} from "../domain/models";
import { addDays } from "../domain/dates";
import { db } from "./db";
export function demoRecords(owner: string) {
  const profile: Profile = {
    ...baseRecord(owner, owner),
    name: "Lukas Meier",
    username: "lukas_meier",
    rank_id: "soldat",
    function_id: "infanterist",
    branch_id: "infanterie",
    unit: "Infanterie RS · fiktiv",
    discoverable: false,
    private_profile: true,
    avatar_id: null,
  };
  const period: Period = {
    ...baseRecord(owner),
    type: "RS",
    title: "RS Frühjahr 2026",
    start_date: "2026-01-12",
    end_date: "2026-05-15",
    unit: "Infanterie RS · fiktiv",
    rank_id: "soldat",
    function_id: "infanterist",
    branch_id: "infanterie",
  };
  const events = [
    [
      "Ankommen. Durchatmen.",
      "Der erste Tag. Neue Gesichter, neue Abläufe. Am Abend blieb kurz Zeit, alles aufzuschreiben.",
    ],
    [
      "Ein Schritt nach dem anderen",
      "Heute haben wir gemeinsam geübt. Langsam werden die Abläufe vertraut.",
    ],
    [
      "Zwischen Müdigkeit und Stolz",
      "Ein fordernder Tag. Gut zu wissen, dass wir aufeinander zählen können.",
    ],
    [
      "Der Kopf wird frei",
      "Die Pause an der frischen Luft hat gutgetan. Ein Moment, den ich behalten möchte.",
    ],
    [
      "Als Gruppe zusammenwachsen",
      "Heute haben wir eine Aufgabe gemeinsam gelöst. Jeder hat etwas beigetragen.",
    ],
    [
      "Ein ruhiger Abend",
      "Zeit für einen Brief nach Hause und ein paar Gedanken im Tagebuch.",
    ],
    [
      "Wieder neue Energie",
      "Das Wochenende hat gutgetan. Ich freue mich auf die nächste Woche.",
    ],
  ];
  const entries: Entry[] = Array.from({ length: 35 }, (_, i) => ({
    ...baseRecord(owner),
    period_id: period.id,
    date: addDays(period.start_date, i),
    subtitle: events[i % 7][0],
    content:
      events[i % 7][1] +
      "\n\nDiese Erinnerung gehört zu einem vollständig fiktiven Beispieltagebuch.",
    mood: i % 9 === 0 ? null : 35 + ((i * 13) % 62),
    condition: i % 8 === 0 ? null : 20 + ((i * 17) % 77),
    milestone: [0, 9, 18, 27, 34].includes(i),
    visibility: i % 4 === 0 ? "followers" : i % 5 === 0 ? "link" : "private",
    media_ids: [],
    cover_id: null,
    created_at: new Date().toISOString(),
  }));
  const book: Book = {
    ...baseRecord(owner),
    period_id: period.id,
    title: "Was bleibt.",
    subtitle: "Erinnerungen an meine Rekrutenschule",
    dedication: "Für alle, die diesen Weg mitgegangen sind.",
    intro:
      "Fünf Wochen, viele erste Male und Erinnerungen, die bleiben. Ein fiktives Beispielbuch.",
    outro: "Man nimmt mehr mit, als man am ersten Tag ahnt.",
    template: "editorial",
    accent: "olive",
    cover_id: null,
    chapters: Array.from({ length: 5 }, (_, w) => ({
      id: crypto.randomUUID(),
      title: `Woche ${w + 1}`,
      items: entries.slice(w * 7, w * 7 + 7).map((e) => ({
        id: crypto.randomUUID(),
        kind: "entry" as const,
        entry_id: e.id,
        title: "",
        text: "",
        media_ids: [],
      })),
    })),
  };
  const version: BookVersion = {
    id: crypto.randomUUID(),
    owner_id: owner,
    book_id: book.id,
    number: 1,
    snapshot: { book, period, entries, media: [], display_name: profile.name },
    created_at: new Date().toISOString(),
    archived: false,
  };
  return { profile, period, entries, book, version };
}
export async function loadDemo(owner: string) {
  if (await db.profiles.get(owner)) return;
  const { profile, period, entries, book, version } = demoRecords(owner);
  await db.transaction("rw", db.tables, async () => {
    await db.profiles.put(profile);
    await db.service_periods.put(period);
    await db.diary_entries.bulkPut(entries);
    await db.books.put(book);
    await db.book_versions.put(version);
    await db.user_preferences.put({
      ...defaultPreferences(owner),
      active_period_id: period.id,
    });
  });
  // Self-drawn, clearly fictional sample media. No network images, people or location data.
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const c = canvas.getContext("2d");
  if (!c) return;
  for (const [i, entry] of entries.filter((_, i) => i % 5 === 0).entries()) {
    c.fillStyle = "#d9dfd4";
    c.fillRect(0, 0, 1200, 800);
    c.fillStyle = "#8f9b83";
    c.beginPath();
    c.moveTo(0, 600);
    c.lineTo(350, 200 + i * 15);
    c.lineTo(700, 650);
    c.lineTo(1000, 280);
    c.lineTo(1200, 620);
    c.lineTo(1200, 800);
    c.lineTo(0, 800);
    c.fill();
    c.fillStyle = "#53604b";
    c.beginPath();
    c.moveTo(0, 800);
    c.lineTo(500, 480);
    c.lineTo(1200, 800);
    c.fill();
    c.fillStyle = "#253326";
    c.font = "24px sans-serif";
    c.fillText("FIKTIVES BILDMOTIV / MEMENTO", 50, 70);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    if (!blob) continue;
    const id = crypto.randomUUID();
    await db.entry_media.put({
      ...baseRecord(owner, id),
      entry_id: entry.id,
      name: "Fiktive Landschaft.jpg",
      mime: "image/jpeg",
      size: blob.size,
      storage_path: null,
      blob,
    });
    await db.diary_entries.update(entry.id, { media_ids: [id], cover_id: id });
  }
  const savedEntries = await db.diary_entries
    .where("period_id")
    .equals(period.id)
    .toArray();
  const savedMedia = await db.entry_media
    .where("owner_id")
    .equals(owner)
    .toArray();
  book.cover_id = savedEntries.find((e) => e.cover_id)?.cover_id ?? null;
  await db.books.put(book);
  await db.book_versions.put({
    ...version,
    snapshot: {
      book,
      period,
      entries: savedEntries,
      media: savedMedia.map(({ blob: _, ...m }) => m),
      display_name: profile.name,
    },
  });
}
