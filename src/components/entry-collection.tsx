"use client";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Star } from "lucide-react";
import {
  dateLabel,
  entryTitle,
  serviceDay,
  serviceWeek,
} from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

export type ReadableEntry = {
  id: string;
  date: string;
  subtitle: string;
  content: string;
  milestone: boolean;
  cover_id: string | null;
  media_ids: string[];
  start_date?: string | null;
  visibility?: string;
};

export function readableTitle(entry: ReadableEntry, startDate?: string | null) {
  const start = startDate ?? entry.start_date;
  return start ? entryTitle(entry.date, start) : dateLabel(entry.date);
}

/** Read access is the default. Owner controls are supplied explicitly by Journal. */
export function EntryCollection<T extends ReadableEntry>({
  entries,
  view,
  startDate,
  onOpen,
  renderPhoto,
  renderHeader,
  renderActions,
  feed = false,
}: {
  entries: T[];
  view: "grid" | "timeline" | "cards";
  startDate?: string;
  onOpen: (entry: T) => void;
  renderPhoto: (id: string, alt: string) => ReactNode;
  renderHeader?: (entry: T) => ReactNode;
  renderActions?: (entry: T) => ReactNode;
  feed?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <div className={cn("entries", `entries-${view}`, feed && "social-entries")}>
      {entries.map((entry, i) => {
        const start = startDate ?? entry.start_date;
        const coverId = entry.cover_id ?? (feed ? entry.media_ids[0] : null);
        return (
          <motion.article
            key={entry.id}
            className={cn(
              "entry-card",
              entry.milestone && "is-milestone",
              !coverId && "text-card",
            )}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.025 }}
          >
            {renderHeader?.(entry)}
            <button
              className="entry-open"
              aria-label={`${readableTitle(entry, startDate)}${entry.subtitle ? `: ${entry.subtitle}` : ""}`}
              onClick={() => onOpen(entry)}
            >
              {(view !== "cards" || feed) &&
                (coverId ? (
                  <div className="entry-image">
                    {renderPhoto(coverId, entry.subtitle || "Tagebuchfoto")}
                    <span className="photo-count">
                      {entry.media_ids.length.toString().padStart(2, "0")} /
                      FOTOS
                    </span>
                  </div>
                ) : !feed ? (
                  <div className="entry-type-cover">
                    {start && (
                      <span className="cover-week">
                        WOCHE{" "}
                        {serviceWeek(start, entry.date)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    )}
                    <span className="cover-day">
                      {dateLabel(entry.date, { day: "2-digit" })}
                      <small>
                        /{dateLabel(entry.date, { month: "2-digit" })}
                      </small>
                    </span>
                    <span className="cover-note">Ein Tag, der bleibt.</span>
                  </div>
                ) : null)}
              {view === "cards" && !feed && (
                <div className="compact-date">
                  <strong>{dateLabel(entry.date, { day: "2-digit" })}</strong>
                  <span>{dateLabel(entry.date, { month: "short" })}</span>
                </div>
              )}
              <div className="entry-body">
                <p className="entry-date">{readableTitle(entry, startDate)}</p>
                <h3>{entry.subtitle || "Ein Tag, der bleibt."}</h3>
                {feed && <p className="entry-preview">{entry.content}</p>}
                <div className="entry-meta">
                  {start && (
                    <span>
                      TAG{" "}
                      {serviceDay(start, entry.date)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                  )}
                  <span>
                    {entry.milestone ? (
                      <>
                        <Star size={13} aria-hidden="true" /> MEILENSTEIN
                      </>
                    ) : entry.visibility === "private" ? (
                      "PRIVAT"
                    ) : (
                      "FREIGEGEBEN"
                    )}
                  </span>
                  <ArrowUpRight size={16} />
                </div>
              </div>
            </button>
            {feed && entry.media_ids.length > 1 && (
              <div className="social-thumbnails">
                {entry.media_ids
                  .filter((id) => id !== coverId)
                  .map((id, index) => (
                    <button
                      key={id}
                      onClick={() => onOpen(entry)}
                      aria-label={`Galerie öffnen, Foto ${index + 2}`}
                    >
                      {renderPhoto(id, `Tagebuchfoto ${index + 2}`)}
                    </button>
                  ))}
              </div>
            )}
            {renderActions?.(entry)}
          </motion.article>
        );
      })}
    </div>
  );
}
