# Designsystem

Das Tagebuch steht im Mittelpunkt. Papierfarbene Oberflächen, dunkles Oliv,
redaktionelle Typografie und feine Linien geben Erinnerungen Raum. Keine
Marketing-Kacheln, Fotoplatzhalter oder Animationen ohne funktionalen Zweck.

## Zentrale Tokens

`src/app/globals.css` definiert Farben als CSS-Variablen. `--bg`, `--surface`,
`--surface-muted`, `--text`, `--muted`, `--line`, `--accent`, `--accent-soft`,
`--on-accent`, `--rust`, `--danger` und `--focus` besitzen Light-/Dark-Werte.
Radien: 6–9 px für Bedienelemente/Oberflächen, 12–14 px für Dialoge.
Abstände orientieren sich an 4/8/12/16/20/24/32 px. Bewegung: meist 180–400 ms,
kurze Erscheinungsanimationen; `prefers-reduced-motion` deaktiviert Bewegungen.

Systemschriften halten die App offline und vermeiden externe Font-Anfragen.
Die private App verwendet eine moderne Sans-Serif, die Leseseiten zusätzlich
Georgia. Die Buchvorlagen unterscheiden Typografie, Bildfläche und Chronologie.
PDFs nutzen eingebettete Standard-PDF-Schriften und berücksichtigen Seitenumbrüche.

## Mobil und Zugänglichkeit

Fünf gleichwertige Hauptziele in der unteren Navigation; leicht erreichbare
Schreibaktion. Bücher liegen ausschliesslich im Profil. Die Desktopansicht ergänzt
eine Seitenleiste. Safe Areas, `dvh`, Fokusmarkierungen, Skip-Link, Formularlabels,
Radix-Dialoge mit Fokusführung und echte Bestätigungsdialoge werden berücksichtigt.
Drag-and-drop ist durch Verschiebeschaltflächen und Tastaturbedienung ergänzt.
Die Skalen verwenden Zahlen und Text, keine Emojis oder medizinischen Deutungen.

Ohne Foto erscheint eine typografische Datumskarte. Truppensymbole verwenden die gemeinsame Komponente `BranchInsignia` und 24
lokal gespeicherte, lizenzierte SVG-Darstellungen mit einheitlicher Grösse und
unveränderten Proportionen/Farben. Fehlende Bilder (Sozialdienst) und neutrale
Grad-Ersatzsymbole sind als solche gekennzeichnet.
Die offiziellen Katalogreferenzen sind bei den Datenbankzeilen und in
`src/lib/domain/catalogs.ts` hinterlegt.

`src/lib/domain/theme.ts` definiert typisierte Akzentpaletten für alle 25
Truppengattungen und Dienstzweige. Der Store setzt `--accent`, `--accent-soft`,
`--on-accent`, `--accent-secondary`, `--accent-secondary-soft`, `--focus` und
`--theme-tint` aus dem gespeicherten eigenen Profil, jeweils für Hell und Dunkel.
`--rust` bleibt ein kompatibler Alias des sekundären Akzents für bestehende
Verlaufsgrafiken. Profil- und Systemmodusänderungen wirken ohne Neuanmeldung.
Leseflächen und neutrale Textfarben bleiben konsistent; die Seitenleiste erhält
eine dezente Tönung. Auswahl hat zusätzlich Linien, Rahmen, Symbole oder
semantische Zustände. Die Verfassungslinie bleibt zusätzlich gestrichelt.

Für sämtliche Themen berechnen automatisierte Tests mindestens 4,5:1 für kleinen
Text und 3:1 für Fokus-/Bedienelementindikatoren auf den verwendeten Flächen.
Die Browserprüfung umfasst 375 und 430 px sowie Profil- und Moduswechsel.
Alle UI-Hexwerte sind vorläufige Designentscheidungen, keine amtlichen Farbcodes.
[Zuordnungen, Quellen und Kontrastregeln](docs/BRANCH_THEMES.md).
Die universelle Memento-Marke bleibt davon unabhängig. Siehe BRANDING.md.
