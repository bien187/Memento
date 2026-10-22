"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, ShieldCheck, Trash2, RefreshCw } from "lucide-react";
import { useStore } from "./store";
import { Modal, Field, Button, Empty, useConfirm, useToast } from "./ui";
import { dateLabel } from "@/lib/domain/dates";
import { db } from "@/lib/local/db";
import { message } from "@/lib/utils";
export function ShareDialog({
  kind = "diary",
  targetId,
  onClose,
}: {
  kind?: "diary" | "book";
  targetId?: string;
  onClose: () => void;
}) {
  const { identity, data, refresh } = useStore(),
    toast = useToast(),
    confirm = useConfirm(),
    cache = useQueryClient();
  const [target, setTarget] = useState(
      targetId ??
        data?.user_preferences[0]?.active_period_id ??
        data?.service_periods[0]?.id ??
        "",
    ),
    [displayName, setDisplayName] = useState(data?.profiles[0]?.name ?? ""),
    [password, setPassword] = useState(""),
    [expires, setExpires] = useState(""),
    [excluded, setExcluded] = useState<string[]>([]),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false);
  const shares = useQuery({
    queryKey: ["shares", identity?.id],
    enabled: identity?.mode === "cloud",
    queryFn: async () => {
      const response = await fetch("/api/shares", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result as { diary: Share[]; book: Share[] };
    },
  });
  async function create() {
    if (
      !(await confirm({
        title: "Dieses Journal per Link freigeben?",
        text:
          kind === "diary"
            ? "Nur Einträge mit der Sichtbarkeit „Für Freigabelinks“ werden sichtbar. Stimmung, Verfassung, Einheit und interne Profilangaben bleiben privat. Keine klassifizierten Informationen oder unzulässigen Bilder veröffentlichen."
            : "Die ausgewählte Buchversion wird mit allen enthaltenen Texten und Bildern lesbar. Prüfe vorab, dass alle Inhalte veröffentlicht werden dürfen.",
        label: "Freigabelink erstellen",
      }))
    )
      return;
    setBusy(true);
    try {
      await refresh();
      if (
        (await db.operations.where("owner_id").equals(identity!.id).count()) > 0
      )
        throw new Error(
          "Bitte zuerst alle Änderungen synchronisieren und Konflikte auflösen.",
        );
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          target_id: target,
          display_name: displayName,
          password: password || undefined,
          expires_at: expires
            ? new Date(
                `${expires}T23:59:59+${isSummer(expires) ? "02" : "01"}:00`,
              ).toISOString()
            : null,
          excluded_entry_ids: excluded,
          confirmed: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUrl(result.url);
      await cache.invalidateQueries({ queryKey: ["shares"] });
      toast("Freigabelink erstellt.");
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(share: Share, type: "diary" | "book") {
    if (
      !(await confirm({
        title: "Freigabelink deaktivieren?",
        text: "Der Link und die zugehörigen Bilder sind danach nicht mehr erreichbar. Bereits heruntergeladene Kopien lassen sich nicht zurückrufen.",
        label: "Link deaktivieren",
        danger: true,
      }))
    )
      return;
    try {
      const response = await fetch("/api/shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: type, id: share.id }),
      });
      if (!response.ok) throw new Error("Widerruf fehlgeschlagen.");
      setUrl("");
      await cache.invalidateQueries({ queryKey: ["shares"] });
      toast(
        "Freigabe deaktiviert. Für einen neuen Zugriff kannst du einen neuen Link erstellen.",
      );
    } catch (e) {
      toast(message(e));
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={kind === "book" ? "Dein Buch teilen" : "Dein Tagebuch teilen"}
      description="Du entscheidest, wer Einblick erhält."
    >
      {identity?.mode !== "cloud" ? (
        <Empty
          title="Freigaben brauchen eine Cloud-Verbindung."
          text="Öffentliche, widerrufbare Links benötigen ein eingerichtetes Supabase-Projekt und ein persönliches Konto. Lokale Vorschau und PDF-Export sind im Bucheditor verfügbar."
        />
      ) : (
        <div className="form-stack">
          {kind === "diary" && (
            <Field label="Dienstperiode">
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setExcluded([]);
                }}
              >
                {data?.service_periods
                  .filter((p) => !p.deleted_at)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label="Öffentlicher Anzeigename">
            <input
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field label="Passwort (optional)">
            <input
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field
            label="Gültig bis (optional)"
            hint="Ablauf am Ende des gewählten Tages in der Schweiz."
          >
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </Field>
          {kind === "diary" && (
            <details>
              <summary>Freigegebene Einträge auswählen</summary>
              <p className="fineprint">
                Es erscheinen nur Einträge mit Sichtbarkeit „Für Freigabelinks“.
              </p>
              <div className="selection-list">
                {data?.diary_entries
                  .filter(
                    (e) =>
                      !e.deleted_at &&
                      e.period_id === target &&
                      e.visibility === "link",
                  )
                  .map((e) => (
                    <label key={e.id}>
                      <input
                        type="checkbox"
                        checked={!excluded.includes(e.id)}
                        onChange={() =>
                          setExcluded((v) =>
                            v.includes(e.id)
                              ? v.filter((id) => id !== e.id)
                              : [...v, e.id],
                          )
                        }
                      />
                      <span>
                        {dateLabel(e.date)}
                        <strong>{e.subtitle || "Ohne Untertitel"}</strong>
                      </span>
                    </label>
                  ))}
              </div>
            </details>
          )}
          <p className="fineprint">
            <ShieldCheck size={15} /> Ein Link ist eine Zugangsberechtigung.
            Teile ihn bewusst.
          </p>
          <Button
            disabled={busy || !target || !displayName}
            onClick={() => void create()}
          >
            <Link2 size={17} />
            {busy ? "Wird erstellt …" : "Neuen Freigabelink erstellen"}
          </Button>
          {url && (
            <div className="new-share">
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
              <Button
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(url)
                    .then(() => toast("Link kopiert."))
                    .catch(() =>
                      toast(
                        "Kopieren nicht möglich. Bitte den Link markieren und kopieren.",
                      ),
                    )
                }
              >
                <Copy size={16} />
                Link kopieren
              </Button>
              <small>
                Der vollständige Link wird nur hier angezeigt. Bewahre ihn auf.
              </small>
            </div>
          )}
          <h3>Bestehende Freigaben</h3>
          {shares.isLoading && <p role="status">Freigaben werden geladen …</p>}
          {shares.error && <p role="alert">{message(shares.error)}</p>}
          {(["diary", "book"] as const).map((type) =>
            (shares.data?.[type] ?? []).map((s) => (
              <div className="share-row" key={s.id}>
                <div>
                  <strong>
                    {type === "diary" ? "Tagebuch" : "Buch"} · {s.display_name}
                  </strong>
                  <small>
                    {s.revoked_at
                      ? "Deaktiviert"
                      : s.expires_at
                        ? `Bis ${dateLabel(s.expires_at.slice(0, 10))}`
                        : "Aktiv · ohne Ablaufdatum"}
                  </small>
                </div>
                {!s.revoked_at && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Freigabelink deaktivieren"
                    onClick={() => void revoke(s, type)}
                  >
                    <Trash2 size={17} />
                  </Button>
                )}
              </div>
            )),
          )}
          <p className="fineprint">
            <RefreshCw size={14} /> Zum Erneuern einen alten Link deaktivieren
            und einen neuen erstellen.
          </p>
        </div>
      )}
    </Modal>
  );
}
type Share = {
  id: string;
  display_name: string;
  expires_at: string | null;
  revoked_at: string | null;
};
function isSummer(date: string) {
  const noon = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Zurich",
    timeZoneName: "shortOffset",
  })
    .formatToParts(noon)
    .some((p) => p.type === "timeZoneName" && p.value.includes("+2"));
}
