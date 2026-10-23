import {
  baseRecord,
  type Profile,
  type Period,
  type Entry,
  type Book,
  type BookVersion,
} from "../../src/lib/domain/models";
import { addDays } from "../../src/lib/domain/dates";
export function demoRecords(owner: string) {
  const profile: Profile = {
    ...baseRecord(owner, owner),
    name: "Lukas Meier",
    username: "lukas_meier",
    rank_id: "soldat",
    function_id: "infanterist",
    branch_id: "infanterie",
    barracks_id: "chur",
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
    barracks_id: "chur",
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
