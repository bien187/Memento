"use client";
import { useState, useEffect, useRef } from "react";
import {
  Check,
  CloudOff,
  ImagePlus,
  Star,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Bold,
  Italic,
  LoaderCircle,
} from "lucide-react";
import {
  baseRecord,
  entryInputSchema,
  scaleLabel,
  type Entry,
  type Period,
} from "@/lib/domain/models";
import { today, inPeriod, entryTitle } from "@/lib/domain/dates";
import { db } from "@/lib/local/db";
import { prepareImage } from "@/lib/local/media";
import { useStore } from "./store";
import { Modal, Button, Field, useToast, useConfirm } from "./ui";
import { Photo } from "./media";
import { message } from "@/lib/utils";
export function EntryEditor({
  period,
  initial,
  date,
  onClose,
}: {
  period: Period;
  initial?: Entry;
  date?: string;
  onClose: () => void;
}) {
  const { identity, save } = useStore(),
    toast = useToast(),
    confirm = useConfirm();
  const [value, setValue] = useState<Entry>(
    () =>
      initial ?? {
        ...baseRecord(identity!.id),
        period_id: period.id,
        date:
          date ??
          (inPeriod(today(), period.start_date, period.end_date)
            ? today()
            : period.start_date),
        subtitle: "",
        content: "",
        mood: null,
        condition: null,
        milestone: false,
        visibility: "private",
        media_ids: [],
        cover_id: null,
        created_at: new Date().toISOString(),
      },
  );
  const [status, setStatus] = useState("Noch keine Änderungen"),
    [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState(false),
    [changed, setChanged] = useState(false),
    [uploadProgress, setUploadProgress] = useState(0);
  const text = useRef<HTMLTextAreaElement>(null),
    baseline = useRef<Entry | null>(initial ?? null),
    latest = useRef(value),
    committed = useRef(false),
    saveChain = useRef(Promise.resolve());
  latest.current = value;
  const change = (next: Entry) => {
    setValue(next);
    setChanged(true);
    setStatus("Wird lokal gesichert …");
  };
  async function persist(next: Entry, final = false) {
    const parsed = entryInputSchema.parse(next);
    if (!inPeriod(next.date, period.start_date, period.end_date))
      throw new Error("Das Datum muss innerhalb der Dienstperiode liegen.");
    if (
      !parsed.content.trim() &&
      !parsed.subtitle.trim() &&
      !parsed.media_ids.length &&
      parsed.mood === null &&
      parsed.condition === null
    )
      throw new Error(
        "Halte zuerst einen Gedanken, ein Bild oder eine Bewertung fest.",
      );
    baseline.current = await save(
      "diary_entries",
      { ...next, ...parsed },
      baseline.current ?? undefined,
    );
    for (const id of next.media_ids) {
      const media = await db.entry_media.get(id);
      if (media && !media.storage_path) await save("entry_media", media);
    }
    if (final || initial) await db.drafts.delete(next.id);
  }
  useEffect(() => {
    if (!changed || committed.current) return;
    const timer = setTimeout(() => {
      saveChain.current = saveChain.current
        .then(async () => {
          if (committed.current) return;
          const data = latest.current;
          await db.drafts.put({
            id: data.id,
            owner_id: identity!.id,
            data,
            updated_at: new Date().toISOString(),
          });
          setStatus("Entwurf auf diesem Gerät gesichert");
          if (initial) {
            await persist(data);
            setStatus(
              identity?.mode === "cloud"
                ? "Lokal gesichert · Synchronisation vorgemerkt"
                : "Auf diesem Gerät gesichert",
            );
          }
        })
        .catch((e) => {
          setStatus("Speichern fehlgeschlagen");
          toast(message(e));
        });
    }, 450);
    return () => clearTimeout(timer);
    // persist closes over current owner/mode; entry editor is mounted per entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, changed]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (changed && status === "Wird lokal gesichert …") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [changed, status]);
  async function close() {
    if (changed && !committed.current) {
      committed.current = true;
      await saveChain.current;
      await db.drafts.put({
        id: value.id,
        owner_id: identity!.id,
        data: latest.current,
        updated_at: new Date().toISOString(),
      });
      if (initial) {
        try {
          await persist(latest.current, true);
        } catch (e) {
          toast(message(e));
        }
      }
    }
    onClose();
  }
  async function finish() {
    setSaving(true);
    try {
      committed.current = true;
      await saveChain.current;
      await persist(latest.current, true);
      toast(
        identity?.mode === "cloud"
          ? "Eintrag lokal gespeichert. Synchronisation wird ausgeführt."
          : "Eintrag gespeichert.",
      );
      onClose();
    } catch (e) {
      committed.current = false;
      toast(message(e));
    } finally {
      setSaving(false);
    }
  }
  async function files(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (value.media_ids.length + selected.length > 4)
      return toast("Pro Eintrag sind höchstens vier Bilder möglich.");
    setUploading(true);
    try {
      let next = latest.current;
      for (let i = 0; i < selected.length; i++) {
        const media = await prepareImage(selected[i], identity!.id, value.id);
        await db.entry_media.put(media);
        next = {
          ...next,
          media_ids: [...next.media_ids, media.id],
          cover_id: next.cover_id ?? media.id,
        };
        setUploadProgress(Math.round(((i + 1) / selected.length) * 100));
      }
      change(next);
    } catch (e) {
      toast(message(e));
    } finally {
      setUploading(false);
    }
  }
  function format(mark: string) {
    const el = text.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    change({
      ...value,
      content:
        value.content.slice(0, start) +
        mark +
        value.content.slice(start, end) +
        mark +
        value.content.slice(end),
    });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + mark.length, end + mark.length);
    });
  }
  function reorder(index: number, direction: number) {
    const ids = [...value.media_ids];
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    change({ ...value, media_ids: ids });
  }
  const validDate =
    !!value.date && inPeriod(value.date, period.start_date, period.end_date);
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) void close();
      }}
      title={initial ? "Erinnerung bearbeiten" : "Eine neue Erinnerung"}
      description="Deine Gedanken. Dein Moment."
      wide
    >
      <form
        className="entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          void finish();
        }}
      >
        <div className="editor-top">
          <Field label="Ereignisdatum">
            <input
              type="date"
              min={period.start_date}
              max={period.end_date}
              required
              value={value.date}
              onChange={(e) => change({ ...value, date: e.target.value })}
            />
          </Field>
          <button
            type="button"
            className={`milestone-toggle ${value.milestone ? "active" : ""}`}
            aria-pressed={value.milestone}
            onClick={async () => {
              if (
                value.milestone &&
                !(await confirm({
                  title: "Meilensteinmarkierung entfernen?",
                  text: "Dein Eintrag bleibt erhalten.",
                }))
              )
                return;
              change({ ...value, milestone: !value.milestone });
            }}
          >
            <Star size={19} fill={value.milestone ? "currentColor" : "none"} />
            <span>Meilenstein</span>
          </button>
        </div>
        <p className="eyebrow">
          {validDate
            ? entryTitle(value.date, period.start_date)
            : "Datum innerhalb der Dienstperiode wählen"}
        </p>
        <Field label="Untertitel (optional)">
          <input
            className="subtitle-input"
            placeholder="Was bleibt von diesem Tag?"
            maxLength={160}
            value={value.subtitle}
            onChange={(e) => change({ ...value, subtitle: e.target.value })}
          />
        </Field>
        <Field label="Deine Erinnerung">
          <div className="writing-area">
            <div className="format-tools">
              <button
                type="button"
                aria-label="Fett formatieren"
                onClick={() => format("**")}
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                aria-label="Kursiv formatieren"
                onClick={() => format("_")}
              >
                <Italic size={16} />
              </button>
              <small>Platz für deine Gedanken.</small>
            </div>
            <textarea
              ref={text}
              rows={9}
              placeholder="Heute …"
              maxLength={100000}
              value={value.content}
              onChange={(e) => change({ ...value, content: e.target.value })}
            />
          </div>
        </Field>
        <div className="editor-images">
          {value.media_ids.map((id, i) => (
            <div key={id}>
              <Photo id={id} alt={`Bild ${i + 1}`} />
              <div className="image-tools">
                <button
                  type="button"
                  aria-label={`Bild ${i + 1} als Titelbild`}
                  className={value.cover_id === id ? "active" : ""}
                  onClick={() => change({ ...value, cover_id: id })}
                >
                  <Star size={14} />
                </button>
                <button
                  type="button"
                  disabled={i === 0}
                  aria-label={`Bild ${i + 1} nach links`}
                  onClick={() => reorder(i, -1)}
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={i === value.media_ids.length - 1}
                  aria-label={`Bild ${i + 1} nach rechts`}
                  onClick={() => reorder(i, 1)}
                >
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Bild ${i + 1} entfernen`}
                  onClick={() => {
                    const ids = value.media_ids.filter((m) => m !== id);
                    change({
                      ...value,
                      media_ids: ids,
                      cover_id:
                        value.cover_id === id
                          ? (ids[0] ?? null)
                          : value.cover_id,
                    });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <label className="image-upload">
          <ImagePlus size={20} />
          <span>
            {uploading
              ? `Bilder vorbereiten · ${uploadProgress}%`
              : `Bilder hinzufügen (${value.media_ids.length}/4)`}
          </span>
          <input
            type="file"
            aria-label="Bilder hinzufügen"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            disabled={uploading || value.media_ids.length === 4}
            onChange={(e) => {
              void files(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="fineprint">
          Keine klassifizierten Informationen, sicherheitsrelevanten Details
          oder unzulässigen Aufnahmen hochladen. Bildmetadaten werden bei der
          Komprimierung entfernt.
        </p>
        <div className="scales">
          <Scale
            kind="mood"
            label="Wie geht es dir?"
            value={value.mood}
            onChange={(mood) => change({ ...value, mood })}
          />
          <Scale
            kind="condition"
            label="Wie fühlt sich dein Körper an?"
            value={value.condition}
            onChange={(condition) => change({ ...value, condition })}
          />
        </div>
        <Field
          label="Sichtbarkeit"
          hint="Eine Freigabe per Link muss zusätzlich im Profil eingerichtet werden."
        >
          <select
            value={value.visibility}
            onChange={async (e) => {
              const visibility = e.target.value as Entry["visibility"];
              if (
                visibility !== "private" &&
                !(await confirm({
                  title: "Eintrag zur Freigabe vorsehen?",
                  text: "Stimmung und Verfassung bleiben privat. Bitte keine geschützten militärischen Informationen teilen.",
                  label: "Sichtbarkeit ändern",
                }))
              )
                return;
              change({ ...value, visibility });
            }}
          >
            <option value="private">Privat · nur für mich</option>
            <option value="followers">Für bestätigte Follower</option>
            <option value="link">Für Freigabelinks</option>
            <option value="public">Öffentlich in der Community</option>
          </select>
        </Field>
        <div className="editor-footer">
          <span role="status">
            {status.includes("fehl") ? (
              <CloudOff size={14} />
            ) : (
              <Check size={14} />
            )}{" "}
            {status}
          </span>
          <Button type="submit" disabled={saving || uploading}>
            {saving ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            Eintrag speichern
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Scale({
  kind,
  label,
  value,
  onChange,
}: {
  kind: "mood" | "condition";
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <div className={`scale scale-${kind}`}>
      <div>
        <label htmlFor={`scale-${kind}`}>{label}</label>
        <button
          type="button"
          className="text-button"
          onClick={() => onChange(value === null ? 50 : null)}
        >
          {value === null ? "Bewerten" : "Zurücksetzen"}
        </button>
      </div>
      <p>
        {scaleLabel(value, kind)}
        <strong>{value === null ? "—" : value}</strong>
      </p>
      <input
        id={`scale-${kind}`}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value ?? 50}
        aria-label={kind === "mood" ? "Stimmung" : "Körperliche Verfassung"}
        aria-valuetext={
          value === null
            ? "Nicht bewertet"
            : `${value} von 100, ${scaleLabel(value, kind)}`
        }
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="scale-labels">
        <span>{kind === "mood" ? "Sehr belastet" : "Stark erschöpft"}</span>
        <span>{kind === "mood" ? "Sehr positiv" : "Voller Energie"}</span>
      </div>
    </div>
  );
}
