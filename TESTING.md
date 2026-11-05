# Tests und Abnahme

## Schlussabnahme vom 25.10.2026

Typecheck und Produktionsbuild erfolgreich; **67 Vitest-Tests in 13 Dateien**,
**24 reguläre Browserprüfungen** und **6 Community-Browserprüfungen** erfolgreich.
Die Community-Integration verwendet einen isolierten lokalen HTTP-Testserver,
die Sicherheitsprüfungen echte PostgreSQL-Migrationen mit Auth-/Storage-Stubs.
Es wurde bei dieser Überarbeitung kein externes Supabase-Projekt getestet oder
geändert. Ursache, Änderungen und Grenzen stehen im
[Abnahmebericht](docs/REVIEW_2026-10-25.md).

## Ausgeführte Abnahme am 23.10.2026

- TypeScript strict und Next.js-Produktionsbuild: erfolgreich.
- Vitest: **41 Tests in 8 Dateien erfolgreich**.
- Playwright am frisch erstellten Produktionsbuild: **22 Tests erfolgreich**
  (elf Abläufe jeweils auf Smartphone und Desktop, einschliesslich Offline-Neuladen).
- Kleine Bildschirmbreite 320 px ohne horizontales Überlaufen geprüft.
- Icon-Abmessungen, ICO-Einträge, deckendes Apple-/Maskable-Icon und visuelle
  Memento-Integration geprüft. Lockdatei per `npm ci --dry-run --offline` geprüft.
- E-Mail-/Passwort-Login gegen das eingerichtete Supabase-Projekt erfolgreich:
  echte Cloudsession und leeres Onboarding am Produktionsbuild geprüft. Das nur
  dafür angelegte, markierte Prüfkonto wurde anschliessend gelöscht.
- Die vollständige Live-Abnahme von Storage, Freigaben, E-Mail-Zustellung und
  Google-/Apple-Consent bleibt ein eigener Prüfumfang; sie folgt nicht aus dem Login-Test.

## Automatische Prüfungen

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:e2e:community
```

Vitest prüft lokale Kalender-/DST-Logik, Bewertungen, Bildgrenzen, Statistiken,
dauerhafte Queue-Operationen, konkurrierende Änderungen, Backupvalidierung,
Import/Zusammenführen/Wiederherstellung, PDF-Formate, Passwort-/Tokenlogik,
125 Funktionen, Kasernenvorschläge, Abzeichenintegrität und
öffentliche Inhaltsfilter. PGlite führt die tatsächlichen Migrationen und
PL/pgSQL-RPCs in einer PostgreSQL-Engine aus, mit kleinen Stubs für die von
Supabase bereitgestellten Auth-/Storage-Schemas. Die Anwendungstabellen, RLS,
Constraints, Trigger und Funktionen werden nicht nachgebaut.

Die Datenbanktests prüfen Eigentümertrennung, anonyme Ablehnungen, verbotene direkte
Schreibzugriffe, Fremdschlüssel, Versionsprüfung, Idempotenz, bestätigte Follows,
Blockierungen, private Statistikfelder, unveränderliche Buchversionen und Freigabemetadaten.
Sie sind keine Zertifizierung der externen Supabase-Auth- oder Storage-Dienste.

## Browserprüfung

Playwright verwendet Google Chrome über `channel: chrome`. Das kann mit
`PLAYWRIGHT_CHROMIUM_CHANNEL` geändert werden. Bei CI ist ein passender Browser vorab
zu installieren. Standardmässig wird ein **Produktionsbuild** erstellt und lokal
auf Port 3100 gestartet, damit die PWA ohne HMR-Dateien geprüft wird.
Einen bereits laufenden Produktionsserver kann man so verwenden:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3200 npm run test:e2e
```

Der gleiche Ablauf läuft mit 375 px und 1440 px, ergänzt durch eine 320-px-
Überlaufprüfung. Testfälle: leeres neues Notizbuch, Onboarding, getrennte Skalen,
Neuladen, Entwurfswiederherstellung, Offline-Schreiben, Suche, vier/fünf Fotos,
Meilensteinbestätigung, drei Ansichten, Hauptnavigation, Buchsortierung/-versionen,
PDF-Download, ZIP-Import, vollständiges Offline-Neuladen, Teamfilter, getrennte
Kasernenangaben, Offline-Navigation mit Browser-Zurück und alle 24 Abzeichen im
dunklen Modus bei 320 px sowie Rückkehr alter Beispielidentitäten zur echten Anmeldung.
Testnotizbücher werden über einen regulären ZIP-Import eingerichtet; es gibt keinen
öffentlichen Demo-Einstieg. Fehler speichern Trace
und Screenshot in `test-results`; HTML-Bericht: `playwright-report/index.html`.

Eine reale iOS-/Android-Geräteprüfung mit virtueller Tastatur, HEIC-Originalen,
Installationsdialog und verschiedenen Browser-Versionen bleibt zusätzlich sinnvoll.
Die Desktop-Chrome-Emulation ersetzt diese Hardwareprüfung nicht.

## Neue Community- und Theme-Prüfungen

`tests/theme.test.ts` berechnet für alle 25 Truppengattungen in beiden Modi die
Kontraste von Text, Buttons, Auswahl und Fokus gegen die jeweiligen Flächen.
`e2e/theme.spec.ts` prüft den Profilwechsel ohne erneute Anmeldung sowie Hell,
Dunkel und System bei 375 und 430 px.

`npm run test:e2e:community` startet auf den lokalen Ports 3101 und 54389 einen
Produktionsbuild und einen isolierten HTTP-Vertragstestserver. Dieser enthält nur
synthetische Konten, Antworten und Bilder und wird niemals von der Produkt-App
geladen. Er prüft die reale Browseranmeldung, Feed/Profile, Menü mit Tastatur und
Touch, Anfragezähler, Pagination, Volltext, Bilder/Galerie sowie das Bearbeiten nach
einem Zeitstempel-Roundtrip. Der HTTP-Testserver prüft keine RLS-Regeln; dafür
führen die separaten PGlite-Tests die tatsächlichen Migrationen aus.

Dieser Testbuild enthält ausschliesslich lokale Test-Konfiguration. Vor Deployment
erneut `npm run build` mit den vorgesehenen Umgebungsvariablen ausführen. Beide
Browser-Suiten verwenden denselben `.next`-Ordner und müssen nacheinander laufen.

Ursache und Validierungsgrenzen: [Zeitstempel](docs/TIMESTAMPS.md).
Freigaben und RPC-Verträge: [Community](docs/COMMUNITY.md).
Farbquellen und Gestaltungsstatus: [Truppengattungs-Themes](docs/BRANCH_THEMES.md).

## Externe Abnahme nach Supabase-Einrichtung

Diese Schritte benötigen echte Projektzugänge und wurden lokal nicht vorgetäuscht:

1. Konten A/B per E-Mail registrieren, Bestätigung/Reset und Onboarding testen.
   Beide starten ohne fremde oder automatisch geladene Beispieldaten.
2. A legt Dienstperioden und Einträge mit/ohne vier Bildern an. B und `anon` dürfen
   sie weder über Tabellen-REST noch durch Erraten einer Medien-ID lesen.
3. A/B bearbeiten dieselbe synchronisierte Fassung auf verschiedenen Geräten.
   Die zweite Übertragung muss als Konflikt erhalten bleiben und auflösbar sein.
4. A schreibt offline und lädt Bilder in die lokale Warteschlange. Verbindung
   wiederherstellen; Inhalte und Fotos müssen ohne Verlust synchronisieren.
5. B fordert Follow an; A bestätigt. Nur `followers`-/explizit öffentliche Inhalte
   sind sichtbar. Nach Blockierung verschwinden Feed und Beziehung.
6. A erzeugt einen Tagebuchlink. Anonym sind nur ausgewählte `link`-Einträge lesbar,
   keine Bewertungen/Einheiten. Passwort, Ablauf und Ausschlüsse testen.
7. Den Link widerrufen: Daten- und Medien-Endpunkte müssen danach ablehnen, auch mit
   zuvor gesetztem Cookie. Dasselbe getrennt für einen Buchlink prüfen.
8. Buch veröffentlichen, Tagebuch anschliessend ändern. Die veröffentlichte Fassung
   muss unverändert bleiben. Zweite Version, Archivierung und neuer Entwurf prüfen.
9. ZIP auf einem anderen Konto importieren: neue IDs, private Einträge und keine
   übernommenen Freigaben; eigene Daten dürfen nicht versehentlich überschrieben werden.
10. Konto löschen: Auth-Nutzer, verknüpfte Tabellen und private Storage-Dateien sind
    entfernt. Nicht nur die Oberfläche oder lokale Daten löschen.

OAuth erst prüfen, wenn der jeweilige Provider eingerichtet ist. Kostenlose
Kontingente, E-Mail-Zustellung und Provider-Rotation sind Betriebsaufgaben.
