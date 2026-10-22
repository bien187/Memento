"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, useReducedMotion } from "motion/react";
import {
  LayoutGrid,
  List,
  Rows3,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  ArrowUpRight,
  ArrowDownWideNarrow,
  PenLine,
  Trash2,
  Download,
  LockKeyhole,
} from "lucide-react";
import type { Entry, Period } from "@/lib/domain/models";
import {
  entryTitle,
  dateLabel,
  serviceWeek,
  serviceDay,
  dayNumber,
} from "@/lib/domain/dates";
import { db } from "@/lib/local/db";
import { Button, Empty, Modal, useConfirm, useToast } from "./ui";
import { Photo, Gallery } from "./media";
import { useStore } from "./store";
import { ExportDialog } from "./export";
import { cn, message } from "@/lib/utils";
export function Journal({
  period,
  entries,
  onCreate,
  onEdit,
}: {
  period: Period;
  entries: Entry[];
  onCreate: (date?: string) => void;
  onEdit: (entry: Entry) => void;
}) {
  const { data, setPreferences, save, identity } = useStore(),
    confirm = useConfirm(),
    toast = useToast(),
    reduced = useReducedMotion();
  const view = data?.user_preferences[0]?.view ?? "grid";
  const [search, setSearch] = useState(""),
    [milestones, setMilestones] = useState(false),
    [week, setWeek] = useState(""),
    [sort, setSort] = useState("desc"),
    [filters, setFilters] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [reader, setReader] = useState<Entry | null>(null),
    [gallery, setGallery] = useState<{ ids: string[]; start: number } | null>(
      null,
    ),
    [exporting, setExporting] = useState(false);
  const drafts = useLiveQuery(
    () => db.drafts.where("owner_id").equals(identity!.id).toArray(),
    [identity?.id],
  );
  const currentReader = reader
    ? (entries.find((e) => e.id === reader.id) ?? null)
    : null;
  const visible = entries
    .filter(
      (e) =>
        (!milestones || e.milestone) &&
        (!week || serviceWeek(period.start_date, e.date) === Number(week)) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to) &&
        `${e.subtitle} ${e.content}`
          .toLocaleLowerCase("de-CH")
          .includes(search.toLocaleLowerCase("de-CH")),
    )
    .sort((a, b) =>
      sort === "desc"
        ? b.date.localeCompare(a.date) ||
          b.created_at.localeCompare(a.created_at)
        : a.date.localeCompare(b.date) ||
          a.created_at.localeCompare(b.created_at),
    );
  async function star(entry: Entry) {
    if (
      entry.milestone &&
      !(await confirm({
        title: "Meilensteinmarkierung entfernen?",
        text: "Der Eintrag und alle Bilder bleiben erhalten.",
        label: "Markierung entfernen",
      }))
    )
      return;
    await save("diary_entries", { ...entry, milestone: !entry.milestone });
    toast(
      entry.milestone
        ? "Markierung entfernt."
        : "Als Meilenstein festgehalten.",
    );
  }
  const documented = new Set(entries.map((e) => e.date)).size,
    total = dayNumber(period.end_date) - dayNumber(period.start_date) + 1;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Dein persönliches Tagebuch</p>
          <h1>
            Meine Erinnerungen<span className="heading-dot">.</span>
          </h1>
          <p className="muted">Was du erlebst, verdient einen Platz.</p>
        </div>
        <Button className="desktop-action" onClick={() => onCreate()}>
          <Plus size={17} />
          Eintrag schreiben
        </Button>
      </div>
      <section className="period-summary">
        <div className="period-summary-title">
          <span className="period-type">{period.type}</span>
          <div>
            <h2>{period.title}</h2>
            <p>
              {dateLabel(period.start_date)} — {dateLabel(period.end_date)}
            </p>
          </div>
        </div>
        <div className="period-numbers">
          <div>
            <strong>{entries.length.toString().padStart(2, "0")}</strong>
            <span>Einträge</span>
          </div>
          <div>
            <strong>
              {entries
                .filter((e) => e.milestone)
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <span>Meilensteine</span>
          </div>
          <div className="documented">
            <strong>
              {documented}
              <small>/{total}</small>
            </strong>
            <span>Tage festgehalten</span>
          </div>
        </div>
      </section>
      {drafts
        ?.filter((d) => d.data.period_id === period.id)
        .map((d) => (
          <div className="draft-banner" key={d.id}>
            <PenLine size={16} />
            <span>Ein gesicherter Entwurf wartet auf dich.</span>
            <Button variant="ghost" size="small" onClick={() => onEdit(d.data)}>
              Fortsetzen
              <ArrowUpRight size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Entwurf verwerfen"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Entwurf verwerfen?",
                    text: "Dieser lokale Entwurf wird gelöscht.",
                    danger: true,
                  })
                )
                  await db.drafts.delete(d.id);
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      <div className="journal-tabs">
        <button
          className={!milestones ? "active" : ""}
          onClick={() => setMilestones(false)}
        >
          Alle Erinnerungen <span>{entries.length}</span>
        </button>
        <button
          className={milestones ? "active" : ""}
          onClick={() => setMilestones(true)}
        >
          <Star size={15} />
          Meilensteine <span>{entries.filter((e) => e.milestone).length}</span>
        </button>
        <button
          className="export-short"
          aria-label="PDF exportieren"
          onClick={() => setExporting(true)}
        >
          <Download size={17} />
        </button>
      </div>
      <div className="journal-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Einträge durchsuchen"
            placeholder="Erinnerungen durchsuchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-right">
          <Button
            variant="outline"
            size="icon"
            aria-label="Filter anzeigen"
            aria-pressed={filters}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} />
          </Button>
          <div
            className="view-switch"
            role="group"
            aria-label="Tagebuchansicht"
          >
            {(
              [
                { key: "grid", icon: LayoutGrid, label: "Kachelansicht" },
                { key: "timeline", icon: List, label: "Timeline" },
                { key: "cards", icon: Rows3, label: "Kartenansicht" },
              ] as const
            ).map((v) => (
              <button
                key={v.key}
                aria-label={v.label}
                aria-pressed={view === v.key}
                onClick={() => void setPreferences({ view: v.key })}
              >
                <v.icon size={17} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {filters && (
        <div className="filter-panel">
          <label>
            Von
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Bis
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label>
            Dienstwoche
            <select value={week} onChange={(e) => setWeek(e.target.value)}>
              <option value="">Alle Wochen</option>
              {Array.from({ length: Math.ceil(total / 7) }, (_, i) => (
                <option key={i} value={i + 1}>
                  Woche {i + 1}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
              setWeek("");
            }}
          >
            Zurücksetzen
          </Button>
        </div>
      )}
      <div className="list-meta">
        <span>
          {visible.length}{" "}
          {visible.length === 1 ? "Erinnerung" : "Erinnerungen"}
        </span>
        <button onClick={() => setSort(sort === "desc" ? "asc" : "desc")}>
          <ArrowDownWideNarrow size={14} />
          {sort === "desc" ? "Neueste zuerst" : "Älteste zuerst"}
        </button>
      </div>
      {!visible.length ? (
        <Empty
          title={
            search || milestones || week || from || to
              ? "Keine passenden Erinnerungen."
              : "Jede Geschichte beginnt mit einem Tag."
          }
          text={
            entries.length
              ? "Passe deine Suche oder die Filter an."
              : "Dein erster Eintrag muss nicht perfekt sein. Nur deiner."
          }
          action={
            !entries.length && (
              <Button onClick={() => onCreate()}>
                <Plus size={17} />
                Ersten Eintrag schreiben
              </Button>
            )
          }
        />
      ) : (
        <div className={cn("entries", `entries-${view}`)}>
          {visible.map((entry, i) => (
            <motion.article
              key={entry.id}
              className={cn(
                "entry-card",
                entry.milestone && "is-milestone",
                !entry.cover_id && "text-card",
              )}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.025 }}
            >
              <button
                className="entry-open"
                aria-label={`${entryTitle(entry.date, period.start_date)}${entry.subtitle ? `: ${entry.subtitle}` : ""}`}
                onClick={() => setReader(entry)}
              >
                {view !== "cards" &&
                  (entry.cover_id ? (
                    <div className="entry-image">
                      <Photo
                        id={entry.cover_id}
                        alt={entry.subtitle || "Tagebuchfoto"}
                      />
                      <span className="photo-count">
                        {entry.media_ids.length.toString().padStart(2, "0")} /
                        FOTOS
                      </span>
                    </div>
                  ) : (
                    <div className="entry-type-cover">
                      <span className="cover-week">
                        WOCHE{" "}
                        {serviceWeek(period.start_date, entry.date)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                      <span className="cover-day">
                        {dateLabel(entry.date, { day: "2-digit" })}
                        <small>
                          /{dateLabel(entry.date, { month: "2-digit" })}
                        </small>
                      </span>
                      <span className="cover-note">Ein Tag, der bleibt.</span>
                    </div>
                  ))}
                {view === "cards" && (
                  <div className="compact-date">
                    <strong>{dateLabel(entry.date, { day: "2-digit" })}</strong>
                    <span>{dateLabel(entry.date, { month: "short" })}</span>
                  </div>
                )}
                <div className="entry-body">
                  <p className="entry-date">
                    {entryTitle(entry.date, period.start_date)}
                  </p>
                  <h3>{entry.subtitle || "Ein Tag, der bleibt."}</h3>
                  <div className="entry-meta">
                    <span>
                      TAG{" "}
                      {serviceDay(period.start_date, entry.date)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                    <span>
                      {entry.milestone
                        ? "MEILENSTEIN"
                        : entry.visibility === "private"
                          ? "PRIVAT"
                          : "FREIGEGEBEN"}
                    </span>
                    <ArrowUpRight size={16} />
                  </div>
                </div>
              </button>
              <button
                className="star-button"
                aria-label={
                  entry.milestone
                    ? "Meilenstein entfernen"
                    : "Als Meilenstein markieren"
                }
                aria-pressed={entry.milestone}
                onClick={() => void star(entry).catch((e) => toast(message(e)))}
              >
                <Star
                  size={17}
                  fill={entry.milestone ? "currentColor" : "none"}
                />
              </button>
            </motion.article>
          ))}
        </div>
      )}
      {currentReader && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setReader(null);
          }}
          title={entryTitle(currentReader.date, period.start_date)}
          wide
        >
          <article className="reader">
            <p className="eyebrow">
              Tag {serviceDay(period.start_date, currentReader.date)} /{" "}
              {currentReader.visibility === "private"
                ? "Privater Eintrag"
                : "Freigegebener Eintrag"}
            </p>
            <h2>{currentReader.subtitle || "Ein Tag, der bleibt."}</h2>
            <div className="reader-photos">
              {currentReader.media_ids.map((id, i) => (
                <button
                  key={id}
                  onClick={() =>
                    setGallery({ ids: currentReader.media_ids, start: i })
                  }
                >
                  <Photo id={id} alt={`Tagebuchfoto ${i + 1}`} />
                </button>
              ))}
            </div>
            <FormattedText text={currentReader.content} />
            <div className="reader-values">
              {currentReader.mood !== null && (
                <span>
                  Stimmung <strong>{currentReader.mood}/100</strong>
                </span>
              )}
              {currentReader.condition !== null && (
                <span>
                  Verfassung <strong>{currentReader.condition}/100</strong>
                </span>
              )}
            </div>
            <div className="actions">
              <Button
                onClick={() => {
                  onEdit(currentReader);
                  setReader(null);
                }}
              >
                <PenLine size={16} />
                Bearbeiten
              </Button>
              <Button
                variant="outline"
                onClick={() => void star(currentReader)}
              >
                <Star size={16} />
                Meilenstein
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setExporting(true);
                }}
              >
                PDF
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eintrag löschen"
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Eintrag löschen?",
                      text: "Der Eintrag wird aus deinem Tagebuch entfernt. Bereits veröffentlichte Buchversionen bleiben erhalten.",
                      label: "Eintrag löschen",
                      danger: true,
                    })
                  ) {
                    await save("diary_entries", {
                      ...currentReader,
                      deleted_at: new Date().toISOString(),
                    });
                    setReader(null);
                    toast("Eintrag gelöscht.");
                  }
                }}
              >
                <Trash2 size={17} />
              </Button>
            </div>
          </article>
        </Modal>
      )}
      {gallery && <Gallery {...gallery} onClose={() => setGallery(null)} />}
      {exporting && (
        <ExportDialog
          entries={currentReader ? [currentReader] : visible}
          period={period}
          onClose={() => setExporting(false)}
        />
      )}
    </>
  );
}
export function FormattedText({ text }: { text: string }) {
  return (
    <div className="prose">
      {text.split("\n").map((line, i) => (
        <p key={i}>
          {line
            .split(/(\*\*.*?\*\*|_.*?_)/g)
            .map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : part.startsWith("_") && part.endsWith("_") ? (
                <em key={j}>{part.slice(1, -1)}</em>
              ) : (
                part || "\u00a0"
              ),
            )}
        </p>
      ))}
    </div>
  );
}
