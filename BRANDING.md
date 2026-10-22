# Memento – Wort- und Bildmarke

Die eigenständige Bildmarke zeigt ein geometrisches Erinnerungsbuch mit ruhiger
Rundung, Buchrücken, reduziertem Seitenabschluss und integriertem Lesezeichen.
Vier grosse organische Flächen abstrahieren Camouflage ohne Stoffmuster oder Verlauf.

Palette: tiefes Oliv `#3d4939`, Moos `#68725a`, gedämpftes Khaki `#82816a`,
Braungrün `#555a43`, Elfenbein `#f2eedf`. Die neutrale Marke funktioniert unabhängig
von Truppengattung, Benutzerakzent sowie hellem oder dunklem App-Theme.
Die Wortmarke verwendet die vorhandene moderne System-Sans mit ruhiger Laufweite.

`public/logo.svg` ist die Hauptvariante. `public/favicon.svg` besitzt eine eigene
32er-Geometrie ohne die kleine Seitenlinie; sie bleibt bei 16 und 32 px erkennbar.
`favicon.ico` enthält PNG-Bilder in 16/32/48 px. Die iOS-Variante hat 180 px.
Das separate Maskable-Icon ist bis an die Ränder deckend; das zentrale Buch liegt
innerhalb der kreisförmigen sicheren Zone. Es werden keine offiziellen Abzeichen verwendet.

Alle Rasterformate lassen sich aus den beiden SVG-Originalen reproduzieren:

```sh
node scripts/generate-brand-assets.mjs
```

Metadaten, Manifest, Auth, Header, Onboarding, Leser, PDF-Branding und Exportnamen
verwenden Memento. Technische IndexedDB-Namen, bestehende localStorage-Schlüssel,
Cookiepräfixe und `format: feldbuch` in Backupversion 1 bleiben absichtlich erhalten.
