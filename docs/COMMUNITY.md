# Community: Profile und Freigaben

Die Community setzt ein angemeldetes Supabase-Konto voraus. Eine Profiladresse
`/community/profile/<UUID>` ist direkt aufrufbar; sie ist kein anonymer Freigabelink.
Die privaten Basistabellen bleiben durch RLS auf ihren Eigentümer beschränkt.
Andere Personen erhalten ausschliesslich die begrenzten Projektionen der
Community-RPCs, niemals die zugrunde liegenden Profil- oder Tagebuchdatensätze.

## Sichtbarkeit

- `discoverable` gibt wie bisher Name, Benutzername, Dienstgrad und Truppengattung
  für die Community-Suche frei. Vorhandene Follow-Beziehungen oder Anfragen
  ermöglichen auch das Öffnen eines inzwischen nicht mehr auffindbaren Profils.
- `share_function`, `share_service_period` und `share_connections` sind zusätzliche,
  standardmässig deaktivierte Freigaben. Ältere Clients, die diese Felder nicht
  übertragen, behalten die vorhandenen Einstellungen bei.
- Freigegebene Dienstperioden zeigen nur Typ, Start und Ende von Perioden mit
  sichtbaren Beiträgen. Freitexttitel, Einheit und Kaserne bleiben privat.
- Profilstatistiken zählen nur die für den Betrachter sichtbaren Beiträge und
  Meilensteine. Stimmung und körperliche Verfassung werden nie ausgegeben.
- `private` und `link` erscheinen nie in Community-Projektionen. `followers`
  setzt eine bestätigte Beziehung voraus. `public` erscheint bei auffindbarem
  Profil für angemeldete Betrachter. Auf der eigenen Community-Profilansicht
  werden ausschliesslich die selbst freigegebenen Beiträge dargestellt.
- Eine Blockierung in beliebiger Richtung sperrt Profile, Beiträge und Bilder;
  sie entfernt Follow-Beziehungen und Anfragen in beiden Richtungen.

## Datenverträge

`community_profile(person)` liefert eine Profilprojektion oder `null`.
`community_people(query, branch)` sucht ausschliesslich freigegebene Namen und
Benutzernamen und filtert optional nach öffentlicher Truppengattung. Eingaben
werden als Suchtext behandelt, nicht als SQL-Wildcardmuster.
`community_requests()` und `community_connections(kind, person)` geben anklickbare
Personen zurück. Fremde Verbindungslisten erfordern `share_connections`; die
Blockierliste ist stets nur für ihren Eigentümer erreichbar.

`community_feed(person, page_size, before_date, before_created_at, before_id, only_milestones)`
liefert standardmässig 20, maximal 50 Beiträge. Die Sortierung ist stabil nach
Ereignisdatum, Erstellungszeit und ID absteigend. Der nächste Cursor besteht aus
allen drei Werten des letzten Beitrags; unvollständige Cursor werden abgewiesen.
Der Hauptfeed berücksichtigt gefolgte Personen. Die Profilansicht kann zusätzlich
deren öffentliche Beiträge zeigen. Der Feed liefert höchstens 600 Zeichen Text;
`community_entry(entry_id)` lädt den vollständigen, erneut autorisierten Eintrag.
Der Meilensteinfilter wird vor der Pagination serverseitig angewendet, damit auch
ältere Meilensteine ohne vorheriges Durchblättern aller Beiträge erscheinen.

## Medien

`/api/community/media/<mediaId>` und `/api/community/avatar/<profileId>` prüfen
zunächst die Sitzung und eine gezielte Datenbankfreigabe. Die Autorisierung hängt
von keinem Feed-Seitenlimit ab. Das Bild muss dem Autor gehören, aktuell referenziert
und nicht gelöscht sein. Ein Profilbild benötigt zusätzlich `entry_id IS NULL`.
Manipulierte Avatar-IDs dürfen dadurch keine fremden Tagebuchbilder offenlegen.
Der Server prüft den exakten Storagepfad nochmals und lädt danach das private
Storageobjekt. Antworten erlauben kein Caching und keine MIME-Erkennung.

## Migration und Prüfung

Alle Migrationen einschliesslich `202610250001_entry_timestamps.sql` und
`202610250002_community_profiles.sql` in Dateireihenfolge anwenden. Auf bestehenden
Installationen bleiben alle zusätzlichen Freigaben deaktiviert. Die RPCs erhalten
neue Signaturen; keine alten Clients parallel zu einer Teilmigration betreiben.

`tests/community-database.test.ts` prüft die tatsächlichen PostgreSQL-Funktionen
mit PGlite, Rollen und RLS. `tests/server-community.test.ts` prüft die Sitzungs-
Autorisierungsgrenze und die Proxy-Antworten mit simuliertem Storage. Auth und
Storage des echten Supabase-Projekts müssen separat mit zwei Konten geprüft werden.
