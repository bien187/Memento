"use client";
import { motion, useReducedMotion } from "motion/react";
import { Star, ArrowDown, BookOpen } from "lucide-react";
import type { Book, Entry, Period } from "@/lib/domain/models";
import { entryTitle, dateLabel } from "@/lib/domain/dates";
import { FormattedText } from "./journal";
import { Photo } from "./media";
export type ReadingData = {
  display_name: string;
  period: Pick<Period, "title" | "type" | "start_date" | "end_date">;
  book: Pick<
    Book,
    | "title"
    | "subtitle"
    | "dedication"
    | "intro"
    | "outro"
    | "template"
    | "accent"
    | "cover_id"
    | "chapters"
  >;
  entries: Pick<
    Entry,
    | "id"
    | "date"
    | "subtitle"
    | "content"
    | "milestone"
    | "media_ids"
    | "cover_id"
  >[];
  media?: { id: string; url: string }[];
};
export function BookReader({
  data,
  local = false,
}: {
  data: ReadingData;
  local?: boolean;
}) {
  const reduced = useReducedMotion();
  const picture = (id: string, index = 0) =>
    local ? (
      <Photo key={id} id={id} alt={`Erinnerungsfoto ${index + 1}`} />
    ) : (
      <img
        key={id}
        src={data.media?.find((m) => m.id === id)?.url}
        alt={`Erinnerungsfoto ${index + 1}`}
        loading="lazy"
      />
    );
  const entry = (e: ReadingData["entries"][number]) => (
    <motion.section
      key={e.id}
      className="reading-entry"
      initial={reduced ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
    >
      <p className="eyebrow">{entryTitle(e.date, data.period.start_date)}</p>
      <h2>{e.subtitle || "Ein Tag, der bleibt."}</h2>
      {e.milestone && (
        <p className="reading-milestone">
          <Star size={14} />
          Ein Meilenstein
        </p>
      )}
      <FormattedText text={e.content} />
      {e.media_ids.length > 0 && (
        <div className={`reading-images images-${e.media_ids.length}`}>
          {e.media_ids.map(picture)}
        </div>
      )}
    </motion.section>
  );
  return (
    <article
      className={`book-reading template-${data.book.template} accent-${data.book.accent}`}
    >
      <header className="reading-brand">
        <img src="/logo.svg" width={28} height={28} alt="Memento" />
        <span>MEMENTO / EIN PERSÖNLICHES JOURNAL</span>
      </header>
      <section className="reading-cover">
        <p className="eyebrow">
          {data.period.title} /{" "}
          {dateLabel(data.period.start_date, { year: "numeric" })}
        </p>
        <h1>{data.book.title}</h1>
        <p className="reading-subtitle">{data.book.subtitle}</p>
        <div className="reading-author">
          <span>{data.display_name}</span>
          <span>
            {dateLabel(data.period.start_date)} —{" "}
            {dateLabel(data.period.end_date)}
          </span>
        </div>
        {data.book.cover_id && (
          <div className="reading-cover-image">
            {picture(data.book.cover_id)}
          </div>
        )}
        <a
          href="#reading-body"
          aria-label="Journal lesen"
          className="reading-scroll"
        >
          <ArrowDown size={20} /> Die Geschichte lesen
        </a>
      </section>
      <div id="reading-body" className="reading-body">
        {data.book.dedication && (
          <section className="reading-dedication">
            <p>{data.book.dedication}</p>
          </section>
        )}
        {data.book.intro && (
          <section className="reading-intro">
            <p className="eyebrow">Bevor es beginnt.</p>
            <FormattedText text={data.book.intro} />
          </section>
        )}
        {data.book.chapters.length > 0 && (
          <nav className="reading-toc" aria-label="Inhaltsverzeichnis">
            <p className="eyebrow">Die Kapitel</p>
            {data.book.chapters.map((c, i) => (
              <a key={c.id} href={`#chapter-${c.id}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {c.title}
              </a>
            ))}
          </nav>
        )}
        {data.book.chapters.length
          ? data.book.chapters.map((c, i) => (
              <section
                className="reading-chapter"
                id={`chapter-${c.id}`}
                key={c.id}
              >
                <header>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <h2>{c.title}</h2>
                </header>
                {c.items.map((item) =>
                  item.kind === "entry" ? (
                    (() => {
                      const e = data.entries.find(
                        (e) => e.id === item.entry_id,
                      );
                      return e ? entry(e) : null;
                    })()
                  ) : (
                    <section className="reading-entry" key={item.id}>
                      {item.title && <h2>{item.title}</h2>}
                      <FormattedText text={item.text} />
                      {item.media_ids.length > 0 && (
                        <div className="reading-images">
                          {item.media_ids.map(picture)}
                        </div>
                      )}
                    </section>
                  ),
                )}
              </section>
            ))
          : data.entries.map(entry)}
        {data.book.outro && (
          <section className="reading-outro">
            <p className="eyebrow">Was bleibt.</p>
            <FormattedText text={data.book.outro} />
          </section>
        )}
        <footer className="reading-end">
          <span className="reading-end-mark">/</span>
          <p>Erlebt. Festgehalten. Bewahrt.</p>
          <small>Ein persönliches Memento von {data.display_name}.</small>
        </footer>
      </div>
    </article>
  );
}
