/**
 * Fictional notebook for the public demo. Every name, unit, text and photo is
 * invented. The catalog ids (rank, function, branch, barracks) only reference
 * the app's public catalogs so that insignia and labels render correctly.
 */
import type {
  Book,
  BookVersion,
  Entry,
  Media,
  Period,
  Preferences,
  Profile,
} from "../domain/models";
import { DEMO_OWNER } from "./mode";

/** Stable ids keep links and book chapters consistent between visits. */
export const demoId = (n: number) =>
  `0d3e0000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const stamp = "2026-03-21T18:00:00.000Z";
const base = (id: string) => ({
  id,
  owner_id: DEMO_OWNER,
  version: 0,
  updated_at: stamp,
  deleted_at: null,
});

export const DEMO_PHOTOS = [
  ["morgenappell.jpg", "Morgenappell vor der Unterkunft"],
  ["kaserne-hof.jpg", "Kasernenhof am ersten Tag"],
  ["marsch-nebel.jpg", "Marsch durch den Morgennebel"],
  ["biwak-abend.jpg", "Biwak am Abend"],
  ["schnee-uebung.jpg", "Übung im Schnee"],
  ["feldkueche.jpg", "Feldküche im Einsatz"],
  ["seeufer.jpg", "Pause am Seeufer"],
  ["heimweg.jpg", "Im Zug nach Hause"],
] as const;
export type DemoPhoto = (typeof DEMO_PHOTOS)[number][0];

export const demoProfile: Profile = {
  ...base(DEMO_OWNER),
  name: "Matteo Fischer",
  username: "matteo_demo",
  rank_id: "gefreiter",
  function_id: "geniesoldat",
  branch_id: "genie",
  barracks_id: "brugg",
  unit: "Genie Kp 3 · fiktiv",
  discoverable: false,
  private_profile: true,
  share_function: false,
  share_service_period: false,
  share_connections: false,
  avatar_id: null,
};

const RS_ID = demoId(0x100),
  WK_ID = demoId(0x101);
export const demoPeriods: Period[] = [
  {
    ...base(RS_ID),
    type: "RS",
    title: "Genie RS Frühling 2025",
    start_date: "2025-01-13",
    end_date: "2025-05-16",
    unit: "Genie Kp 3 · fiktiv",
    rank_id: "soldat",
    function_id: "geniesoldat",
    branch_id: "genie",
    barracks_id: "brugg",
  },
  {
    ...base(WK_ID),
    type: "WK",
    title: "WK März 2026",
    start_date: "2026-03-02",
    end_date: "2026-03-20",
    unit: "Genie Kp 3 · fiktiv",
    rank_id: "gefreiter",
    function_id: "geniesoldat",
    branch_id: "genie",
    barracks_id: "brugg",
  },
];

type Seed = {
  date: string;
  subtitle: string;
  content: string;
  mood: number | null;
  condition: number | null;
  milestone?: boolean;
  photos?: DemoPhoto[];
};
const rs: Seed[] = [
  {
    date: "2025-01-13",
    subtitle: "Einrücken",
    content:
      "Um sieben Uhr stand ich mit meiner Tasche vor dem Kasernentor. Viele unbekannte Gesichter, alle ein bisschen nervös. Material fassen, Zimmer beziehen, die ersten Befehle. Am Abend liegt der Kopf voller Eindrücke auf dem Kissen.\n\nIch habe mir vorgenommen, jeden Tag ein paar Zeilen zu schreiben. Mal sehen, wie lange das hält.",
    mood: 55,
    condition: 70,
    milestone: true,
    photos: ["kaserne-hof.jpg"],
  },
  {
    date: "2025-01-15",
    subtitle: "Bett machen will gelernt sein",
    content:
      "Drittes Mal heute Morgen das Bett neu gemacht, bis der Zugführer zufrieden war. Wir lachen inzwischen darüber. In der Gruppe kennen sich langsam alle beim Namen.",
    mood: 48,
    condition: 62,
  },
  {
    date: "2025-01-20",
    subtitle: "Erste Woche geschafft",
    content:
      "Das erste Wochenende zu Hause war seltsam kurz. Am Sonntagabend im Zug zurück habe ich gemerkt, dass ich mich fast ein wenig auf die Gruppe gefreut habe.",
    mood: 66,
    condition: 58,
  },
  {
    date: "2025-01-29",
    subtitle: "Morgenappell bei minus acht Grad",
    content:
      "Kalte Finger, klare Luft und ein Sonnenaufgang, der fast alles wettmacht. Danach Theorie zu Brückenbau und Stegen. Mehr Physik, als ich erwartet hätte.",
    mood: 61,
    condition: 54,
    photos: ["morgenappell.jpg"],
  },
  {
    date: "2025-02-06",
    subtitle: "Der erste lange Marsch",
    content:
      "Fünfzehn Kilometer mit Gepäck, die letzten drei im Nebel. Die Füsse brennen, aber niemand ist zurückgeblieben. Unser Gruppenführer hat am Ende jedem die Hand geschüttelt.",
    mood: 72,
    condition: 31,
    milestone: true,
    photos: ["marsch-nebel.jpg"],
  },
  {
    date: "2025-02-13",
    subtitle: "Ein ruhiger Abend",
    content:
      "Zeit für einen Brief nach Hause und ein paar Gedanken. Im Zimmer läuft leise Musik, jemand näht einen Knopf an. Solche Abende mag ich.",
    mood: 70,
    condition: 66,
  },
  {
    date: "2025-02-25",
    subtitle: "Übung im Schnee",
    content:
      "Den ganzen Tag draussen am Hang. Wir haben eine Materialseilbahn aufgebaut und wieder abgebaut, bis jeder Handgriff sass. Nasse Handschuhe, heisser Tee, gute Stimmung.",
    mood: 76,
    condition: 44,
    photos: ["schnee-uebung.jpg", "feldkueche.jpg"],
  },
  {
    date: "2025-03-07",
    subtitle: "Nicht jeder Tag ist gut",
    content:
      "Heute war einfach zäh. Wenig Schlaf, viel Warten, ein Anschiss für etwas, das nicht meine Schuld war. Morgen ist ein neuer Tag. Aufschreiben hilft trotzdem.",
    mood: 24,
    condition: 28,
  },
  {
    date: "2025-03-12",
    subtitle: "Die erste Nacht im Biwak",
    content:
      "Zelte im Wald aufgestellt, Feuerwache in Zweierteams. Um zwei Uhr nachts standen wir unter einem Himmel voller Sterne und haben über alles Mögliche geredet. Das bleibt.",
    mood: 84,
    condition: 40,
    milestone: true,
    photos: ["biwak-abend.jpg", "feldkueche.jpg", "marsch-nebel.jpg"],
  },
  {
    date: "2025-03-20",
    subtitle: "Brückenschlag",
    content:
      "Zum ersten Mal haben wir als Zug einen Steg über den Bach gebaut, der wirklich trägt. Als der Zugführer als Erster darüberging, war es kurz ganz still. Dann Applaus.",
    mood: 88,
    condition: 52,
    photos: ["seeufer.jpg"],
  },
  {
    date: "2025-03-28",
    subtitle: "Urlaub und Heimweh zugleich",
    content:
      "Langes Wochenende. Zu Hause erzähle ich viel und merke, wie schwer es ist, das alles zu erklären. Man muss wohl dabei gewesen sein.",
    mood: 63,
    condition: 75,
    photos: ["heimweg.jpg"],
  },
  {
    date: "2025-04-08",
    subtitle: "Durchhalteübung",
    content:
      "Achtundvierzig Stunden mit wenig Schlaf und viel Arbeit. Irgendwann funktioniert man nur noch. Was mich getragen hat, waren die Leute neben mir. Am Ende war ich stolz wie selten.",
    mood: 79,
    condition: 12,
    milestone: true,
    photos: ["marsch-nebel.jpg", "biwak-abend.jpg"],
  },
  {
    date: "2025-04-10",
    subtitle: "Ausschlafen",
    content:
      "Nach der Übung zwei ruhige Tage. Material reinigen, Muskelkater pflegen, viel essen. Die Gruppe ist enger zusammengerückt.",
    mood: 74,
    condition: 35,
  },
  {
    date: "2025-04-23",
    subtitle: "Verlegung an den See",
    content:
      "Eine Woche Übungsplatz am Wasser. Pontons ins Wasser bringen, verbinden, wieder lösen. In der Pause sassen wir am Ufer und haben einfach geschaut.",
    mood: 82,
    condition: 60,
    photos: ["seeufer.jpg", "feldkueche.jpg"],
  },
  {
    date: "2025-05-02",
    subtitle: "Beförderung zum Soldaten",
    content:
      "Kurze Zeremonie auf dem Kasernenhof. Nichts Grosses, aber es hat sich gut angefühlt. Am Abend gemeinsames Essen mit dem ganzen Zug.",
    mood: 86,
    condition: 70,
    milestone: true,
    photos: ["kaserne-hof.jpg", "morgenappell.jpg"],
  },
  {
    date: "2025-05-09",
    subtitle: "Abgeben und aufräumen",
    content:
      "Material zurückgeben, Zimmer putzen, Inventar zählen. Es fühlt sich komisch an, dass bald alles vorbei ist.",
    mood: 58,
    condition: 64,
  },
  {
    date: "2025-05-16",
    subtitle: "Abtreten",
    content:
      "Letzter Appell. Handschläge, Umarmungen, ein paar Fotos. Im Zug nach Hause habe ich dieses Tagebuch von vorne gelesen. Achtzehn Wochen, die mich mehr verändert haben, als ich am ersten Tag gedacht hätte.",
    mood: 90,
    condition: 72,
    milestone: true,
    photos: [
      "heimweg.jpg",
      "kaserne-hof.jpg",
      "morgenappell.jpg",
      "seeufer.jpg",
    ],
  },
];
const wk: Seed[] = [
  {
    date: "2026-03-02",
    subtitle: "Wiedersehen im WK",
    content:
      "Fast ein Jahr später wieder dieselben Gesichter. Erstaunlich, wie schnell die Abläufe zurückkommen. Neu bin ich jetzt Gefreiter und für das Material der Gruppe zuständig.",
    mood: 78,
    condition: 74,
    milestone: true,
    photos: ["kaserne-hof.jpg"],
  },
  {
    date: "2026-03-05",
    subtitle: "Verantwortung",
    content:
      "Zum ersten Mal habe ich selbst die Materialkontrolle geleitet. Es fehlte ein Schäkel, wir haben ihn nach einer halben Stunde gefunden. Lektion gelernt: lieber zweimal zählen.",
    mood: 60,
    condition: 66,
  },
  {
    date: "2026-03-11",
    subtitle: "Einsatzübung am Fluss",
    content:
      "Grosse Übung mit mehreren Kompanien. Lange Wartezeiten, dann alles auf einmal. Am Abend lief die Feldküche auf Hochtouren.",
    mood: 71,
    condition: 38,
    photos: ["feldkueche.jpg", "seeufer.jpg"],
  },
  {
    date: "2026-03-20",
    subtitle: "WK-Ende",
    content:
      "Drei Wochen sind schnell vorbei. Ich nehme mir vor, nächstes Mal wieder öfter zu schreiben.",
    mood: 76,
    condition: 58,
    photos: ["heimweg.jpg"],
  },
];

export type DemoMedia = Omit<Media, "blob"> & { file: DemoPhoto };
/** Every entry owns its own media records, exactly like uploaded photos. */
export const demoMedia: DemoMedia[] = [];
function toEntries(seeds: Seed[], period: string, offset: number): Entry[] {
  return seeds.map((s, i) => {
    const id = demoId(offset + i);
    const media_ids = (s.photos ?? []).map((file) => {
      const media: DemoMedia = {
        ...base(demoId(0x400 + demoMedia.length)),
        entry_id: id,
        name: file,
        mime: "image/jpeg",
        size: 1,
        storage_path: null,
        file,
      };
      demoMedia.push(media);
      return media.id;
    });
    return {
      ...base(id),
      period_id: period,
      date: s.date,
      subtitle: s.subtitle,
      content: s.content,
      mood: s.mood,
      condition: s.condition,
      milestone: !!s.milestone,
      visibility: "private",
      media_ids,
      cover_id: media_ids[0] ?? null,
      created_at: `${s.date}T19:30:00.000Z`,
    };
  });
}
export const demoEntries: Entry[] = [
  ...toEntries(rs, RS_ID, 0x200),
  ...toEntries(wk, WK_ID, 0x280),
];

const rsEntries = demoEntries.filter((e) => e.period_id === RS_ID);
const item = (n: number, entry: Entry) => ({
  id: demoId(0x600 + n),
  kind: "entry" as const,
  entry_id: entry.id,
  title: "",
  text: "",
  media_ids: [],
});
const chapter = (n: number, title: string, from: string, to: string) => ({
  id: demoId(0x580 + n),
  title,
  items: rsEntries
    .filter((e) => e.date >= from && e.date <= to)
    .map((e) => item(rsEntries.indexOf(e), e)),
});
export const demoBook: Book = {
  ...base(demoId(0x500)),
  period_id: RS_ID,
  title: "Achtzehn Wochen.",
  subtitle: "Erinnerungen an meine Genie RS",
  dedication: "Für meinen Zug. Ohne euch wäre es nur Dienst gewesen.",
  intro:
    "Dieses Buch sammelt die Tage, die geblieben sind: die ersten Unsicherheiten, die langen Märsche und die Abende, an denen wir einfach gelacht haben.\n\nAlle Personen, Orte und Ereignisse in diesem Beispiel sind frei erfunden.",
  outro: "Man nimmt mehr mit, als man am ersten Tag ahnt.",
  template: "editorial",
  accent: "olive",
  cover_id: null,
  chapters: [
    chapter(0, "Ankommen", "2025-01-13", "2025-02-13"),
    chapter(1, "Draussen", "2025-02-14", "2025-03-28"),
    chapter(2, "Durchhalten", "2025-03-29", "2025-04-30"),
    chapter(3, "Abtreten", "2025-05-01", "2025-05-16"),
  ],
};
// A free text and a gallery show the other chapter item kinds.
demoBook.chapters[1].items.push({
  id: demoId(0x680),
  kind: "gallery",
  entry_id: null,
  title: "Draussen unterwegs",
  text: "Ein paar Bilder aus den Wochen im Gelände.",
  media_ids: demoMedia
    .filter((m) =>
      rsEntries
        .filter((e) => e.date >= "2025-02-14" && e.date <= "2025-03-28")
        .some((e) => e.id === m.entry_id),
    )
    .slice(0, 4)
    .map((m) => m.id),
});
demoBook.chapters[3].items.unshift({
  id: demoId(0x681),
  kind: "text",
  entry_id: null,
  title: "Rückblick",
  text: "Am Ende der RS kennt man die Menschen neben sich besser als manche Freunde von früher. Diese letzten Tage gehören ihnen.",
  media_ids: [],
});
demoBook.cover_id =
  demoMedia.find((m) => m.file === "morgenappell.jpg")?.id ?? null;

export const demoVersion: BookVersion = {
  id: demoId(0x700),
  owner_id: DEMO_OWNER,
  book_id: demoBook.id,
  number: 1,
  snapshot: {
    book: demoBook,
    period: demoPeriods[0],
    entries: rsEntries,
    media: demoMedia.map(({ file: _file, ...m }) => m),
    display_name: demoProfile.name,
  },
  created_at: "2025-05-20T12:00:00.000Z",
  archived: false,
};

export const demoPreferences: Preferences = {
  ...base(DEMO_OWNER),
  theme: "system",
  view: "grid",
  active_period_id: RS_ID,
  reminder_enabled: false,
  reminder_days: [0, 1, 2, 3, 4, 5, 6],
  reminder_time: "20:30",
};
