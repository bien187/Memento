# Sicherheit und Datenschutz

## Vertrauensgrenzen

Private Tabellen und der Storage-Bucket `diary-media` unterliegen RLS. Andere
Benutzer lesen persönliche Tabellen nicht direkt. Community-RPCs geben eine
beschränkte Projektion aus: keine Stimmung, keine körperliche Verfassung, keine
Einheit, keine Kaserne und keine privaten Profilfelder. Ein Follow allein macht keinen privaten
Eintrag sichtbar. Beide Richtungen einer Blockierung werden geprüft.

Requestgebundene Server-Clients validieren den Benutzer mit `auth.getUser()`.
Service-Role-Zugriff ist durch `server-only` auf Freigabe-/Medien-Endpunkte und
Kontolöschung begrenzt. `SUPABASE_SERVICE_ROLE_KEY` darf nie ein `NEXT_PUBLIC_`-Präfix
erhalten. Alle externen Einrichtungen bleiben ausserhalb des Repositorys.

## Freigaben

Links enthalten 32 kryptografisch zufällige Bytes. In der Datenbank liegt nur der
SHA-256-Hash. Passwörter werden mit zufälligem Salt und scrypt abgeleitet.
Jede öffentliche Daten-/Bildanfrage prüft Token, Widerruf, Ablaufdatum und bei
Bedarf das Passwort bzw. einen signierten HttpOnly-Cookie. Antworten verwenden
`Cache-Control: private, no-store` und `Referrer-Policy: no-referrer`.
Es werden keine permanent öffentlichen oder langlebigen signierten Bild-URLs erzeugt.

Tagebuchlinks lesen ausschliesslich ausgewählte, nicht gelöschte `link`-Einträge der
berechtigten Dienstperiode. Buchlinks lesen genau eine unveränderliche Version.
Medienpfade werden aus tatsächlichen Eigentümerdatensätzen aufgelöst und müssen
exakt `<owner>/<media-id>.<jpeg|png|webp>` entsprechen. Pfadmanipulation ist ausgeschlossen.
Private Bewertungen sowie Kasernenangaben aus Profil und Dienstperioden sind auch
in den öffentlichen Schnappschussantworten entfernt.
Ein Widerruf sperrt weitere Anfragen; bereits heruntergeladene Kopien sind nicht rückrufbar.

Zustandsändernde Server-Endpunkte prüfen den Origin. Öffentliche Leseanfragen,
Linkerstellung und Kontolöschung verwenden einen PostgreSQL-basierten Rate-Limiter,
der zwischen Serverless-Instanzen geteilt wird. Die Identität des IP-Schlüssels wird
mit HMAC abgeleitet. Der Hosting-Proxy muss vertrauenswürdige Forwarding-Header setzen.
Abgelaufene Rate-Limit-/Sync-Belege dürfen später durch eigene Wartung bereinigt werden;
es ist kein kostenpflichtiger Cron-Dienst erforderlich.

## Autosave und Konfliktstrategie

1. Neue Texte werden nach 450 ms lokal als Entwurf gesichert. Neue Einträge werden
   mit der Speicheraktion übernommen; bestehende Einträge zusätzlich automatisch.
2. Lokaler Datensatz und Queue-Operation werden gemeinsam in einer Dexie-Transaktion
   geschrieben. Mehrere Änderungen derselben Entität werden zusammengeführt.
3. Der Server sperrt die Entität und prüft `expected_version`. Empfangsbelege machen
   erneute Übertragungen derselben Operations-ID idempotent.
4. Bei Erfolg steigt die Versionsnummer. Während einer laufenden Übertragung weiter
   geschriebene Änderungen bleiben als neuere lokale Operation erhalten.
5. Bei Abweichung bleibt die lokale Fassung erhalten. Das Profil zeigt den Konflikt
   und verlangt eine ausdrückliche Wahl zwischen lokaler und Serverfassung.
6. Netzwerkfehler werden mit exponentieller Verzögerung wiederholt. Nach acht Versuchen
   wird ein sichtbarer Fehler angezeigt; manuelle Wiederholung ist möglich.

Web Locks koordinieren Cloud-Synchronisation zwischen Browser-Tabs. Ein Server-Pull
überschreibt keine ausstehende lokale Operation. Es gibt kein stilles Last-write-wins.

## Bilder und Gerätespeicherung

Uploads werden im Browser decodiert, auf maximal 2400 px verkleinert und als JPEG
neu kodiert; dabei werden ursprüngliche EXIF-/GPS-Daten nicht übernommen. Originale
sind auf 25 MB, gespeicherte Bilder auf 5 MB und Einträge auf vier Bilder begrenzt.
Der Bucket akzeptiert nur JPEG/PNG/WebP. Nach dem Upload sind Objektpfade unveränderlich.
Browser dürfen bestehende Objekte nicht überschreiben oder löschen.

IndexedDB ist pro Benutzer logisch getrennt, aber nicht zusätzlich verschlüsselt.
Ein entsperrtes gemeinsam verwendetes Browserprofil ist keine sichere Geräte-Grenze.
Abmelden bewahrt lokale Offline-Daten; im Profil können sie ausdrücklich entfernt
werden. Der Service Worker speichert App-Shell und statische Dateien, keine API-,
Auth- oder öffentlichen Freigabeantworten. Fotos liegen als eigene autorisierte Blobs
in IndexedDB und werden nicht in den Service-Worker-Cache geschrieben.

Die App erfasst keine GPS-Positionen. Upload und Veröffentlichung zeigen eine kurze
Erinnerung zum Schutz klassifizierter Informationen und unzulässiger Aufnahmen.

## Vor öffentlichem Betrieb

Lokale PostgreSQL-Tests ersetzen keine Abnahme im eigenen Supabase-Projekt. Auth,
Storage, E-Mail, Provider und reale RLS-Integration mit zwei Konten prüfen; dazu
[TESTING.md](TESTING.md). Rechtsgrundlagen, Betreiberinformationen und verbindliche
Datenschutzerklärung hängen vom tatsächlichen Betreiber und Betriebskontext ab.
