import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("public/licenses", { recursive: true });
const lines = [
  "Memento – Open-Source-Komponenten",
  "Truppensymbole: Magnum045 / Wikimedia Commons, CC BY-SA 4.0. Eigene Nachweise: /insignia/NOTICE.txt und /insignia/manifest.json.",
  "",
  "Die aufgeführten Bibliotheken werden unter ihren jeweiligen Original-Lizenzen verwendet.",
  "HEIC-Konvertierung: heic-to, LGPL-3.0; unveränderte optionale Bibliothek.",
  "Quellcode und Build-Anleitung: https://github.com/hoppergee/heic-to/tree/v1.6.6",
  "Decoder: libheif 1.23.6, https://github.com/strukturag/libheif/tree/v1.23.6",
  "Reproduzierbarer Anwendungsbuild: README.md, package-lock.json und der vollständige Quellcode dieses Projekts.",
  "GNU GPL: GPL-3.0.txt; LGPL: heic-to-LGPL-3.0.txt",
  "",
];
for (const name of Object.keys(pkg.dependencies).sort()) {
  const root = `node_modules/${name}`;
  const p = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
  const stem = name.replaceAll("/", "-").replaceAll("@", "");
  const licenses = (await readdir(root)).filter((n) =>
    /^(licen[cs]e|copying)(\..*)?$/i.test(n),
  );
  lines.push(
    `${name} ${p.version} — ${typeof p.license === "string" ? p.license : JSON.stringify(p.license ?? "siehe Originaldatei")}`,
  );
  if (p.repository)
    lines.push(
      typeof p.repository === "string" ? p.repository : p.repository.url,
    );
  for (const file of licenses) {
    const out = `${stem}-${file}`;
    await writeFile(
      `public/licenses/${out}`,
      await readFile(`${root}/${file}`),
    );
    lines.push(`Lizenzdatei: ${out}`);
  }
  lines.push("");
}
await writeFile("public/licenses/NOTICE.txt", lines.join("\n"));
console.log("Lizenzhinweise und Original-Lizenztexte bereitgestellt.");
