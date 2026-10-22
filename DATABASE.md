# Datenbank und Datenformat

## Migrationen

`supabase/migrations/202610220001_core.sql` erstellt Tabellen, Indizes, RLS,
privaten Storage und Sync-/Community-RPCs. `202610220002_hardening.sql` ergänzt
unveränderliche Versionen/Medien, Archivierung und weitere Integritätsprüfungen.
`supabase/seed.sql` enthält ausschliesslich durchsuchbare Katalogdaten.

| Bereich | Tabellen | Zugriff |
| --- | --- | --- |
| Kataloge | military_ranks, military_functions, military_branches, military_units | Lesen auch anonym; keine Client-Schreibrechte |
| Persönlich | profiles, service_periods, diary_entries, entry_media | Nur Eigentümer |
| Einstellungen | user_preferences, reminder_preferences | Nur Eigentümer |
| Buchentwurf | books, book_chapters, book_items | Nur Eigentümer |
| Veröffentlichung | book_versions | Eigentümer liest; neue Version über RPC; Inhalte unveränderlich |
| Freigaben | diary_shares, book_shares | Eigentümer; anonyme Inhalte nur über geprüfte Server-Endpunkte |
| Beziehungen | follows, follow_requests | Nur beteiligte Konten; Schreiben über RPC |
| Blockierung | blocks | Nur blockierender Eigentümer; Schreiben über RPC |
| Synchronisation | sync_operations | Eigene Empfangsbelege; Schreiben ausschliesslich durch RPC |
| Missbrauchsschutz | rate_limits | Keine Clientrechte; Server-RPC |

Alle persönlichen Tabellen haben RLS. Zusätzlich sind direkte Tabellenmutationen
für normale Clients weitgehend entzogen; `sync_entity` validiert Eigentümer und
Version innerhalb einer Transaktion. Ausnahmen sind eigene Freigabemetadaten unter RLS.
`auth.uid()` ist massgeblich; vom Client übergebene Eigentümer müssen damit übereinstimmen.
Zusammengesetzte Fremdschlüssel verhindern das Zuordnen fremder Dienstperioden,
Einträge und Buchkapitel. Konto-Fremdschlüssel löschen persönliche Datensätze kaskadierend.

## Modellentscheidungen

Datumswerte sind PostgreSQL `date` und lokal `YYYY-MM-DD`. Titel sowie Diensttag und
Dienstwoche werden aus Datum und aktuellem Periodenbeginn erzeugt. Mehrere Einträge
pro Tag sind erlaubt. Stimmung und Verfassung sind getrennte nullable Integer 0–100.
Ein Volltextindex verwendet `german`; die lokale Suche durchsucht auch den Freitext.

Grad, Funktion und Dienstzweig referenzieren getrennte Kataloge. Einheiten werden
privat als freie Angabe geführt; `military_units` ist für einen später redaktionell
gepflegten Einheitenkatalog vorbereitet. Der Funktionskatalog ist eine dokumentierte
Startauswahl, keine vollständige Liste aller Rekrutierungsfunktionen.

Buchkapitel und Buchabschnitte sind normalisiert. Der lokale Buchbaum wird im RPC
atomar in diese Tabellen übertragen. `book_versions.snapshot` ist bewusst ein
unveränderlicher JSON-Schnappschuss. Veröffentlichte Bilder werden weder überschrieben
noch beim Entfernen aus dem Tagebuch physisch gelöscht. Die Konto-Löschung entfernt sie.
Reminder-Einstellungen werden aus `user_preferences` in `reminder_preferences` gespiegelt.

## Backupformat Version 1

Die verbindliche Laufzeitvalidierung befindet sich in `src/lib/backup.ts` und
`src/lib/domain/models.ts`; das maschinenlesbare Schema unter `schemas/backup-v1.schema.json`.

```json
{
  "format": "feldbuch",
  "schema_version": 1,
  "exported_at": "2026-10-22T12:00:00.000Z",
  "owner_id": "UUID",
  "data": {
    "profiles": [], "service_periods": [], "diary_entries": [],
    "entry_media": [], "books": [], "book_versions": [], "user_preferences": []
  }
}
```

`format: feldbuch` bleibt als technischer Formatbezeichner für Kompatibilität bestehen.
Ein ZIP enthält `feldbuch.json` und `media/<Medien-UUID>` für jede Bilddatei. Ein JSON
ohne Medien ist ein Datenexport; enthält es Bildverweise, ist für die vollständige
Wiederherstellung das ZIP erforderlich. Beziehungen, Eigentümer, Formatversion,
Dateitypen und Grössen werden vor dem Import geprüft. ZIP/entpackte Daten sind auf
250 MB, einzelne Bilder auf 5 MB begrenzt.

Zusammenführen überspringt vorhandene IDs. Wiederherstellen sichert im UI zuerst den
aktuellen Bestand und blendet bestehende Einträge/Perioden/Buchentwürfe aus, bevor das
Backup übernommen wird. Vorhandene unveränderliche Medien und Buchversionen werden
beibehalten. Kontenübergreifende Importe erhalten deterministisch neue UUIDs, private
Einträge und keine Freigabelinks. Bestehende Cloudfreigaben separat prüfen/widerrufen.
Sync-Belege, Auth-Zugangsdaten, Follow-Beziehungen und Linktokens sind nicht Teil des Backups.
Noch nicht übernommene lokale Schreibentwürfe bleiben separat auf dem Ursprungsgerät;
zum Übertragen vorher den Eintrag speichern.
