# Technische Zeitstempel

## Ursache des ISO-Datetime-Fehlers

`EntryEditor.persist` validierte das vollständige gespeicherte Objekt mit
`entrySchema`. Dessen `z.iso.datetime()` akzeptierte ausschliesslich UTC mit `Z`.
PostgreSQL liefert `timestamptz` in JSON hingegen mit explizitem Offset, etwa
`2026-10-25T09:30:00.123456+00:00`. Die Synchronisation übernahm solche Antworten
ohne Laufzeitvalidierung in IndexedDB. Beim erneuten Speichern scheiterte dadurch
ein gültiger Datenbankwert an der engeren Formularvalidierung. Die allgemeine
Fehlerausgabe gab anschliessend den Zod-JSON-Dump direkt an Benutzer weiter.

Ein frisch erzeugter rein lokaler Eintrag verwendet bereits `toISOString()`;
für diesen isolierten Pfad war der berichtete Fehler nicht aus dem vorhandenen
Code ableitbar. Der Cloud-Roundtrip ist durch einen echten PostgreSQL/PGlite-Test
abgedeckt, der die Ablehnung durch das ursprüngliche Schema reproduziert.

## Änderung

- Ein gemeinsames striktes Schema akzeptiert ISO-8601-Zeitstempel mit `Z` oder
  explizitem Offset und erhält die Datenbankpräzision. Leere Strings, `null`,
  fehlende technische Werte, ungültige Daten und Werte ohne Zeitzone bleiben
  ungültig. Es gibt keinen Ersatz ungültiger Werte durch die aktuelle Uhrzeit.
- Das Formular validiert fachliche Eingaben separat. Optionale Angaben erhalten
  fachliche Defaults; das Ereignisdatum bleibt ein separates Kalenderdatum.
- Lokale Speicherung validiert Datensätze und schützt vorhandene Erstellungszeiten.
  Sie setzt den lokalen Änderungszeitpunkt als Teil des bestehenden Offline-Modells.
- Der Cloud-RPC erhält keine technischen Änderungszeitpunkte und bei Tagebucheinträgen
  auch keinen Erstellungszeitpunkt. PostgreSQL setzt diesen beim Insert über den
  vorhandenen Default. Ein Trigger bewahrt ihn beim Update und setzt `updated_at`.
  Technische Zeitangaben älterer Clients werden ausdrücklich nicht als Schreibfelder
  angenommen. Veröffentlichte Buchversionen und ihre Snapshots bleiben erhalten.
- RPC-Antworten und Remote-Abfragen werden einschliesslich verschachtelter
  Buchversionen validiert, bevor sie in den lokalen Speicher gelangen.
  Ein während einer Anfrage weiter bearbeiteter Eintrag übernimmt den bestätigten
  Erstellungszeitpunkt, ohne die neue Fassung zu verlieren.
- Backups verwenden dieselben Zeitstempel- und Snapshot-Schemas.
- Zod-Fehler werden mit Details in der Entwicklerkonsole protokolliert und in der
  Oberfläche als verständliche Meldung angezeigt.

Die Migration `202610250001_entry_timestamps.sql` und die nachfolgende
Community-Migration müssen gemeinsam vor der neuen Clientversion angewendet werden.
Bestehende Erstellungszeiten werden nicht nachträglich geändert.

## Abdeckung und Grenzen

`tests/timestamps.test.ts` prüft Validierungsgrenzen, optionale Felder, lokale
Erstellung/Bearbeitung, Bilder und Skalen, atomare Remote-Validierung sowie eine
fehlgeschlagene Netzwerkanfrage mit anschliessendem Retry. Der Netzwerktest verwendet
einen gemockten Supabase-Transport und die tatsächliche IndexedDB-Warteschlange.
`tests/timestamps-database.test.ts` prüft den tatsächlichen PostgreSQL-JSON-Roundtrip,
serverseitige Erstellung, unveränderliche Erstellungszeiten, automatische Änderungen
und idempotente RPC-Wiederholungen. Supabase Auth/Storage sind dort Schema-Stubs.

Welche Prüfungen tatsächlich ausgeführt wurden, wird nach dem gesamten Projektlauf
im abschliessenden Änderungsbericht dokumentiert. Ohne Zugang zu einem externen
Supabase-Projekt ist damit keine Live-Abnahme dieses Dienstes verbunden.
