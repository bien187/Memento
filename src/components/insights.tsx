"use client";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Star,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  dateLabel,
  monthDays,
  addDays,
  today,
  serviceWeek,
  inPeriod,
  dayNumber,
} from "@/lib/domain/dates";
import { statistics } from "@/lib/domain/stats";
import type { Period, Entry } from "@/lib/domain/models";
import { Button, Empty } from "./ui";
import { cn } from "@/lib/utils";
export function CalendarView({
  period,
  entries,
  onCreate,
  onEdit,
}: {
  period: Period;
  entries: Entry[];
  onCreate: (date: string) => void;
  onEdit: (entry: Entry) => void;
}) {
  const [month, setMonth] = useState(() =>
      inPeriod(today(), period.start_date, period.end_date)
        ? today().slice(0, 7)
        : period.start_date.slice(0, 7),
    ),
    [selected, setSelected] = useState(() =>
      inPeriod(today(), period.start_date, period.end_date)
        ? today()
        : period.start_date,
    ),
    [mode, setMode] = useState<"month" | "week">("month");
  const days = monthDays(month),
    startWeek = addDays(
      selected,
      -((new Date(dayNumber(selected) * 86400000).getUTCDay() + 6) % 7),
    );
  const visible =
    mode === "month"
      ? days
      : Array.from({ length: 7 }, (_, i) => addDays(startWeek, i));
  function navigate(offset: number) {
    if (mode === "week") {
      const day = addDays(selected, offset * 7);
      setSelected(day);
      setMonth(day.slice(0, 7));
    } else {
      const date = new Date(`${month}-01T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + offset);
      setMonth(date.toISOString().slice(0, 7));
    }
  }
  const daily = entries.filter((e) => e.date === selected);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tag für Tag</p>
          <h1>
            Deine Dienstzeit<span className="heading-dot">.</span>
          </h1>
          <p className="muted">Ein Überblick über die Momente dazwischen.</p>
        </div>
      </div>
      <section className="calendar-panel">
        <header>
          <div>
            <p className="eyebrow">{period.title}</p>
            <h2>
              {dateLabel(`${month}-01`, { month: "long", year: "numeric" })}
            </h2>
          </div>
          <div className="calendar-controls">
            <div className="segmented">
              <button
                aria-pressed={mode === "month"}
                onClick={() => setMode("month")}
              >
                Monat
              </button>
              <button
                aria-pressed={mode === "week"}
                onClick={() => setMode("week")}
              >
                Woche
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Vorheriger Zeitraum"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={19} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Nächster Zeitraum"
              onClick={() => navigate(1)}
            >
              <ChevronRight size={19} />
            </Button>
          </div>
        </header>
        <div className="calendar-grid" role="grid" aria-label="Dienstkalender">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <span className="calendar-weekday" key={d} role="columnheader">
              {d}
            </span>
          ))}
          {visible.map((day) => {
            const onDay = entries.filter((e) => e.date === day);
            return (
              <button
                role="gridcell"
                aria-label={`${dateLabel(day)} · ${onDay.length} Einträge${onDay.some((e) => e.milestone) ? " · Meilenstein" : ""}`}
                aria-selected={selected === day}
                className={cn(
                  "calendar-day",
                  day.slice(0, 7) !== month && "outside-month",
                  day === today() && "is-today",
                  selected === day && "selected",
                  !inPeriod(day, period.start_date, period.end_date) &&
                    "outside-period",
                )}
                key={day}
                onClick={() => setSelected(day)}
              >
                <span>{Number(day.slice(8))}</span>
                <div>
                  {onDay.some((e) => e.milestone) ? (
                    <Star size={12} fill="currentColor" />
                  ) : onDay.length > 0 ? (
                    <i />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i />
            Eintrag
          </span>
          <span>
            <Star size={12} />
            Meilenstein
          </span>
          <span>
            Woche{" "}
            {serviceWeek(period.start_date, selected) > 0
              ? serviceWeek(period.start_date, selected)
              : "—"}
          </span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {inPeriod(selected, period.start_date, period.end_date)
              ? `Dienstwoche ${serviceWeek(period.start_date, selected)}`
              : "Ausserhalb der Dienstperiode"}
          </p>
          <h2>
            {dateLabel(selected, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
        </div>
        {inPeriod(selected, period.start_date, period.end_date) && (
          <Button variant="outline" onClick={() => onCreate(selected)}>
            <Plus size={16} />
            Eintrag
          </Button>
        )}
      </div>
      {daily.length ? (
        <div className="day-entries">
          {daily.map((e) => (
            <button key={e.id} onClick={() => onEdit(e)}>
              <span>
                {e.milestone ? (
                  <Star size={18} />
                ) : (
                  <span className="small-caps">{period.type}</span>
                )}
              </span>
              <div>
                <h3>{e.subtitle || "Ein Tag, der bleibt."}</h3>
                <p>
                  {e.media_ids.length} Bilder ·{" "}
                  {e.visibility === "private" ? "Privat" : "Freigegeben"}
                </p>
              </div>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Noch ein unbeschriebenes Blatt."
          text="Für diesen Tag hast du noch keine Erinnerung festgehalten."
        />
      )}
    </>
  );
}
export function StatisticsView({
  period,
  entries,
}: {
  period: Period;
  entries: Entry[];
}) {
  const [from, setFrom] = useState(period.start_date),
    [to, setTo] = useState(period.end_date),
    [aggregate, setAggregate] = useState<"daily" | "weekly">("daily");
  const filtered = entries.filter((e) => e.date >= from && e.date <= to),
    stats = statistics(filtered, period.start_date);
  const chart = useMemo(() => {
    const dates = [...new Set(filtered.map((e) => e.date))].sort();
    return dates.map((date) => {
      const values = statistics(
        filtered.filter((e) => e.date === date),
        period.start_date,
      );
      return {
        label: dateLabel(date, { day: "2-digit", month: "2-digit" }),
        mood: values.mood,
        condition: values.condition,
      };
    });
  }, [filtered, period.start_date]);
  const known = filtered.filter((e) => e.mood !== null || e.condition !== null);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ein Blick zurück</p>
          <h1>
            Dein Verlauf<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Wie du deine Dienstzeit erlebst. Nur für dich.
          </p>
        </div>
      </div>
      <div className="filter-panel always-visible">
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
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <span className="private-note">Diese Auswertung ist privat.</span>
      </div>
      <section className="stats-overview">
        <div>
          <span>Stimmung im Mittel</span>
          <strong>
            {stats.mood ?? "—"}
            <small>/100</small>
          </strong>
        </div>
        <div>
          <span>Verfassung im Mittel</span>
          <strong>
            {stats.condition ?? "—"}
            <small>/100</small>
          </strong>
        </div>
        <div>
          <span>Festgehaltene Tage</span>
          <strong>
            {stats.days}
            <small>/{Math.max(0, dayNumber(to) - dayNumber(from) + 1)}</small>
          </strong>
        </div>
      </section>
      <section className="chart-panel">
        <header>
          <div>
            <p className="eyebrow">Stimmung & körperliche Verfassung</p>
            <h2>Die Tage hinter den Zahlen.</h2>
          </div>
          <div className="segmented">
            <button
              aria-pressed={aggregate === "daily"}
              onClick={() => setAggregate("daily")}
            >
              Täglich
            </button>
            <button
              aria-pressed={aggregate === "weekly"}
              onClick={() => setAggregate("weekly")}
            >
              Wochenmittel
            </button>
          </div>
        </header>
        {known.length >= 2 ? (
          <div
            className="chart"
            role="img"
            aria-label="Verlauf von Stimmung und körperlicher Verfassung zwischen 0 und 100"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={aggregate === "daily" ? chart : stats.weeks}
                margin={{ top: 20, right: 20, left: -20, bottom: 10 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--line)"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                  }}
                />
                <Legend iconType="plainline" />
                <Line
                  type="monotone"
                  dataKey="mood"
                  name="Stimmung"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="condition"
                  name="Verfassung"
                  stroke="var(--rust)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty
            title="Ein Verlauf braucht ein paar Tage."
            text="Bewerte mindestens zwei Einträge, um deinen Verlauf zu sehen."
          />
        )}
        <p className="fineprint">
          Fehlende Bewertungen werden ausgelassen. Bei mehreren Einträgen pro
          Tag wird der Tagesmittelwert angezeigt.
        </p>
      </section>
      <div className="section-heading">
        <h2>Woche für Woche.</h2>
        <span className="muted">
          {stats.count} Einträge · {stats.milestones} Meilensteine
        </span>
      </div>
      {stats.weeks.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Dienstwoche</th>
                <th>Stimmung</th>
                <th>Verfassung</th>
              </tr>
            </thead>
            <tbody>
              {stats.weeks.map((w) => (
                <tr key={w.label}>
                  <td>{w.label.replace("W", "Woche ")}</td>
                  <td>{w.mood ?? "—"}</td>
                  <td>{w.condition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
