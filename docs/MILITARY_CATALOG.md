# Funktionen, Kasernen und Truppensymbole

## Funktionsauswahl

Der Katalog enthält die vom Projektauftrag vorgegebenen **125 Funktionen** mit den
vollständigen Bezeichnungen und vier Teams:

| Team          | Funktionen |
| ------------- | ---------: |
| Kampf         |         21 |
| Hilfe         |         18 |
| Unterstützung |         41 |
| Technik       |         45 |

Quelle der redaktionellen Funktionsliste ist der Projektauftrag, nicht eine automatisch
übernommene amtliche Gesamtliste. Auch die darin aufgeführten Zivilschutzfunktionen
bleiben enthalten. Teams sind Auswahlgruppen und werden nicht mit Truppengattungen
verwechselt. Die UI bietet Suche und Teamfilter im Onboarding, im Profil und in jeder
Dienstperiode.

Die einzige Quelle im Code ist `src/lib/domain/military-functions.ts`. Bestehende IDs
bleiben erhalten: `artillerist` trägt jetzt die Bezeichnung „Artillerie Soldat/-in“,
`panzersoldat` die Bezeichnung „Panzerbesatzer/-in“. Frühere Profile und Backups bleiben
zuordenbar; es werden keine persönlichen Datensätze umgeschlüsselt.

## Kasernenvorschläge

`src/lib/domain/barracks.ts` enthält die **29 vorgegebenen Standorte**, Kanton, Schule
und explizite Zuordnungen zu Funktionen. Die Standorttabelle stammt aus dem Auftrag;
naheliegende Fachfunktionen sind redaktionell denselben Schulen als Vorschlag
zugeordnet. Die Tabelle ist keine vollständige oder verbindliche Einteilungsregel.
Die offizielle Referenz zum Abgleichen ist das
[Adressverzeichnis der Rekrutenschulen](https://www.armee.ch/de/rekrutenschulen)
(geprüft am 22.10.2026).

Bei Wahl einer Funktion wird der erste passende Standort vorgeschlagen. Eine bereits
gewählte passende Alternative bleibt erhalten. Bei mehreren möglichen Schulen sind
alle Vorschläge im Auswahlfeld zusammengefasst; sämtliche anderen erfassten Standorte
bleiben ebenfalls wählbar. Die Auswahl kann geändert oder auf „Noch offen“ gesetzt
werden. Bei einer Funktion ohne bekannte Zuordnung wird kein Standort erfunden.
Das Aufgebot ist für den tatsächlichen Dienstort massgeblich.

Die Angaben werden getrennt als `barracks_id` am Profil und an jeder Dienstperiode
gespeichert. Ein neuer Zeitraum übernimmt zunächst die Profilangaben, kann dann
unabhängig angepasst werden. Änderungen am Profil überschreiben keine früheren
Dienstperioden. Alte Datensätze und Backups ohne dieses zusätzliche Feld bleiben
lesbar. Für IndexedDB ist kein neuer Index und keine Umbenennung nötig.

**Die Kaserne bleibt privat.** Community-RPCs und öffentliche Tagebuch-/Buchleser geben
sie nicht aus. Private Backups enthalten die Angabe; ein veröffentlichter Buchsnapshot
kann sie intern bewahren, aber die öffentliche Antwort filtert sie aus. Es wird kein
GPS- oder aktueller Aufenthaltsort erfasst.

## Einheitliche Symbolbibliothek

Unter `public/insignia/` liegen **24 unveränderte SVG-Dateien** aus dem zusammengehörigen
Set von **Magnum045 / Wikimedia Commons**, veröffentlicht unter
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Die Darstellungen umfassen
alle 13 auf der offiziellen Referenzseite aufgeführten Truppengattungen sowie elf
weitere Dienstzweig-/besondere Abzeichen einschliesslich Armeeführung. Vergleich:
[Militärische Abzeichen der Schweizer Armee](https://www.armee.ch/de/militaerische-abzeichen).
Es handelt sich um lizenzierte Vektordarstellungen, nicht um einen offiziellen
Bildexport oder eine Zugehörigkeit von Memento zur Armee.

- Dateiname: stabiler Katalogschlüssel, beispielsweise `infanterie.svg`.
- Originalproportionen und Farben bleiben unverändert; gemeinsame Darstellung über
  `BranchInsignia` in Auswahl, Profil und Community.
- `manifest.json`: Originaltitel, Ursprungsdatei, Autor, Lizenz und SHA-256 jeder Datei.
- `NOTICE.txt`: lesbare Attribution und Links zu jeder Quelldatei.
- `src/lib/domain/insignia.ts`: zentrale Auflösung von Katalog-ID zu Asset.
- Eine Galerie erlaubt die Auswahl über die Symbole. Die Dateien werden durch den
  Service Worker lokal zwischengespeichert und funktionieren offline. Die Navigation
  zwischen den fünf lokalen Ansichten funktioniert ebenfalls ohne Serververbindung;
  bei Offline-Neuladen bestimmt der tatsächliche URL-Pfad die angezeigte Ansicht.

Für den **Sozialdienst** enthält dieses lizenzierte Set keine Datei. Dort wird ein
klar bezeichnetes neutrales Ersatzsymbol angezeigt. Das vorhandene Seelsorge-SVG zeigt
die **christliche Variante** und ist so beschriftet; es wird keine Religion aus einer
Funktion abgeleitet. Ungeklärte Dateien werden nicht als frei lizenziert ausgegeben.

Der Import lässt sich reproduzieren:

```sh
node scripts/import-branch-insignia.mjs
```

Das Skript prüft jede Dateilizenz, lädt Originaldateien mit Rate-Limit-Rücksicht,
vergleicht Prüfsummen und lehnt aktive/externe SVG-Inhalte ab. Es verwendet vorhandene
Dateien erneut, wenn sie mit der Quelle übereinstimmen. Die Anwendung benötigt im
Betrieb keine Verbindung zu Wikimedia.

## Datenbank und Regeneration

`202610220003_military_catalog.sql` ergänzt die Kataloge, neue Standorttabellen,
Fremdschlüssel und die zulässigen Felder der Sync-RPC. Die Migration enthält auch die
neuen Katalogzeilen und ist dadurch für bestehende Cloudprojekte vollständig.
`military_function_barracks` beschreibt die Mehrfachzuordnungen mit Priorität;
`military_functions.team` speichert das Team. Kataloge sind nur lesbar, persönliche
Standortangaben unterliegen der bestehenden Eigentümer-RLS.

```sh
node --import tsx scripts/generate-catalog-seed.ts
node --import tsx scripts/generate-backup-schema.ts
```

Der Generator aktualisiert `supabase/seed.sql` und den markierten Katalogabschnitt der
Migration. Er ändert keine Profildaten. Die RPC bewahrt eine gespeicherte Kaserne,
wenn ein älterer Client das Feld auslässt; explizites `null` entfernt die Auswahl.
Vor Betrieb der neuen Cloudfunktionen die Migration mit `supabase db push` anwenden.
