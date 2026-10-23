# Implementierungsstand

Stand: 23.10.2026. Die App wird lokal im bestehenden Projekt umgesetzt.
Supabase und die Vercel-App `memento-v5la` sind eingerichtet. Die Anmeldung und
die Entfernung des öffentlichen Beispielmodus sind am Produktionsbuild geprüft.
Echter E-Mail-/Passwort-Login gegen Supabase: Cloudsession und leeres Onboarding
erfolgreich; das temporäre Prüfkonto ist anschliessend gelöscht.

| Phase           | Quellcode/Verhalten                                          | Abnahme                                          |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| 1 Architektur   | Next.js, strict TS, Tokens, Auth-Clients, Schema/RLS/RPCs    | Typecheck, Build, PostgreSQL-Tests               |
| 2 Profil        | Onboarding, Katalogsuche, mehrere Dienstperioden, Profilbild | Lokale Browserabläufe; Cloudregistrierung extern |
| 3 Tagebuch      | CRUD, Datum, 0–4 Bilder, Skalen, Meilensteine, Suche         | Unit-/Browsertests                               |
| 4 Mobil/offline | Fünf Ziele, drei Ansichten, Kalender, Entwürfe, Queue/PWA    | Browserprüfung; Produktions-PWA separat          |
| 5 Statistik     | Echte Werte, Zeitraum, Tages-/Wochenmittel                   | Fach- und Browsertests                           |
| 6 Community     | Suche, Feed, Follows/Anfragen, Blockierung                   | PostgreSQL-RPC-/RLS-Tests; Livebetrieb extern    |
| 7 Freigaben     | Anonyme Leseseite, Tokens, Passwort, Ablauf/Widerruf         | Serverlogik-Tests; Live-Auth/Storage extern      |
| 8 Bücher        | Kapitel, Texte/Galerien, Vorlagen, Sortierung, Lesemodus     | Browserabläufe                                   |
| 9 Archiv        | Versionen, Archiv/neuer Entwurf, PDF, JSON/ZIP               | DB-, PDF-, Backup- und Browsertests              |
| 10 Lieferung    | Seed, Tests, Einrichtung, Dokumentation                      | Lokale Abnahme; Clouddeployment extern           |

## Bewusste Grenzen

- Ohne Cloudkonfiguration sind Community und öffentliche Links ausdrücklich nicht
  verfügbar. Der lokale Modus ist ein echtes gerätegebundenes Tagebuch, kein Cloudkonto.
- Google benötigt Provider-Konfiguration; Apple zusätzlich passende Apple-Zugänge.
  Es werden keine kostenlosen Apple-Voraussetzungen versprochen.
- Erinnerungen funktionieren beim geöffneten Memento, gegebenenfalls mit
  Browserbenachrichtigung. Zeitgenaue Hintergrund-Pushs werden nicht versprochen.
- Der Funktionskatalog enthält 125 vorgegebene Funktionen in vier Teams und 29
  Standorte mit änderbaren Vorschlägen. 24 lizenzierte Truppensymbole sind lokal
  integriert; beim Sozialdienst bleibt ein bezeichnetes neutrales Ersatzsymbol.
  Die Auswahl ist redaktionell und keine amtliche Einteilungszusage.
- Die eigene Statistik bleibt privat. PDFs und öffentliche Leser enthalten keine
  Stimmungs-/Verfassungswerte. Private Texte können bewusst in Buchversionen aufgenommen werden.
- Publizierte Medien werden aus Gründen der Versionskonsistenz aufbewahrt. Entfernen
  aus einem aktuellen Eintrag ist kein physisches Löschen früher veröffentlichter Kopien.
- Das vollständige Löschen eines Cloudkontos braucht den serverseitigen Service-Role-Key.
- Der E-Mail-Login wurde gegen das echte Supabase-Projekt geprüft. Die übrige
  Live-Abnahme (Storage, Freigaben, OAuth-Consent) und reale iOS-/Android-Geräte
  sind davon getrennt und noch nicht vollständig abgenommen.

Die jeweils tatsächlich ausgeführten Prüfergebnisse werden bei der abschliessenden
Übergabe angegeben. Installations-/Hostinghinweise stehen in DEPLOYMENT.md.

Lokale Schlussabnahme: Typecheck und Produktionsbuild erfolgreich, **41 Vitest-Tests**
und **22 Playwright-Tests** erfolgreich. Die Browserprüfung verwendet den
Produktionsbuild und schliesst ein vollständiges Offline-Neuladen ein.

Das Memento-Branding ist mit Haupt-/Mini-SVG, ICO, Apple-/PWA-/Maskable-PNGs,
Open-Graph-Bild, Metadaten und wiederverwendeter Wortmarke integriert. Technische
Datenbank- und Backupbezeichner bleiben kompatibel.

Der öffentliche Beispielmodus, lokale Testprofile und simulierte Community-Konten
sind aus dem Produkt entfernt. Frühere Beispielidentitäten werden beim Start
bereinigt; persönliche lokale Notizbücher bleiben bestehen. Tests und
Screenshot-Erzeugung verwenden isolierte Datenimporte, keinen Demo-Login.
