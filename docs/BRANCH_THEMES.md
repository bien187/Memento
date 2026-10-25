# Truppengattungen und App-Farben

Die Zuordnung liegt vollständig und typisiert in `src/lib/domain/theme.ts`.
Sie umfasst alle 25 IDs aus dem bestehenden Militärkatalog. Anzeigenamen stammen
aus demselben Katalog; unbekannte oder fehlende IDs verwenden das neutrale
Memento-Oliv. Ein Profilwechsel setzt sämtliche Tokens neu und entfernt dadurch
auch die Farben eines vorher angemeldeten Kontos.

## Quellen und Status

Am **25.10.2026** wurde die Primärquelle
[Militärische Abzeichen der Schweizer Armee](https://www.armee.ch/de/militaerische-abzeichen)
abgerufen. Sie unterscheidet ausdrücklich zwischen Béretfarben und Farben der
Achselschlaufen und zeigt verschiedene Farbfamilien. Daraus lässt sich keine
verbindliche digitale Farbdefinition für eine App ableiten. Einzelne verknüpfte
Bilddateien konnten beim Quellenabruf nicht separat geladen werden.

**Alle Hexwerte und die folgenden App-Zuordnungen sind vorläufige
Designentscheidungen von Memento, keine amtlichen Farbcodes.** Die Quelle dient
der Orientierung und dem Abgleich der Truppengattungen; die UI übernimmt keine
verbindliche militärische Kennzeichnung. Insbesondere ist das gewünschte Hellblau
der Luftwaffe eine gestalterische Interpretation. Sand für Spezialkräfte ist
ebenfalls eine Produktentscheidung. Die SVG-Abzeichen bleiben unverändert und
haben ihre eigenen [Quellen- und Lizenznachweise](../public/insignia/NOTICE.txt).

| IDs | App-Familie | Gestaltungsentscheidung |
| --- | --- | --- |
| `infanterie`, `militaermusik` | Oliv | Ruhiges Grün und die bisherige Memento-Anmutung |
| `luftwaffe`, `fliegerabwehr` | Himmelblau | Helle blaue Akzente; für kleine Texte dunklere Variante |
| `spezialkraefte`, `rettung` | Sand | Gedecktes Beige mit gut lesbarer dunkler Textvariante |
| `artillerie` | Ziegelrot | Gedämpftes Rot |
| `logistik`, `justiz` | Bordeaux | Zurückhaltende weinrote/violette Akzente |
| `sanitaet`, `rotkreuzdienst` | Blau | Eigenständige blaue Akzente |
| `panzer` | Gold | Gedämpftes Ocker statt leuchtendem Gelb |
| `genie`, `fuehrungsunterstuetzung`, `abc`, `militaerpolizei`, `nachrichtendienst`, `seelsorge`, `generalstab`, `territorial`, `sozialdienst`, `ppd`, `bereitschaft`, `sport`, `armeefuehrung` | Schiefer | Neutrale, militärisch inspirierte Grau-/Blautöne |

## Verhalten

`StoreProvider` leitet das Theme ausschliesslich vom gespeicherten eigenen Profil
und der Einstellung Hell/Dunkel/System ab. IndexedDB-Livequeries wenden Änderungen
direkt ohne Neuanmeldung an. Änderungen des Betriebssystemmodus werden bei
Systemauswahl unmittelbar übernommen. Ein fremdes Communityprofil ändert das
persönliche App-Theme nicht.

Jede Familie besitzt je Modus Primärfarbe, weiche Auswahlfläche, Buttontext,
sekundären Akzent, sekundäre Auswahlfläche, Fokus und eine dezente Tönung für die
Seitenleiste. Buttons, aktive Navigation, ausgewählte Tabs/Filter/Formularfelder,
Stimmungsskala, Kalender und Meilensteine verwenden die Primärfarbe. Die Skala
für die körperliche Verfassung und deren gestrichelte Verlaufslinie verwenden
den sekundären Akzent. Leseflächen und neutrale Textfarben bleiben konsistent.
Logo und Camouflage werden nicht umgefärbt.

Auswahl bleibt zusätzlich durch aktive Linien, Rahmen, Gewichtung oder
`aria-pressed` erkennbar; Kalender und Meilensteine verwenden Punkt bzw. Stern.
Beide Skalen besitzen Namen und numerische Werte. Sichtbare Fokusumrisse bleiben
erhalten. Keine wichtige Aussage setzt ausschliesslich eine Farberkennung voraus.

## Kontrast und Prüfungen

`tests/theme.test.ts` berechnet die relative sRGB-Leuchtdichte nach der
[WCAG-Kontrastdefinition](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Für jede ID in beiden Modi werden geprüft:

- mindestens 4,5:1 für primären/sekundären Text, Buttontext und Auswahltext;
- mindestens 4,5:1 für neutralen Text und Kleindruck auf allen neutralen Flächen
  sowie auf der jeweiligen Seitentönung;
- mindestens 3:1 für Fokus und die als Bedienelementfarbe genutzten Akzente gegen
  angrenzende Flächen.

Die bisherigen hellen Kleindruckfarben wurden abgedunkelt, da sie auf dem
App-Hintergrund und der gedämpften Fläche unter 4,5:1 lagen.
`e2e/theme.spec.ts` prüft Onboarding, gespeicherten Profilwechsel, beide Modi,
Systemmodusänderung, Fortbestehen nach Neuladen und fehlenden horizontalen
Überlauf bei 375 und 430 px. Die tatsächlichen Ausführungsergebnisse werden
separat im Abnahmebericht dokumentiert; das Vorhandensein dieser Tests bedeutet
noch keine Live-Abnahme mit einem externen Supabase-Projekt.
