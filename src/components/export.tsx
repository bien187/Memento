"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import type { Entry, Period, Snapshot } from "@/lib/domain/models";
import { dateLabel, serviceWeek } from "@/lib/domain/dates";
import { generatePDF, type Paper } from "@/lib/pdf";
import { download, message } from "@/lib/utils";
import { Button, Field, Modal, useToast } from "./ui";
export function ExportDialog({
  entries,
  period,
  onClose,
  snapshot,
}: {
  entries: Entry[];
  period: Period;
  onClose: () => void;
  snapshot?: Snapshot;
}) {
  const [selected, setSelected] = useState(new Set(entries.map((e) => e.id))),
    [paper, setPaper] = useState<Paper>("a4"),
    [scope, setScope] = useState("all"),
    [date, setDate] = useState(entries[0]?.date ?? period.start_date),
    [week, setWeek] = useState("1"),
    [busy, setBusy] = useState(false);
  const toast = useToast();
  const relevant = entries.filter(
    (e) =>
      scope === "all" ||
      (scope === "day" && e.date === date) ||
      (scope === "week" &&
        serviceWeek(period.start_date, e.date) === Number(week)),
  );
  const chosen = relevant
    .filter((e) => selected.has(e.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  async function exportFile() {
    setBusy(true);
    try {
      const blob = await generatePDF({
        entries: chosen,
        period,
        title: snapshot?.book.title ?? period.title,
        paper,
        snapshot,
      });
      download(blob, `Memento-${paper}.pdf`);
      toast("Dein PDF wurde erstellt.");
      onClose();
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Erinnerungen als PDF"
      description="Wähle Format und Inhalte für dein Dokument."
    >
      <div className="form-stack">
        <Field label="Seitenformat">
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value as Paper)}
          >
            <option value="a4">A4 · Hochformat</option>
            <option value="a5">A5 · Hochformat</option>
            <option value="square">Fotobuch · 210 × 210 mm</option>
          </select>
        </Field>
        {!snapshot && (
          <Field label="Zeitraum">
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">
                Alle angezeigten Einträge / Dienstperiode
              </option>
              <option value="day">Ein Kalendertag</option>
              <option value="week">Eine Dienstwoche</option>
            </select>
          </Field>
        )}
        {scope === "day" && (
          <Field label="Tag">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        )}
        {scope === "week" && (
          <Field label="Dienstwoche">
            <input
              type="number"
              min="1"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
          </Field>
        )}
        <div className="selection-list">
          {relevant.map((e) => (
            <label key={e.id}>
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(e.id)) n.delete(e.id);
                    else n.add(e.id);
                    return n;
                  })
                }
              />
              <span>
                {dateLabel(e.date)}
                <strong>{e.subtitle || "Ohne Untertitel"}</strong>
              </span>
            </label>
          ))}
        </div>
        <p className="fineprint">
          Stimmung und körperliche Verfassung werden nicht in das PDF
          übernommen.
        </p>
        <Button
          disabled={busy || !chosen.length}
          onClick={() => void exportFile()}
        >
          <Download size={17} />
          {busy
            ? "PDF wird erstellt …"
            : `${chosen.length} Einträge exportieren`}
        </Button>
      </div>
    </Modal>
  );
}
