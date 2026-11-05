"use client";
import { useState } from "react";
import Link from "next/link";
import { profileHref } from "@/lib/domain/community";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import {
  PenLine,
  Plus,
  ArrowUpRight,
  Download,
  Upload,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Trash2,
  Link2,
  Shield,
  Check,
  AlertTriangle,
  ImagePlus,
  Bell,
  RotateCcw,
} from "lucide-react";
import { useStore } from "./store";
import { Button, Modal, Field, useToast, useConfirm } from "./ui";
import { newPeriod, ProfileFields, PeriodFields } from "./auth";
import { Books } from "./books";
import { ShareDialog } from "./sharing";
import { Photo } from "./media";
import { BranchInsignia } from "./military-fields";
import { barracksLabel } from "@/lib/domain/barracks";
import {
  profileSchema,
  periodSchema,
  type Profile,
  type Period,
} from "@/lib/domain/models";
import {
  ranks,
  branches,
  functions,
  catalogLabel,
} from "@/lib/domain/catalogs";
import { dateLabel } from "@/lib/domain/dates";
import { prepareImage } from "@/lib/local/media";
import { db, clearOwner } from "@/lib/local/db";
import { resolveConflict } from "@/lib/local/sync";
import {
  exportBackup,
  inspectBackup,
  importBackup,
  type ImportPreview,
} from "@/lib/backup";
import { download, message } from "@/lib/utils";
import { supabase } from "@/lib/supabase/browser";
export function ProfileView() {
  const {
      identity,
      data,
      save,
      setPreferences,
      logout,
      refresh,
      demo,
      resetDemo,
    } = useStore(),
    toast = useToast(),
    confirm = useConfirm();
  const profile = data!.profiles[0],
    prefs = data!.user_preferences[0];
  const [editing, setEditing] = useState<Profile | null>(null),
    [period, setPeriod] = useState<Period | null>(null),
    [sharing, setSharing] = useState(false),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [strategy, setStrategy] = useState<"merge" | "restore">("merge"),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [deleteText, setDeleteText] = useState(""),
    [connections, setConnections] = useState<
      "followers" | "following" | "blocked" | null
    >(null),
    [newPassword, setNewPassword] = useState("");
  const operations = useLiveQuery(
    () => db.operations.where("owner_id").equals(identity!.id).toArray(),
    [identity?.id],
  );
  const following = useQuery({
    queryKey: ["connections", identity?.id, connections],
    enabled: identity?.mode === "cloud" && !!connections,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("community_connections", {
        kind: connections,
      });
      if (error) throw error;
      return data as { id: string; name: string; username: string | null }[];
    },
  });
  const counts = useQuery({
    queryKey: ["follow-counts", identity?.id],
    enabled: identity?.mode === "cloud",
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase()
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", identity!.id),
        supabase()
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", identity!.id),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
      };
    },
  });
  const entries = data!.diary_entries.filter((e) => !e.deleted_at),
    periods = data!.service_periods.filter((p) => !p.deleted_at);
  async function backup(zip = true) {
    setBusy(true);
    try {
      download(
        await exportBackup(identity!.id, zip),
        zip ? "Memento-Backup.zip" : "Memento-Daten.json",
      );
      toast("Backup erstellt.");
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function doImport() {
    if (!preview) return;
    if (
      !(await confirm({
        title:
          strategy === "restore"
            ? "Vorhandenen Bestand wiederherstellen?"
            : "Backup zusammenführen?",
        text:
          strategy === "restore"
            ? "Der aktuelle Bestand wird zuerst als ZIP gesichert. Danach werden vorhandene Einträge ausgeblendet und Daten aus dem Backup übernommen."
            : "Bereits vorhandene IDs werden beibehalten. Neue Datensätze werden ergänzt.",
        label: "Import ausführen",
        danger: strategy === "restore",
      }))
    )
      return;
    setBusy(true);
    try {
      if (strategy === "restore")
        download(
          await exportBackup(identity!.id),
          "Memento-vor-Wiederherstellung.zip",
        );
      await importBackup(preview, identity!.id, identity!.mode, strategy);
      setPreview(null);
      await refresh();
      toast(
        "Daten importiert. Neue Freigabelinks werden nicht automatisch erstellt.",
      );
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function updateProfile() {
    if (!editing) return;
    try {
      await save("profiles", profileSchema.parse(editing));
      setEditing(null);
      toast("Profil gespeichert.");
    } catch (e) {
      toast(message(e));
    }
  }
  async function updatePeriod() {
    if (!period) return;
    try {
      periodSchema.parse(period);
      if (
        entries.some(
          (e) =>
            e.period_id === period.id &&
            (e.date < period.start_date || e.date > period.end_date),
        )
      )
        throw new Error(
          "Die neue Dienstperiode muss alle zugehörigen Eintragsdaten umfassen.",
        );
      await save("service_periods", period);
      await setPreferences({ active_period_id: period.id });
      setPeriod(null);
      toast(
        "Dienstperiode gespeichert. Tages- und Wochenangaben wurden neu berechnet.",
      );
    } catch (e) {
      toast(message(e));
    }
  }
  async function avatar(file: File | undefined) {
    if (!file) return;
    try {
      const media = await prepareImage(file, identity!.id, null);
      await save("entry_media", media);
      await save("profiles", { ...profile, avatar_id: media.id });
      toast("Profilbild gespeichert.");
    } catch (e) {
      toast(message(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Dein persönlicher Bereich</p>
          <h1>
            Das bin ich<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Deine Angaben. Deine Bücher. Deine Entscheidungen.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing(profile)}>
          <PenLine size={16} />
          Profil bearbeiten
        </Button>
      </div>
      <section className="profile-card">
        <div className="profile-avatar">
          {profile.avatar_id ? (
            <Photo id={profile.avatar_id} alt="Dein Profilbild" />
          ) : (
            <span>
              {profile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          )}
          <label aria-label="Profilbild ändern">
            <ImagePlus size={15} />
            <input
              aria-label="Profilbild hochladen"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => void avatar(e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="profile-identity">
          <p className="eyebrow">
            {demo
              ? "Demo · fiktives Profil"
              : identity?.mode === "cloud"
                ? "Persönliches Konto"
                : "Lokal auf diesem Gerät"}
          </p>
          <h2>{profile.name}</h2>
          {profile.username && <p className="muted">@{profile.username}</p>}
          <div className="military-details">
            <span
              className="neutral-badge"
              title="Neutrales Symbol, kein offizielles Gradabzeichen"
            >
              <Shield size={15} />
            </span>
            <span>
              {catalogLabel(ranks, profile.rank_id)} ·{" "}
              {catalogLabel(functions, profile.function_id)}
            </span>
          </div>
          <div className="profile-branch">
            <BranchInsignia id={profile.branch_id} />
            <p className="muted">
              {catalogLabel(branches, profile.branch_id)}
              {profile.unit ? ` / ${profile.unit}` : ""}
            </p>
          </div>
          {profile.barracks_id && (
            <p className="muted private-barracks">
              Kaserne: {barracksLabel(profile.barracks_id)} · privat
            </p>
          )}
        </div>
        <div className="profile-counts">
          <div>
            <strong>{entries.length}</strong>
            <span>Einträge</span>
          </div>
          <div>
            <strong>{entries.filter((e) => e.milestone).length}</strong>
            <span>Meilensteine</span>
          </div>
          <button onClick={() => setConnections("followers")}>
            <strong>{counts.data?.followers ?? 0}</strong>
            <span>Follower</span>
          </button>
          <button onClick={() => setConnections("following")}>
            <strong>{counts.data?.following ?? 0}</strong>
            <span>Gefolgt</span>
          </button>
        </div>
      </section>
      <section className="profile-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ein Kapitel nach dem anderen</p>
            <h2>Deine Dienstperioden</h2>
          </div>
          <Button
            variant="outline"
            onClick={() => setPeriod(newPeriod(identity!.id, profile))}
          >
            <Plus size={16} />
            Dienstperiode
          </Button>
        </div>
        <div className="period-list">
          {periods.map((p) => (
            <article key={p.id}>
              <span className="period-type">{p.type}</span>
              <button
                onClick={() =>
                  void setPreferences({ active_period_id: p.id }).then(() =>
                    toast(`${p.title} ausgewählt.`),
                  )
                }
              >
                <h3>{p.title}</h3>
                <p>
                  {dateLabel(p.start_date)} — {dateLabel(p.end_date)}
                </p>
                {p.barracks_id && (
                  <p className="period-barracks">
                    {barracksLabel(p.barracks_id)}
                  </p>
                )}
              </button>
              {prefs?.active_period_id === p.id && (
                <span className="mode-badge">Ausgewählt</span>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${p.title} bearbeiten`}
                onClick={() => setPeriod(p)}
              >
                <PenLine size={17} />
              </Button>
            </article>
          ))}
          {!periods.length && (
            <p className="muted">
              Du kannst deine erste Dienstperiode jederzeit erfassen.
            </p>
          )}
        </div>
      </section>
      <Books />
      <section className="profile-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Bewusst teilen</p>
            <h2>Privatsphäre & Freigaben</h2>
          </div>
        </div>
        <div className="settings-list">
          <Setting
            title="Tagebuch per Link teilen"
            text="Freigegebene Einträge als eigenes Journal lesen."
            action={
              <Button variant="outline" onClick={() => setSharing(true)}>
                <Link2 size={16} />
                Freigaben
              </Button>
            }
          />
          <Setting
            title="Auffindbar in der Community"
            text="Dein Name, Benutzername, Grad und Dienstzweig dürfen in Suchergebnissen erscheinen."
            action={
              <input
                aria-label="Auffindbar in der Community"
                type="checkbox"
                checked={profile.discoverable}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  if (
                    checked &&
                    !(await confirm({
                      title: "Profil auffindbar machen?",
                      text: "Name, Benutzername, Dienstgrad und Dienstzweig werden für angemeldete Personen sichtbar. Einheit und persönliche Statistiken bleiben privat.",
                    }))
                  )
                    return;
                  await save("profiles", { ...profile, discoverable: checked });
                }}
              />
            }
          />
          <Setting
            title="Privates Profil"
            text="Neue Follower müssen von dir bestätigt werden. Private Einträge bleiben immer privat."
            action={
              <input
                aria-label="Privates Profil"
                type="checkbox"
                checked={profile.private_profile}
                onChange={(e) =>
                  void save("profiles", {
                    ...profile,
                    private_profile: e.target.checked,
                  })
                }
              />
            }
          />
          <Setting
            title="Blockierte Personen"
            text="Blockierungen prüfen und aufheben."
            action={
              <Button variant="ghost" onClick={() => setConnections("blocked")}>
                Verwalten
                <ArrowUpRight size={16} />
              </Button>
            }
          />
          {(
            [
              [
                "share_function",
                "Funktion im Community-Profil",
                "Deine Grundfunktion auf deinem Profil anzeigen.",
              ],
              [
                "share_service_period",
                "Dienstperioden im Community-Profil",
                "Art, Beginn und Ende freigeben. Einheit und Kaserne bleiben privat.",
              ],
              [
                "share_connections",
                "Verbindungen im Community-Profil",
                "Follower, gefolgte Personen und deren Anzahl freigeben.",
              ],
            ] as const
          ).map(([key, title, text]) => (
            <Setting
              key={key}
              title={title}
              text={text}
              action={
                <input
                  type="checkbox"
                  aria-label={title}
                  checked={profile[key] ?? false}
                  onChange={(event) =>
                    void save("profiles", {
                      ...profile,
                      [key]: event.target.checked,
                    }).catch((error) => toast(message(error)))
                  }
                />
              }
            />
          ))}
        </div>
      </section>
      <section className="profile-section">
        <div className="section-heading">
          <h2>So fühlt sich dein Memento an.</h2>
        </div>
        <div className="settings-list">
          <Setting
            title="Erscheinungsbild"
            text="Ruhig, lesbar und passend zu deinem Gerät."
            action={
              <div className="theme-options">
                {(
                  [
                    { id: "light", icon: Sun, label: "Hell" },
                    { id: "dark", icon: Moon, label: "Dunkel" },
                    { id: "system", icon: Monitor, label: "System" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    aria-label={t.label}
                    aria-pressed={(prefs?.theme ?? "system") === t.id}
                    onClick={() => void setPreferences({ theme: t.id })}
                  >
                    <t.icon size={17} />
                  </button>
                ))}
              </div>
            }
          />
          <Setting
            title="An einen Eintrag erinnern"
            text="Hinweis beim geöffneten Memento. Keine garantierten Hintergrund-Pushs."
            action={
              <input
                type="checkbox"
                aria-label="Erinnerungen aktivieren"
                checked={prefs?.reminder_enabled ?? false}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  if (
                    enabled &&
                    "Notification" in window &&
                    Notification.permission === "default"
                  )
                    await Notification.requestPermission();
                  await setPreferences({ reminder_enabled: enabled });
                }}
              />
            }
          />
          {prefs?.reminder_enabled && (
            <div className="reminder-settings">
              <Field label="Zeit (Schweiz)">
                <input
                  type="time"
                  value={prefs.reminder_time}
                  onChange={(e) =>
                    void setPreferences({ reminder_time: e.target.value })
                  }
                />
              </Field>
              <div className="weekday-options">
                {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day, i) => (
                  <button
                    key={i}
                    aria-pressed={prefs.reminder_days.includes(i)}
                    onClick={() =>
                      void setPreferences({
                        reminder_days: prefs.reminder_days.includes(i)
                          ? prefs.reminder_days.filter((d) => d !== i)
                          : [...prefs.reminder_days, i],
                      })
                    }
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="profile-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Für später bewahren</p>
            <h2>Deine Daten</h2>
          </div>
        </div>
        <div className="settings-list">
          <Setting
            title="Vollständiges Backup"
            text="Versioniertes ZIP mit Profil, Einträgen, Bildern und Büchern."
            action={
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void backup()}
              >
                <Download size={16} />
                ZIP sichern
              </Button>
            }
          />
          <Setting
            title="Strukturierte Daten"
            text="JSON ohne Bilddateien. Für Auswertungen und Archivierung."
            action={
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void backup(false)}
              >
                JSON exportieren
              </Button>
            }
          />
          <Setting
            title="Backup importieren"
            text="Daten prüfen, Duplikate erkennen und anschliessend übernehmen."
            action={
              <label className="button button-outline">
                <Upload size={16} />
                Importieren
                <input
                  className="sr-only"
                  aria-label="Backup importieren"
                  type="file"
                  accept=".zip,.json"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBusy(true);
                      try {
                        setPreview(await inspectBackup(file, identity!.id));
                      } catch (error) {
                        toast(message(error));
                      } finally {
                        setBusy(false);
                      }
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            }
          />
        </div>
      </section>
      {!!operations?.length && (
        <section className="profile-section">
          <div className="section-heading">
            <h2>Synchronisation</h2>
            <Button
              variant="outline"
              onClick={async () => {
                await db.operations
                  .where("owner_id")
                  .equals(identity!.id)
                  .filter((o) => o.status === "error")
                  .modify({ status: "pending", attempts: 0, next_at: 0 });
                await refresh();
              }}
            >
              <Check size={16} />
              Erneut versuchen
            </Button>
          </div>
          {operations.map((op) => (
            <div className="sync-row" key={op.id}>
              <AlertTriangle size={17} />
              <div>
                <strong>
                  {op.table} ·{" "}
                  {op.status === "conflict"
                    ? "Konflikt"
                    : op.status === "error"
                      ? "Fehler"
                      : "Ausstehend"}
                </strong>
                <p>
                  {op.error ??
                    (op.table === "entry_media" && op.progress !== undefined
                      ? `Bildupload: ${op.progress}%`
                      : "Wird bei bestehender Verbindung synchronisiert.")}
                </p>
              </div>
              {op.status === "conflict" && (
                <div className="actions">
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() =>
                      void resolveConflict(op, "remote", identity!.mode).then(
                        refresh,
                      )
                    }
                  >
                    {op.source === "device"
                      ? "Andere Fassung übernehmen"
                      : "Serverstand übernehmen"}
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Lokalen Stand behalten?",
                          text: "Der Serverstand wird mit deiner lokalen Fassung ersetzt. Du kannst vorher ein Backup sichern.",
                        })
                      ) {
                        await resolveConflict(op, "local", identity!.mode);
                        await refresh();
                      }
                    }}
                  >
                    Lokalen Stand behalten
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="profile-section account-section">
        <div className="section-heading">
          <h2>Konto & Gerät</h2>
        </div>
        {identity?.mode === "cloud" && (
          <form
            className="password-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await supabase().auth.updateUser({
                password: newPassword,
              });
              toast(error ? error.message : "Passwort aktualisiert.");
              if (!error) setNewPassword("");
            }}
          >
            <Field label="Neues Passwort">
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Button variant="outline" type="submit">
              Passwort ändern
            </Button>
          </form>
        )}
        {demo ? (
          <>
            <p className="muted">
              Diese Demo hat kein Konto. Alle Angaben sind fiktiv und Änderungen
              bleiben in einem separaten Demo-Speicher dieses Browsers. Dein
              persönliches Memento wird nicht verändert.
            </p>
            <div className="actions">
              <Button variant="outline" onClick={() => void resetDemo()}>
                <RotateCcw size={16} />
                Demo zurücksetzen
              </Button>
            </div>
          </>
        ) : (
          <div className="actions">
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut size={16} />
              Abmelden
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Lokale Daten von diesem Gerät entfernen?",
                    text: "Nicht synchronisierte Daten gehen verloren. Sichere vorher ein ZIP-Backup.",
                    danger: true,
                    label: "Lokale Daten entfernen",
                  })
                ) {
                  await clearOwner(identity!.id);
                  await logout();
                }
              }}
            >
              Lokalen Gerätespeicher leeren
            </Button>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 size={16} />
              {identity?.mode === "cloud"
                ? "Konto löschen"
                : "Lokales Tagebuch löschen"}
            </Button>
          </div>
        )}
      </section>
      {editing && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setEditing(null);
          }}
          title="Dein Profil bearbeiten"
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void updateProfile();
            }}
          >
            <ProfileFields value={editing} onChange={setEditing} />
            <Button type="submit">
              Profil speichern
              <Check size={16} />
            </Button>
          </form>
        </Modal>
      )}
      {period && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setPeriod(null);
          }}
          title="Dienstperiode verwalten"
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void updatePeriod();
            }}
          >
            <PeriodFields value={period} onChange={setPeriod} />
            <Button type="submit">
              Dienstperiode speichern
              <Check size={16} />
            </Button>
          </form>
        </Modal>
      )}
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
      {preview && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setPreview(null);
          }}
          title="Backup vor dem Import prüfen"
        >
          <div className="form-stack">
            <p>
              {preview.backup.data.diary_entries.length} Einträge ·{" "}
              {preview.backup.data.service_periods.length} Dienstperioden ·{" "}
              {preview.backup.data.books.length} Bücher · {preview.blobs.size}{" "}
              Bilder
            </p>
            <p>
              {preview.duplicates} bereits vorhandene Einträge. Formatversion{" "}
              {preview.backup.schema_version}.
            </p>
            <Field label="Importmodus">
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as typeof strategy)}
              >
                <option value="merge">
                  Zusammenführen · Vorhandenes beibehalten
                </option>
                <option value="restore">
                  Wiederherstellen · Bestand ersetzen
                </option>
              </select>
            </Field>
            <p className="fineprint">
              Kontenübergreifende Importe erhalten neue, stabile IDs.
              Freigabelinks und Follow-Beziehungen werden nicht übernommen.
            </p>
            <Button disabled={busy} onClick={() => void doImport()}>
              {busy ? "Import läuft …" : "Geprüfte Daten importieren"}
            </Button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          open
          onOpenChange={setDeleting}
          title="Deine Daten vollständig löschen"
        >
          <div className="form-stack">
            <p>
              {identity?.mode === "cloud"
                ? "Konto, alle Einträge, Bilder, Bücher und Freigaben werden unwiderruflich gelöscht."
                : "Das persönliche Tagebuch und alle lokalen Bilder werden von diesem Gerät gelöscht."}{" "}
              Sichere vorher ein Backup.
            </p>
            <Field label="Zum Bestätigen KONTO LÖSCHEN eingeben">
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
              />
            </Field>
            <Button
              variant="danger"
              disabled={deleteText !== "KONTO LÖSCHEN" || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (identity?.mode === "cloud") {
                    const response = await fetch("/api/account", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ confirmation: deleteText }),
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                  }
                  await clearOwner(identity!.id);
                  await logout();
                } catch (e) {
                  toast(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Endgültig löschen
            </Button>
          </div>
        </Modal>
      )}
      {connections && (
        <Modal
          open
          onOpenChange={(v) => {
            if (!v) setConnections(null);
          }}
          title={
            connections === "followers"
              ? "Deine Follower"
              : connections === "following"
                ? "Gefolgte Personen"
                : "Blockierte Personen"
          }
        >
          {following.isLoading ? (
            <p>Wird geladen …</p>
          ) : following.error ? (
            <p role="alert">{message(following.error)}</p>
          ) : !following.data?.length ? (
            <p className="muted">Noch keine Personen in dieser Liste.</p>
          ) : (
            following.data.map((p) => (
              <div className="share-row" key={p.id}>
                <Link
                  href={profileHref(p.id)}
                  onClick={() => setConnections(null)}
                >
                  <strong>{p.name}</strong>
                  <small>@{p.username}</small>
                </Link>
                {connections === "blocked" && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const { error } = await supabase().rpc(
                        "community_action",
                        { target: p.id, action: "unblock" },
                      );
                      if (error) toast(error.message);
                      else await following.refetch();
                    }}
                  >
                    Freigeben
                  </Button>
                )}
              </div>
            ))
          )}
        </Modal>
      )}
    </>
  );
}
function Setting({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <div className="setting">
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
