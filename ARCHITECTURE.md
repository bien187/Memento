# Memento – Architektur und Phasenplan

## Produkt und technische Entscheidungen

Memento ist ein persönliches, mobiles Militärtagebuch. Next.js App Router, React,
TypeScript strict und Tailwind bilden die Anwendung; Supabase stellt Auth, PostgreSQL
mit RLS und privaten Storage bereit. Hostingziel ist Vercel, daher wird dieses
Repository lokal entwickelt und nicht auf Sites veröffentlicht.

Die Oberfläche verwendet eine ruhige Papier-/Olivpalette, redaktionelle Typografie,
eine mobile Navigation mit fünf Bereichen und eine Desktop-Seitenleiste. Bücher
werden ausschliesslich im Profil verwaltet. Alle persönlichen Daten sind zunächst privat.

## Schichten

- `src/app`: Next-Routen, Auth-Callback, geschützte Freigabe-/Medien-Endpunkte.
- `src/components`: barrierearme UI, Tagebuch, Kalender, Statistik, Profil, Bücher.
- `src/lib/domain`: Zod-Schemas, reine Kalendertagslogik, Statistiken, Kataloge.
- `src/lib/local`: Dexie, atomare lokale Änderungen, persistente Sync-Warteschlange.
- `src/lib/supabase`: Browser- und requestgebundene Server-Clients.
- `supabase/migrations`: normalisiertes Schema, Constraints, RLS und RPCs.
- `tests`, `e2e`, `supabase/tests`: Unit-, Browser- und Datenbank-Sicherheitstests.

## Daten und Synchronisation

Eigene Daten liegen pro Benutzer in IndexedDB. Änderungen werden zusammen mit einer
Operation atomar lokal gespeichert. Debounced Autosave schreibt zunächst lokal.
Der Server prüft die erwartete Versionsnummer atomar; bei Abweichung bleibt der
lokale Stand erhalten und ein Konflikt muss ausdrücklich aufgelöst werden.
Keine Last-write-wins-Überschreibung. Neue Medien bleiben als Blob in einer lokalen
Warteschlange, bis privater Upload und Metadaten bestätigt sind. Versionsschnappschüsse
veröffentlichter Bücher sind unveränderlich. Freigaben lassen sich separat widerrufen.

Nicht konfigurierte Installationen bieten ein ausdrücklich lokales Notizbuch an.
Das ist kein Cloudkonto. Beispieldaten werden nur nach aktiver Auswahl geladen und
sind von persönlichen Konten getrennt. Neue Konten bleiben leer.

## Arbeitsphasen und prüfbare Ergebnisse

1. **Grundsystem:** ausführbares Projekt, Tokens, Schema/RLS, Auth und Konfiguration.
2. **Profil:** Onboarding, getrennte Militärkataloge und mehrere Dienstperioden.
3. **Tagebuch:** Editor, 0–4 Bilder, Tageslogik, unabhängige Skalen, Meilensteine/Suche.
4. **Mobil/offline:** fünf Bereiche, drei Ansichten, Kalender, Autosave, PWA und Sync.
5. **Statistik:** echte Werte, Zeitraumfilter und Wochenmittel ohne Nullersatz.
6. **Community:** Suche, bestätigte Follows, Anfragen, Blockierung und privater Feed.
7. **Freigaben:** ausdrückliche Veröffentlichung, sichere Tokens, Passwort/Ablauf/Widerruf.
8. **Bücher:** mehrere Bücher je Periode, Kapitel, Layouts, Sortierung und Lesemodus.
9. **Archiv:** unveränderliche Versionen, PDF und validierte JSON-/ZIP-Sicherungen.
10. **Abnahme:** Build, Unit-/E2E-/RLS-Tests, mobile Prüfung und Deployment-Anleitung.

## Externe Grenzen

Supabase-Projekt, OAuth-Provider und Vercel benötigen Konten/Zugangsdaten. Apple OAuth
kann ein kostenpflichtiges Apple-Developer-Konto voraussetzen. Vercel Hobby ist für
persönliche, nichtkommerzielle Projekte vorgesehen. Kostenlose Kontingente sind keine
unbegrenzte Betriebsgarantie. Tests gegen echtes Auth/Storage/RLS werden getrennt von
lokalen Tests ausgewiesen. Ohne externe Zugangsdaten wird kein Cloudbetrieb behauptet.
