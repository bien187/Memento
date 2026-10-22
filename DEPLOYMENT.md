# Einrichtung und Deployment

## Was bereits im Quellcode liegt

App, Migrationen, RLS, private Medien, Sync-RPCs, Auth-Callback, Tokenfreigaben,
Community, Bücher, Exporte, Beispiel-Seed und Tests sind enthalten. Die folgenden
Vorgänge benötigen eigene externe Konten und Zugangsdaten und wurden nicht auf einem
realen Cloudprojekt ausgeführt.

## 1. Supabase

1. Ein eigenes Supabase-Projekt erstellen; bewusst eine passende Datenregion wählen.
2. Mit der Supabase CLI anmelden und verbinden:

   ```sh
   npx supabase login
   npx supabase link --project-ref DEINE_PROJEKTREFERENZ
   npx supabase db push
   ```

3. `supabase/seed.sql` im SQL-Editor ausführen. Alternativ die Kataloge mit dem
   Testdaten-Seed importieren; normale Konten benötigen nur Kataloge, keine Testnutzer.
4. `.env.example` als `.env.local` kopieren. URL und Publishable Key aus „Connect“
   übernehmen. Den Service-Role-Key nur serverseitig als `SUPABASE_SERVICE_ROLE_KEY`
   setzen. Die App benötigt ihn für anonyme Tokenprüfung, geschützte Bildantworten
   und vollständige Kontolöschung.
5. Auth → URL Configuration: Site URL und erlaubte Redirect-URLs setzen,
   lokal `http://localhost:3000/auth/callback`, später die echte HTTPS-Domain.
6. E-Mail/Passwort aktivieren, E-Mail-Bestätigung und Passwortlänge mindestens 12
   konfigurieren. Zustellung und Reset-E-Mails prüfen. Für verlässlichen externen
   Versand eigenen SMTP-Zugang konfigurieren; kostenlose Limits des Providers beachten.
7. Der private Bucket `diary-media` samt MIME-/Grössenlimit und Policies wird durch
   die Migration erzeugt. **Nicht öffentlich schalten.**
8. Anonyme Tabellenabfragen dürfen keine persönlichen Daten liefern. Zwei Testkonten
   anlegen und die Live-Abnahme aus TESTING.md ausführen.

Offizielle Referenzen: [Next.js mit Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[private Storage-Regeln](https://supabase.com/docs/guides/storage/security/access-control).

Für eine lokale vollständige Supabase-Instanz sind CLI und Docker erforderlich:

```sh
npx supabase start
npx supabase db reset
```

Die ausgegebenen lokalen Schlüssel in `.env.local` setzen. Ein Reset löscht die
lokale Testdatenbank; niemals ungeprüft gegen ein bestehendes Produktivprojekt ausführen.

## 2. Google OAuth

In Google Cloud ein OAuth-Webprojekt und einen Client anlegen, Consent Screen
konfigurieren und als Redirect die im Supabase-Dashboard angezeigte Provider-Callback-URL
eintragen (`https://<ref>.supabase.co/auth/v1/callback`). Client-ID und Secret im
Google-Provider von Supabase speichern. Die Anwendung nutzt danach PKCE und den
eigenen `/auth/callback`. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` setzen und neu bauen.
Die Zugangsdaten gehören nicht ins Frontend.

Referenz: [Google-Anmeldung](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 3. Apple OAuth

Apple ist technisch über denselben Supabase-OAuth-Flow vorbereitet. Vor Aktivierung
werden Apple Developer-Zugang, Service-ID, Domain-/Redirect-Konfiguration, Team-/Key-ID
und ein passendes Client Secret benötigt. Ein Apple-Developer-Konto kann Kosten
verursachen; es ist daher keine kostenlose Voraussetzung für den Rest der App.
Apple-Schlüssel müssen entsprechend den Provider-Vorgaben erneuert werden.
Erst nach Einrichtung `NEXT_PUBLIC_APPLE_AUTH_ENABLED=true` setzen und neu bauen.

Referenz: [Apple-Anmeldung und Secret-Rotation](https://supabase.com/docs/guides/auth/social-login/auth-apple).

## 4. Vercel

1. Quellcode in das eigene Git-Repository übernehmen und in Vercel importieren.
2. Framework „Next.js“, Node.js 22 oder neuer, Build `npm run build`, Installation `npm ci`.
3. Benötigte Umgebungsvariablen aus `.env.example` für die gewünschte Umgebung setzen.
   `NEXT_PUBLIC_SITE_URL` auf die feste HTTPS-Domain setzen. Keine Seed-Zugangsdaten
   in die Hosting-Umgebung übernehmen.
4. Deployen. Domain anschliessend in den Supabase Auth-Redirects erlauben.
5. Registrierung, Bestätigungslink, Passwort-Reset, Medien und anonyme Freigabelinks
   auf dieser Domain prüfen. PWA-Installation und Offline-Neuladen am Produktionsbuild testen.

Vercel Hobby ist für persönliche, nichtkommerzielle Nutzung vorgesehen. Ein grösserer
oder kommerzieller Communitybetrieb passt möglicherweise nicht in diesen Tarif.
Kostenlose Supabase-/Hostingkontingente sind begrenzt und können sich ändern; Speicher,
Traffic, Auth-Limits und Projektpausierung im eigenen Konto beobachten.

Referenzen: [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Supabase Free](https://supabase.com/pricing).

## 5. Reproduzierbare Testdaten

Nur ein eigenes Testprojekt verwenden. `SEED_EMAIL` und ein einzigartiges
`SEED_PASSWORD` (mindestens 12 Zeichen) lokal setzen, dann:

```sh
npm run seed
```

Es entstehen drei ausdrücklich markierte fiktive Testkonten, jeweils 35 Einträge,
eigene neutrale Bildmotive, Meilensteine, unterschiedliche Bewertungen, ein Buch und
eine Version sowie bestätigte Follow-Beziehungen. Die Hauptperson ist Lukas Meier;
die anderen Adressen werden aus der angegebenen Seed-Adresse abgeleitet.
Ein vorhandenes Konto ohne Testkonto-Markierung wird nicht neu befüllt.
Der Seed verwendet stabile Datensatz-IDs und erzeugt bei Wiederholung keine neuen
Kopien derselben Daten. Er schreibt keine Passwörter oder API-Schlüssel in Dateien.
