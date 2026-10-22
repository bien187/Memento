import { jsPDF } from "jspdf";
import { db } from "./local/db";
import { cloudConfigured, supabase } from "./supabase/browser";
import { entryTitle, dateLabel } from "./domain/dates";
import type { Entry, Period, Snapshot } from "./domain/models";
export type Paper = "a4" | "a5" | "square";
export async function generatePDF({
  entries,
  period,
  title,
  paper = "a4",
  snapshot,
}: {
  entries: Entry[];
  period: Period;
  title: string;
  paper?: Paper;
  snapshot?: Snapshot;
}) {
  const doc = new jsPDF({
    unit: "mm",
    format: paper === "square" ? [210, 210] : paper,
    compress: true,
  });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight(),
    margin = paper === "a5" ? 14 : 20,
    body = width - margin * 2;
  let y = margin;
  const template = snapshot?.book.template ?? "editorial";
  const accent =
    snapshot?.book.accent === "slate"
      ? "#465863"
      : snapshot?.book.accent === "rust"
        ? "#8b634e"
        : "#42513c";
  const headingFont = template === "editorial" ? "times" : "helvetica";
  const clean = (s: string) =>
    s
      .replace(/[–—]/g, "-")
      .replace(/’/g, "'")
      .replace(/\*\*|(?<=\s)_(?=\S)|(?<=\S)_(?=\s|$)/g, "")
      .replace(/[^\u0020-\u00ff\n]/g, "");
  const ensure = (space: number) => {
    if (y + space > height - margin - 10) {
      doc.addPage();
      y = margin;
    }
  };
  function text(value: string, size = 10, style = "normal") {
    doc.setFont(size >= 15 ? headingFont : "helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(value), body) as string[];
    for (const line of lines) {
      ensure(size * 0.45 + 2);
      doc.text(line, margin, y + size * 0.35);
      y += size * 0.45 + 2;
    }
    y += 3;
  }
  async function image(id: string) {
    let media = await db.entry_media.get(id);
    if (!media) return;
    let blob = media.blob;
    if (!blob && media.storage_path && cloudConfigured) {
      const { data, error } = await supabase()
        .storage.from("diary-media")
        .download(media.storage_path);
      if (error) throw error;
      blob = data;
    }
    if (!blob)
      throw new Error(
        "Ein Bild ist nicht lokal verfügbar. Bitte zuerst online synchronisieren.",
      );
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const props = doc.getImageProperties(buffer);
    const imageHeight = Math.min(
      (body * props.height) / props.width,
      height - margin * 2 - 20,
    );
    const imageWidth = (imageHeight * props.width) / props.height;
    ensure(imageHeight + 5);
    doc.addImage(
      buffer,
      media.mime === "image/png"
        ? "PNG"
        : media.mime === "image/webp"
          ? "WEBP"
          : "JPEG",
      margin,
      y,
      imageWidth,
      imageHeight,
      undefined,
      "FAST",
    );
    y += imageHeight + 6;
  }
  if (template === "dienstbuch") {
    doc.setFillColor("#eae8db");
    doc.rect(0, 0, width, height, "F");
    doc.setFillColor(accent);
    doc.rect(margin / 2, margin, 2, height - margin * 2, "F");
  }
  doc.setTextColor(accent);
  y = height * 0.22;
  text("MEMENTO / PERSÖNLICHE ERINNERUNGEN", 9);
  y += 10;
  text(title, 30, "bold");
  if (snapshot?.book.subtitle) text(snapshot.book.subtitle, 13);
  text(period.title, 12);
  text(`${dateLabel(period.start_date)} - ${dateLabel(period.end_date)}`, 10);
  if (snapshot?.display_name) text(snapshot.display_name, 11);
  if (snapshot?.book.cover_id) await image(snapshot.book.cover_id);
  doc.addPage();
  y = margin;
  if (snapshot) {
    const book = snapshot.book;
    if (book.dedication) {
      text("Widmung", 17, "bold");
      text(book.dedication);
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    let tocCount = 1,
      simulatedY = margin + 14;
    for (const [i, c] of book.chapters.entries()) {
      for (const _ of doc.splitTextToSize(
        clean(`${i + 1}. ${c.title} / 00000`),
        body,
      )) {
        if (simulatedY + 6.95 > height - margin - 10) {
          tocCount++;
          simulatedY = margin + 14;
        }
        simulatedY += 6.95;
      }
      simulatedY += 3;
    }
    const tocPages = [doc.getNumberOfPages()];
    for (let i = 1; i < tocCount; i++) {
      doc.addPage();
      tocPages.push(doc.getNumberOfPages());
    }
    const toc: { title: string; page: number }[] = [];
    doc.addPage();
    y = margin;
    if (book.intro) {
      text("Einleitung", 20, "bold");
      text(book.intro);
    }
    for (const [i, chapter] of book.chapters.entries()) {
      doc.addPage();
      y = margin;
      toc.push({
        title: `${i + 1}. ${chapter.title}`,
        page: doc.getNumberOfPages(),
      });
      text(`${String(i + 1).padStart(2, "0")} / ${chapter.title}`, 21, "bold");
      for (const item of chapter.items) {
        if (item.kind === "entry") {
          const entry = entries.find((e) => e.id === item.entry_id);
          if (entry) await renderEntry(entry);
        } else {
          if (item.title) text(item.title, 15, "bold");
          if (item.text) text(item.text);
          for (const id of item.media_ids) await image(id);
        }
      }
    }
    if (book.outro) {
      doc.addPage();
      y = margin;
      text("Was bleibt.", 20, "bold");
      text(book.outro);
    }
    const last = doc.getNumberOfPages();
    let tocIndex = 0;
    doc.setPage(tocPages[0]);
    y = margin;
    text("Inhaltsverzeichnis", 20, "bold");
    for (const line of toc) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (const row of doc.splitTextToSize(
        clean(`${line.title} / ${line.page}`),
        body,
      ) as string[]) {
        if (y + 6.95 > height - margin - 10) {
          tocIndex++;
          doc.setPage(tocPages[tocIndex]);
          y = margin;
          text("Inhaltsverzeichnis", 20, "bold");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
        }
        doc.text(row, margin, y + 3.85);
        y += 6.95;
      }
      y += 3;
    }
    doc.setPage(last);
  } else for (const entry of entries) await renderEntry(entry);
  async function renderEntry(entry: Entry) {
    ensure(35);
    text(entryTitle(entry.date, period.start_date), 10);
    if (entry.subtitle) text(entry.subtitle, 17, "bold");
    if (entry.milestone) text("MEILENSTEIN", 8, "bold");
    text(entry.content, 10);
    for (const id of entry.media_ids) await image(id);
    y += 8;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#777777");
    doc.text(`MEMENTO / ${i} von ${pages}`, margin, height - 10);
  }
  return doc.output("blob");
}
