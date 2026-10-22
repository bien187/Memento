# Tests und Abnahme

## Ausgeführte Abnahme am 22.10.2026

- TypeScript strict und Next.js-Produktionsbuild: erfolgreich.
- Vitest: **30 Tests in 6 Dateien erfolgreich**.
- Playwright am frisch erstellten Produktionsbuild: **16 Tests erfolgreich**
  (acht Abläufe jeweils auf Smartphone und Desktop, einschliesslich Offline-Neuladen).
- Kleine Bildschirmbreite 320 px ohne horizontales Überlaufen geprüft.
- Icon-Abmessungen, ICO-Einträge, deckendes Apple-/Maskable-Icon und visuelle
  Memento-Integration geprüft. Lockdatei per `npm ci --dry-run --offline` geprüft.
- Echte Supabase-Auth/Storage-, Google-/Apple- und Vercel-Verbindungen wurden ohne
  externe Zugangsdaten **nicht** als erfolgreich abgenommen.

## Automatische Prüfungen

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Vitest prüft lokale Kalender-/DST-Logik, Bewertungen, Bildgrenzen, Statistiken,
dauerhafte Queue-Operationen, konkurrierende Änderungen, Backupvalidierung,
Import/Zusammenführen/Wiederherstellung, PDF-Formate, Passwort-/Tokenlogik und
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
PDF-Download, ZIP-Import und vollständiges Offline-Neuladen. Fehler speichern Trace
und Screenshot in `test-results`; HTML-Bericht: `playwright-report/index.html`.

Eine reale iOS-/Android-Geräteprüfung mit virtueller Tastatur, HEIC-Originalen,
Installationsdialog und verschiedenen Browser-Versionen bleibt zusätzlich sinnvoll.
Die Desktop-Chrome-Emulation ersetzt diese Hardwareprüfung nicht.

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
