"use client";
import { Brand } from "./brand";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Users,
  ChartNoAxesCombined,
  UserRound,
  Plus,
  ArrowUpRight,
  WifiOff,
  RefreshCw,
  Check,
  ChevronDown,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useStore } from "./store";
import { Auth, Onboarding } from "./auth";
import { Button, Empty, useToast } from "./ui";
import { Journal } from "./journal";
import { CalendarView, StatisticsView } from "./insights";
import { ProfileView } from "./profile";
import { Community } from "./community";
import { EntryEditor } from "./entry-editor";
import { db } from "@/lib/local/db";
import { today, inPeriod, serviceDay, dayNumber } from "@/lib/domain/dates";
import type { Entry } from "@/lib/domain/models";
import { message } from "@/lib/utils";
const nav = [
  { path: "/", key: "diary", label: "Tagebuch", icon: BookOpen },
  { path: "/calendar", key: "calendar", label: "Kalender", icon: CalendarDays },
  { path: "/community", key: "community", label: "Community", icon: Users },
  {
    path: "/statistics",
    key: "statistics",
    label: "Statistik",
    icon: ChartNoAxesCombined,
  },
  { path: "/profile", key: "profile", label: "Profil", icon: UserRound },
];
export function App({ section: initialSection }: { section: string }) {
  const pathname = usePathname();
  // The cached shell is shared by all five pages. Its server prop can still
  // describe the diary after an offline reload at a different URL.
  const section =
    nav.find((item) => item.path === pathname)?.key ?? initialSection;
  const store = useStore(),
    { identity, data, ready, online, setPreferences, refresh } = store;
  const toast = useToast();
  function navigateOffline(event: { preventDefault(): void }, path: string) {
    if (!navigator.onLine) {
      event.preventDefault();
      window.history.pushState(null, "", path);
      window.scrollTo(0, 0);
    }
  }
  const [editor, setEditor] = useState<{ entry?: Entry; date?: string } | null>(
    null,
  );
  const operations = useLiveQuery(
    () =>
      identity
        ? db.operations.where("owner_id").equals(identity.id).toArray()
        : [],
    [identity?.id],
  );
  const profile = data?.profiles[0],
    preferences = data?.user_preferences[0],
    periods = data?.service_periods.filter((p) => !p.deleted_at) ?? [];
  const period =
    periods.find((p) => p.id === preferences?.active_period_id) ??
    periods.find((p) => inPeriod(today(), p.start_date, p.end_date)) ??
    periods[0];
  const entries =
    data?.diary_entries.filter(
      (e) => !e.deleted_at && e.period_id === period?.id,
    ) ?? [];
  useEffect(() => {
    if (!preferences?.reminder_enabled || !identity) return;
    const check = () => {
      const now = new Date();
      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Zurich",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      const weekday = new Date(`${today()}T12:00:00Z`).getUTCDay();
      const key = `feldbuch.reminded.${identity.id}`;
      if (
        time >= preferences.reminder_time &&
        preferences.reminder_days.includes(weekday) &&
        localStorage.getItem(key) !== today() &&
        !entries.some((e) => e.date === today())
      ) {
        localStorage.setItem(key, today());
        toast("Ein Moment für dich: Was möchtest du von heute festhalten?");
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("Dein Memento", {
            body: "Was möchtest du von heute festhalten?",
            icon: "/icon-192.png",
          });
      }
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [preferences, identity, entries, toast]);
  if (!ready || (identity && !data))
    return (
      <div className="loading" role="status">
        <BookOpen /> Dein Memento wird geöffnet …
      </div>
    );
  if (!identity) return <Auth />;
  if (!profile && identity.mode === "cloud" && !store.cloudLoaded)
    return (
      <main className="public-gate">
        <p className="eyebrow">Dein persönliches Tagebuch</p>
        <h1>
          {store.syncError || !online
            ? "Deine Daten sind gerade nicht erreichbar."
            : "Deine Daten werden geladen …"}
        </h1>
        {(store.syncError || !online) && (
          <>
            <p>
              Die Verbindung ist unterbrochen oder die Datenbank ist noch nicht
              eingerichtet. Vorhandene Daten werden nicht ersetzt.
            </p>
            <div className="actions">
              <Button onClick={() => void refresh()}>Erneut laden</Button>
              <Button variant="outline" onClick={() => void store.logout()}>
                Abmelden
              </Button>
            </div>
          </>
        )}
      </main>
    );
  if (!profile) return <Onboarding />;
  function create(date?: string) {
    if (!period) return toast("Erstelle zuerst eine Dienstperiode im Profil.");
    setEditor({ date });
  }
  const current = nav.find((n) => n.key === section);
  if (!current)
    return (
      <main className="error-page">
        <h1>Diese Seite gibt es nicht.</h1>
        <Link href="/">Zum Tagebuch</Link>
      </main>
    );
  const day = period
    ? Math.max(
        0,
        Math.min(
          serviceDay(period.start_date, today()),
          serviceDay(period.start_date, period.end_date),
        ),
      )
    : 0;
  const total = period
    ? dayNumber(period.end_date) - dayNumber(period.start_date) + 1
    : 0;
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Zum Inhalt springen
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Brand />
        </Link>
        <p className="sidebar-caption">Deine Dienstzeit. Deine Geschichte.</p>
        <nav aria-label="Hauptnavigation">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.path}
              onNavigate={(event) => navigateOffline(event, n.path)}
              prefetch={online ? undefined : false}
              aria-current={section === n.key ? "page" : undefined}
              className={section === n.key ? "active" : ""}
            >
              <n.icon size={19} />
              {n.label}
              {section === n.key && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <Button className="sidebar-write" onClick={() => create()}>
          <Plus size={18} />
          Eintrag schreiben
        </Button>
        <div className="sidebar-bottom">
          <p className="eyebrow">Ein Moment bleibt.</p>
          <p>
            Halte fest, was heute
            <br />
            morgen wertvoll macht.
          </p>
          <div className="sidebar-person">
            <span className="avatar">
              {profile.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{profile.name}</strong>
              <small>
                {identity.mode === "cloud"
                  ? "Persönliches Konto"
                  : "Lokales Tagebuch"}
              </small>
            </span>
            <Link href="/profile" aria-label="Profil öffnen">
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link
            href="/"
            className="mobile-brand"
            aria-label="Memento – Tagebuch"
          >
            <Brand compact />
          </Link>
          <div className="period-select">
            <span className="eyebrow">Aktuelle Dienstperiode</span>
            {periods.length ? (
              <div className="select-wrap">
                <select
                  aria-label="Dienstperiode wechseln"
                  value={period?.id ?? ""}
                  onChange={(e) =>
                    void setPreferences({ active_period_id: e.target.value })
                  }
                >
                  {periods.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            ) : (
              <Link href="/profile">
                Dienstperiode erstellen <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          <div className="topbar-status">
            {identity.mode !== "cloud" && (
              <span className="mode-badge">Lokal</span>
            )}
            <button
              className="sync-indicator"
              onClick={() => void refresh().catch((e) => toast(message(e)))}
              aria-label="Synchronisation aktualisieren"
            >
              {!online ? (
                <WifiOff size={15} />
              ) : operations?.length ? (
                <RefreshCw size={15} />
              ) : (
                <Check size={15} />
              )}
              <span>
                {!online
                  ? "Offline"
                  : operations?.some((o) => o.status === "conflict")
                    ? "Konflikt prüfen"
                    : operations?.length
                      ? `${operations.length} ausstehend`
                      : identity.mode === "cloud"
                        ? "Synchronisiert"
                        : "Auf diesem Gerät"}
              </span>
            </button>
            <Link
              href="/profile"
              className="avatar small-avatar"
              aria-label="Dein Profil"
            >
              {profile.name[0]}
            </Link>
          </div>
        </header>
        {(!online || store.syncError) && (
          <div className="connection-banner" role="status">
            {!online
              ? "Du bist offline. Deine Änderungen werden auf diesem Gerät gesichert."
              : `Synchronisation pausiert: ${store.syncError}`}
          </div>
        )}
        <main id="main" className="main-content">
          {section === "diary" &&
            (period ? (
              <Journal
                period={period}
                entries={entries}
                onCreate={create}
                onEdit={(entry) => setEditor({ entry })}
              />
            ) : (
              <Empty
                title="Dein erstes Kapitel wartet."
                text="Lege im Profil eine RS, einen WK oder eine andere Dienstperiode an."
                action={
                  <Button asChild>
                    <Link href="/profile">
                      Dienstperiode anlegen
                      <ArrowUpRight size={16} />
                    </Link>
                  </Button>
                }
              />
            ))}
          {section === "calendar" &&
            (period ? (
              <CalendarView
                period={period}
                entries={entries}
                onCreate={create}
                onEdit={(entry) => setEditor({ entry })}
              />
            ) : (
              <Empty
                title="Noch keine Dienstperiode"
                text="Lege zuerst eine Dienstperiode im Profil an."
              />
            ))}
          {section === "statistics" &&
            (period ? (
              <StatisticsView entries={entries} period={period} />
            ) : (
              <Empty
                title="Noch keine Statistik"
                text="Deine Auswertungen entstehen mit deinen ersten Einträgen."
              />
            ))}
          {section === "community" && <Community />}
          {section === "profile" && <ProfileView />}
          <footer className="page-footer">
            <span>MEMENTO / DEINE ERINNERUNGEN</span>
            <a href="/licenses/NOTICE.txt" target="_blank" rel="noreferrer">
              Open-Source-Lizenzen
            </a>
            <span>
              {period ? `${day} / ${total} Tage` : "Ein neues Kapitel."}
            </span>
          </footer>
        </main>
        <nav className="bottom-nav" aria-label="Mobile Hauptnavigation">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.path}
              onNavigate={(event) => navigateOffline(event, n.path)}
              prefetch={online ? undefined : false}
              className={section === n.key ? "active" : ""}
              aria-current={section === n.key ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        {section !== "profile" && (
          <Button
            className="mobile-write"
            size="icon"
            aria-label="Eintrag schreiben"
            onClick={() => create()}
          >
            <Plus size={25} />
          </Button>
        )}
      </div>
      {editor && period && (
        <EntryEditor
          period={period}
          initial={editor.entry}
          date={editor.date}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
