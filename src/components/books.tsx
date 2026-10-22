"use client";
import { useEffect, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  Check,
  Download,
  History,
  Share2,
  Archive,
  RotateCcw,
} from "lucide-react";
import {
  baseRecord,
  bookSchema,
  type Book,
  type Chapter,
  type BookItem,
  type Snapshot,
  type Period,
  type BookVersion,
} from "@/lib/domain/models";
import { serviceWeek, dateLabel } from "@/lib/domain/dates";
import { db } from "@/lib/local/db";
import { useStore } from "./store";
import { Button, Modal, Field, Empty, useConfirm, useToast } from "./ui";
import { BookReader } from "./book-reader";
import { ExportDialog } from "./export";
import { ShareDialog } from "./sharing";
import { supabase } from "@/lib/supabase/browser";
import { message } from "@/lib/utils";
export function Books() {
  const { identity, data, save, refresh } = useStore(),
    confirm = useConfirm(),
    toast = useToast();
  const [editing, setEditing] = useState<string | null>(null),
    [preview, setPreview] = useState<Snapshot | null>(null),
    [exporting, setExporting] = useState<Snapshot | null>(null),
    [sharing, setSharing] = useState<BookVersion | null>(null),
    [versions, setVersions] = useState<string | null>(null),
    [creating, setCreating] = useState(false),
    [selectedPeriod, setSelectedPeriod] = useState(
      data?.user_preferences[0]?.active_period_id ??
        data?.service_periods[0]?.id ??
        "",
    );
  const books = data?.books.filter((b) => !b.deleted_at) ?? [],
    periods = data?.service_periods.filter((p) => !p.deleted_at) ?? [];
  const book = books.find((b) => b.id === editing);
  async function create() {
    const period = periods.find((p) => p.id === selectedPeriod);
    if (!period) return;
    const entries = data!.diary_entries
      .filter((e) => e.period_id === period.id && !e.deleted_at)
      .sort((a, b) => a.date.localeCompare(b.date));
    const weeks = [
      ...new Set(entries.map((e) => serviceWeek(period.start_date, e.date))),
    ];
    const value: Book = {
      ...baseRecord(identity!.id),
      period_id: period.id,
      title: `Mein ${period.type}-Buch`,
      subtitle: period.title,
      dedication: "",
      intro: "",
      outro: "",
      template: "editorial",
      accent: "olive",
      cover_id: entries.find((e) => e.cover_id)?.cover_id ?? null,
      chapters: (weeks.length ? weeks : [1]).map((week) => ({
        id: crypto.randomUUID(),
        title: `Woche ${week}`,
        items: entries
          .filter((e) => serviceWeek(period.start_date, e.date) === week)
          .map((e) => ({
            id: crypto.randomUUID(),
            kind: "entry",
            entry_id: e.id,
            title: "",
            text: "",
            media_ids: [],
          })),
      })),
    };
    await save("books", value);
    setCreating(false);
    setEditing(value.id);
  }
  async function snapshot(book: Book): Promise<Snapshot> {
    const period = data!.service_periods.find((p) => p.id === book.period_id)!;
    const ids = new Set(
      book.chapters.flatMap((c) =>
        c.items.map((i) => i.entry_id).filter(Boolean),
      ),
    );
    const entries = data!.diary_entries.filter(
      (e) => ids.has(e.id) && !e.deleted_at,
    );
    const mids = new Set([
      ...entries.flatMap((e) => e.media_ids),
      ...book.chapters.flatMap((c) => c.items.flatMap((i) => i.media_ids)),
      ...(book.cover_id ? [book.cover_id] : []),
    ]);
    const media = (
      await db.entry_media.where("owner_id").equals(identity!.id).toArray()
    )
      .filter((m) => mids.has(m.id))
      .map(({ blob: _, ...m }) => m);
    return {
      book: structuredClone(book),
      period: structuredClone(period),
      entries: structuredClone(entries),
      media,
      display_name: data!.profiles[0].name,
    };
  }
  async function publish(book: Book) {
    if (
      !(await confirm({
        title: "Unveränderliche Buchversion erstellen?",
        text: "Alle ausgewählten Texte und Bilder, auch private Tagebucheinträge, werden in dieser Version festgehalten. Ein öffentlicher Link wird erst nach einer weiteren ausdrücklichen Freigabe erstellt. Keine klassifizierten Inhalte oder unzulässigen Aufnahmen veröffentlichen.",
        label: "Version erstellen",
      }))
    )
      return;
    try {
      await refresh();
      const snap = await snapshot(book);
      if (identity?.mode === "cloud" && snap.media.some((m) => !m.storage_path))
        throw new Error("Bitte zuerst alle Bilder synchronisieren.");
      const version: BookVersion = {
        id: crypto.randomUUID(),
        owner_id: identity!.id,
        book_id: book.id,
        number:
          Math.max(
            0,
            ...(data?.book_versions
              .filter((v) => v.book_id === book.id)
              .map((v) => v.number) ?? []),
          ) + 1,
        snapshot: snap,
        created_at: new Date().toISOString(),
        archived: false,
      };
      await save("book_versions", version);
      toast(
        "Buchversion erstellt. Du kannst sie jetzt separat per Link freigeben.",
      );
      setVersions(book.id);
    } catch (e) {
      toast(message(e));
    }
  }
  async function archive(version: BookVersion) {
    if (identity?.mode === "cloud") {
      const { error } = await supabase().rpc("archive_book_version", {
        version_id: version.id,
        value: !version.archived,
      });
      if (error) return toast(error.message);
    }
    await db.book_versions.update(version.id, { archived: !version.archived });
  }
  async function restore(version: BookVersion) {
    if (
      !(await confirm({
        title: "Version als neuen Entwurf wiederherstellen?",
        text: "Es entsteht ein neues Buch. Bestehende Tagebucheinträge und andere Bücher bleiben erhalten.",
        label: "Neuen Entwurf erstellen",
      }))
    )
      return;
    const snap = version.snapshot;
    const restored: Book = {
      ...snap.book,
      ...baseRecord(identity!.id),
      title: `${snap.book.title} · wiederhergestellt`,
      chapters: snap.book.chapters.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        items: c.items.map((i) => {
          const e = snap.entries.find((e) => e.id === i.entry_id);
          return {
            ...i,
            id: crypto.randomUUID(),
            ...(e
              ? {
                  kind: "text" as const,
                  entry_id: null,
                  title: e.subtitle,
                  text: e.content,
                  media_ids: e.media_ids,
                }
              : {}),
          };
        }),
      })),
    };
    await save("books", restored);
    setVersions(null);
    setEditing(restored.id);
  }
  return (
    <section className="profile-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Aus Tagen wird eine Geschichte.</p>
          <h2>Deine RS- & WK-Bücher</h2>
        </div>
        <Button
          variant="outline"
          disabled={!periods.length}
          onClick={() => setCreating(true)}
        >
          <Plus size={16} />
          Buch erstellen
        </Button>
      </div>
      {!books.length ? (
        <Empty
          title="Ein Buch voller deiner Momente."
          text="Übernimm eine Dienstperiode und gestalte dein eigenes Erinnerungsbuch."
        />
      ) : (
        <div className="book-list">
          {books.map((b) => (
            <article key={b.id} className={`book-card cover-${b.template}`}>
              <button onClick={() => setEditing(b.id)}>
                <span className="eyebrow">
                  {
                    data!.service_periods.find((p) => p.id === b.period_id)
                      ?.type
                  }
                  -BUCH / ENTWURF
                </span>
                <h3>{b.title}</h3>
                <p>{b.subtitle}</p>
                <BookOpen size={22} />
              </button>
              <div>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setEditing(b.id)}
                >
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Buchversionen öffnen"
                  onClick={() => setVersions(b.id)}
                >
                  <History size={17} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Buchentwurf löschen"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Buchentwurf löschen?",
                        text: "Der Entwurf wird ausgeblendet. Bestehende Buchversionen und Freigaben müssen separat widerrufen werden.",
                        danger: true,
                      })
                    )
                      await save("books", {
                        ...b,
                        deleted_at: new Date().toISOString(),
                      });
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && (
        <Modal
          open
          onOpenChange={setCreating}
          title="Ein neues Erinnerungsbuch"
        >
          <div className="form-stack">
            <Field label="Dienstperiode">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {periods.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <p>
              Alle Einträge werden übernommen. Anschliessend kannst du Inhalte
              ausschliessen, Kapitel gestalten und die Reihenfolge ändern.
            </p>
            <Button
              onClick={() => void create().catch((e) => toast(message(e)))}
            >
              <Plus size={17} />
              {periods.find((p) => p.id === selectedPeriod)?.type ?? "RS"}-Buch
              erstellen
            </Button>
          </div>
        </Modal>
      )}
      {book && (
        <BookEditor
          book={book}
          onClose={() => setEditing(null)}
          onPreview={async (b) => setPreview(await snapshot(b))}
          onPublish={publish}
          onExport={async (b) => setExporting(await snapshot(b))}
        />
      )}
      {versions && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setVersions(null);
          }}
          title="Buchversionen"
        >
          <div className="version-list">
            {data?.book_versions
              .filter((v) => v.book_id === versions)
              .sort((a, b) => b.number - a.number)
              .map((v) => (
                <article key={v.id}>
                  <div>
                    <strong>
                      Version {v.number}{" "}
                      {v.archived ? "· archiviert" : "· veröffentlicht"}
                    </strong>
                    <p>
                      {dateLabel(v.created_at.slice(0, 10))} ·{" "}
                      {v.snapshot.entries.length} Einträge
                    </p>
                  </div>
                  <div className="actions">
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setPreview(v.snapshot)}
                    >
                      <Eye size={15} />
                      Lesen
                    </Button>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setSharing(v)}
                    >
                      <Share2 size={15} />
                      Freigeben
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Version als Entwurf wiederherstellen"
                      onClick={() => void restore(v)}
                    >
                      <RotateCcw size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        v.archived
                          ? "Version aus Archiv holen"
                          : "Version archivieren"
                      }
                      onClick={() =>
                        void archive(v).catch((e) => toast(message(e)))
                      }
                    >
                      <Archive size={16} />
                    </Button>
                  </div>
                </article>
              ))}
            {!data?.book_versions.some((v) => v.book_id === versions) && (
              <Empty
                title="Noch keine veröffentlichte Version."
                text="Erstelle im Bucheditor eine unveränderliche Version."
              />
            )}
          </div>
        </Modal>
      )}
      {preview && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setPreview(null);
          }}
          title="Buchvorschau"
          wide
        >
          <BookReader data={{ ...preview, media: undefined }} local />
        </Modal>
      )}
      {exporting && (
        <ExportDialog
          snapshot={exporting}
          entries={exporting.entries}
          period={exporting.period}
          onClose={() => setExporting(null)}
        />
      )}
      {sharing && (
        <ShareDialog
          kind="book"
          targetId={sharing.id}
          onClose={() => setSharing(null)}
        />
      )}
    </section>
  );
}
function BookEditor({
  book,
  onClose,
  onPreview,
  onPublish,
  onExport,
}: {
  book: Book;
  onClose: () => void;
  onPreview: (b: Book) => void;
  onPublish: (b: Book) => void;
  onExport: (b: Book) => void;
}) {
  const { save, data } = useStore(),
    toast = useToast(),
    confirm = useConfirm();
  const [value, setValue] = useState(book),
    [tab, setTab] = useState<"content" | "design">("content"),
    [status, setStatus] = useState("Gesichert");
  const baseline = useRef(book);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    if (value === book) return;
    setStatus("Wird gesichert …");
    const t = setTimeout(() => {
      const parsed = bookSchema.safeParse(value);
      if (!parsed.success) {
        setStatus(parsed.error.issues[0].message);
        return;
      }
      void save("books", value, baseline.current)
        .then((saved) => {
          baseline.current = saved;
        })
        .then(() => setStatus("Auf diesem Gerät gesichert"))
        .catch((e) => {
          setStatus("Speichern fehlgeschlagen");
          toast(message(e));
        });
    }, 600);
    return () => clearTimeout(t);
  }, [value, save]);
  async function flush() {
    bookSchema.parse(value);
    baseline.current = await save("books", value, baseline.current);
  }
  const entries = data!.diary_entries.filter(
      (e) => e.period_id === book.period_id && !e.deleted_at,
    ),
    media = data!.entry_media.filter((m) =>
      entries.some((e) => e.media_ids.includes(m.id)),
    );
  function chapter(id: string, patch: Partial<Chapter>) {
    setValue((v) => ({
      ...v,
      chapters: v.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }
  function move(chapterId: string, from: number, to: number) {
    const c = value.chapters.find((c) => c.id === chapterId)!;
    chapter(chapterId, { items: arrayMove(c.items, from, to) });
  }
  function drag(chapterId: string, event: DragEndEvent) {
    if (event.over && event.active.id !== event.over.id) {
      const c = value.chapters.find((c) => c.id === chapterId)!;
      move(
        chapterId,
        c.items.findIndex((i) => i.id === event.active.id),
        c.items.findIndex((i) => i.id === event.over!.id),
      );
    }
  }
  const addItem = (
    c: Chapter,
    kind: BookItem["kind"],
    entry_id: string | null = null,
  ) =>
    chapter(c.id, {
      items: [
        ...c.items,
        {
          id: crypto.randomUUID(),
          kind,
          entry_id,
          title: "",
          text: "",
          media_ids: [],
        },
      ],
    });
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v)
          void flush()
            .then(onClose)
            .catch((e) => toast(message(e)));
      }}
      title="Dein Buch gestalten"
      description="Ein eigener Ort für deine Erinnerungen."
      wide
    >
      <div className="book-editor">
        <div className="journal-tabs">
          <button
            className={tab === "content" ? "active" : ""}
            onClick={() => setTab("content")}
          >
            Inhalte
          </button>
          <button
            className={tab === "design" ? "active" : ""}
            onClick={() => setTab("design")}
          >
            Gestaltung
          </button>
          <span className="book-save-status" role="status">
            {status}
          </span>
        </div>
        <div className="form-stack">
          <Field label="Buchtitel">
            <input
              maxLength={160}
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
          </Field>
          <Field label="Untertitel">
            <input
              maxLength={200}
              value={value.subtitle}
              onChange={(e) => setValue({ ...value, subtitle: e.target.value })}
            />
          </Field>
          {tab === "design" ? (
            <>
              <div className="template-options">
                {(
                  [
                    {
                      id: "editorial",
                      title: "Editorial",
                      text: "Klare Typografie. Raum für Geschichten.",
                    },
                    {
                      id: "dienstbuch",
                      title: "Dienstbuch",
                      text: "Präzise Chronologie. Oliv und Sand.",
                    },
                    {
                      id: "fotoreportage",
                      title: "Fotoreportage",
                      text: "Grosse Bilder. Erinnerungen im Fokus.",
                    },
                  ] as const
                ).map((t) => (
                  <button
                    className={`template-option cover-${t.id}`}
                    key={t.id}
                    aria-pressed={value.template === t.id}
                    onClick={() => setValue({ ...value, template: t.id })}
                  >
                    <strong>{t.title}</strong>
                    <span>{t.text}</span>
                    {value.template === t.id && <Check size={16} />}
                  </button>
                ))}
              </div>
              <Field label="Akzentfarbe">
                <select
                  value={value.accent}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      accent: e.target.value as Book["accent"],
                    })
                  }
                >
                  <option value="olive">Oliv</option>
                  <option value="slate">Schiefer</option>
                  <option value="rust">Terrakotta</option>
                </select>
              </Field>
              <Field label="Coverbild">
                <select
                  value={value.cover_id ?? ""}
                  onChange={(e) =>
                    setValue({ ...value, cover_id: e.target.value || null })
                  }
                >
                  <option value="">Typografisches Cover</option>
                  {media.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Widmung">
                <textarea
                  value={value.dedication}
                  maxLength={10000}
                  onChange={(e) =>
                    setValue({ ...value, dedication: e.target.value })
                  }
                />
              </Field>
              <Field label="Einleitung">
                <textarea
                  rows={4}
                  value={value.intro}
                  maxLength={50000}
                  onChange={(e) =>
                    setValue({ ...value, intro: e.target.value })
                  }
                />
              </Field>
              {value.chapters.map((c, ci) => (
                <section className="chapter-editor" key={c.id}>
                  <header>
                    <span className="eyebrow">
                      {String(ci + 1).padStart(2, "0")}
                    </span>
                    <input
                      aria-label={`Titel Kapitel ${ci + 1}`}
                      value={c.title}
                      onChange={(e) => chapter(c.id, { title: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Kapitel nach oben"
                      disabled={ci === 0}
                      onClick={() =>
                        setValue({
                          ...value,
                          chapters: arrayMove(value.chapters, ci, ci - 1),
                        })
                      }
                    >
                      <ArrowUp size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Kapitel nach unten"
                      disabled={ci === value.chapters.length - 1}
                      onClick={() =>
                        setValue({
                          ...value,
                          chapters: arrayMove(value.chapters, ci, ci + 1),
                        })
                      }
                    >
                      <ArrowDown size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Kapitel entfernen"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "Kapitel aus dem Buch entfernen?",
                            text: "Deine ursprünglichen Tagebucheinträge bleiben erhalten.",
                          })
                        )
                          setValue({
                            ...value,
                            chapters: value.chapters.filter(
                              (ch) => ch.id !== c.id,
                            ),
                          });
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </header>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => drag(c.id, e)}
                  >
                    <SortableContext
                      items={c.items.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {c.items.map((item, index) => (
                        <SortableBookItem
                          key={item.id}
                          item={item}
                          title={
                            item.kind === "entry"
                              ? (entries.find((e) => e.id === item.entry_id)
                                  ?.subtitle ?? "Eintrag nicht mehr verfügbar")
                              : item.kind === "gallery"
                                ? "Bildergalerie"
                                : "Freier Text"
                          }
                          index={index}
                          count={c.items.length}
                          onMove={(direction) =>
                            move(c.id, index, index + direction)
                          }
                          onRemove={() =>
                            chapter(c.id, {
                              items: c.items.filter((i) => i.id !== item.id),
                            })
                          }
                        >
                          <>
                            {item.kind !== "entry" && (
                              <div className="item-fields">
                                <input
                                  aria-label="Abschnittstitel"
                                  placeholder="Abschnittstitel"
                                  value={item.title}
                                  onChange={(e) =>
                                    chapter(c.id, {
                                      items: c.items.map((i) =>
                                        i.id === item.id
                                          ? { ...i, title: e.target.value }
                                          : i,
                                      ),
                                    })
                                  }
                                />
                                <textarea
                                  aria-label="Buchtext"
                                  placeholder="Dein Buchtext …"
                                  value={item.text}
                                  onChange={(e) =>
                                    chapter(c.id, {
                                      items: c.items.map((i) =>
                                        i.id === item.id
                                          ? { ...i, text: e.target.value }
                                          : i,
                                      ),
                                    })
                                  }
                                />
                                <details>
                                  <summary>
                                    Fotos auswählen ({item.media_ids.length})
                                  </summary>
                                  {media.map((m) => (
                                    <label className="check-row" key={m.id}>
                                      <input
                                        type="checkbox"
                                        checked={item.media_ids.includes(m.id)}
                                        onChange={() =>
                                          chapter(c.id, {
                                            items: c.items.map((i) =>
                                              i.id === item.id
                                                ? {
                                                    ...i,
                                                    media_ids:
                                                      i.media_ids.includes(m.id)
                                                        ? i.media_ids.filter(
                                                            (id) => id !== m.id,
                                                          )
                                                        : [
                                                            ...i.media_ids,
                                                            m.id,
                                                          ],
                                                  }
                                                : i,
                                            ),
                                          })
                                        }
                                      />
                                      {m.name}
                                    </label>
                                  ))}
                                </details>
                              </div>
                            )}
                          </>
                        </SortableBookItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                  <div className="chapter-add">
                    <select
                      aria-label="Tagebucheintrag ergänzen"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) addItem(c, "entry", e.target.value);
                      }}
                    >
                      <option value="">+ Tagebucheintrag ergänzen</option>
                      {entries.map((e) => (
                        <option key={e.id} value={e.id}>
                          {dateLabel(e.date)} ·{" "}
                          {e.subtitle || "Ohne Untertitel"}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => addItem(c, "text")}
                    >
                      + Freier Text
                    </Button>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => addItem(c, "gallery")}
                    >
                      + Galerie
                    </Button>
                  </div>
                </section>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setValue({
                    ...value,
                    chapters: [
                      ...value.chapters,
                      {
                        id: crypto.randomUUID(),
                        title: "Neues Kapitel",
                        items: [],
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Kapitel hinzufügen
              </Button>
              <Field label="Schlusswort">
                <textarea
                  rows={4}
                  value={value.outro}
                  maxLength={50000}
                  onChange={(e) =>
                    setValue({ ...value, outro: e.target.value })
                  }
                />
              </Field>
            </>
          )}
        </div>
        <div className="book-editor-footer">
          <Button
            variant="outline"
            onClick={() =>
              void flush()
                .then(() => onPreview(value))
                .catch((e) => toast(message(e)))
            }
          >
            <Eye size={16} />
            Vorschau
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void flush()
                .then(() => onExport(value))
                .catch((e) => toast(message(e)))
            }
          >
            <Download size={16} />
            PDF
          </Button>
          <Button
            onClick={() =>
              void flush()
                .then(() => onPublish(value))
                .catch((e) => toast(message(e)))
            }
          >
            <Check size={16} />
            Version veröffentlichen
          </Button>
        </div>
      </div>
    </Modal>
  );
}
function SortableBookItem({
  item,
  title,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  item: BookItem;
  title: string;
  index: number;
  count: number;
  onMove: (n: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className="sortable-item"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="sortable-row">
        <button
          className="drag-handle"
          aria-label="Abschnitt ziehen"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={17} />
        </button>
        <span>{title}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abschnitt nach oben"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abschnitt nach unten"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abschnitt ausschliessen"
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </Button>
      </div>
      {children}
    </div>
  );
}
