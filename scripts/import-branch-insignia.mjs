import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const catalog = [
  ["infanterie", "infantry"],
  ["panzer", "armour"],
  ["artillerie", "artillery"],
  ["luftwaffe", "aviation"],
  ["fliegerabwehr", "air defence"],
  ["genie", "engineers"],
  ["rettung", "rescue troops"],
  ["logistik", "logistics"],
  ["sanitaet", "medical troops"],
  ["fuehrungsunterstuetzung", "signals"],
  ["abc", "cbrn defence"],
  ["militaerpolizei", "military police"],
  ["spezialkraefte", "special forces"],
  ["nachrichtendienst", "military intelligence"],
  ["seelsorge", "chaplains"],
  ["rotkreuzdienst", "red cross service"],
  ["generalstab", "general staff"],
  ["justiz", "justice service"],
  ["territorial", "territorial service"],
  ["ppd", "psychological and pedagogical service"],
  ["bereitschaft", "readiness service"],
  ["militaermusik", "music"],
  ["sport", "sports"],
  ["armeefuehrung", "generals"],
];
const output = fileURLToPath(new URL("../public/insignia/", import.meta.url));
await mkdir(output, { recursive: true });
const headers = {
  "User-Agent":
    "Memento/1.0 (https://github.com/bien187/Memento; asset attribution import)",
};
const titles = catalog.map(([, name]) => `File:Swiss army ${name}.svg`);
const url = new URL("https://commons.wikimedia.org/w/api.php");
url.search = new URLSearchParams({
  action: "query",
  format: "json",
  prop: "imageinfo",
  iiprop: "url|sha1|extmetadata",
  titles: titles.join("|"),
});
const response = await fetch(url, { headers });
if (!response.ok) throw new Error(`Commons metadata: ${response.status}`);
const data = await response.json();
const pages = Object.values(data.query.pages);
const assets = [];
for (const [id, name] of catalog) {
  const title = `File:Swiss army ${name}.svg`;
  const page = pages.find((p) => p.title === title);
  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata;
  if (!info || meta.LicenseShortName?.value !== "CC BY-SA 4.0") {
    throw new Error(`Unverified file/license: ${title}`);
  }
  let svg = await readFile(`${output}${id}.svg`, "utf8").catch(() => "");
  if (!svg || createHash("sha1").update(svg).digest("hex") !== info.sha1) {
    for (let attempt = 0; attempt < 5; attempt++) {
      await setTimeout(1500);
      const original = await fetch(info.url, { headers });
      if (original.status === 429) {
        const delay = Math.min(
          30000,
          Number(original.headers.get("retry-after") ?? 5) * 1000,
        );
        console.log(`Rate limit for ${id}; retrying after ${delay / 1000}s`);
        await setTimeout(delay);
        continue;
      }
      if (!original.ok) throw new Error(`${title}: ${original.status}`);
      svg = await original.text();
      break;
    }
  }
  if (createHash("sha1").update(svg).digest("hex") !== info.sha1)
    throw new Error(`Download checksum mismatch: ${title}`);
  if (
    !svg.includes("<svg") ||
    /<script\b|<foreignObject\b|\son\w+\s*=|(?:href|src)=["'](?:https?:|\/\/|data:)/i.test(
      svg,
    )
  ) {
    throw new Error(`Unexpected active/external SVG content: ${title}`);
  }
  await writeFile(`${output}${id}.svg`, svg);
  assets.push({
    id,
    file: `${id}.svg`,
    title,
    source: info.descriptionurl,
    original: info.url,
    author: meta.Artist.value.replace(/<[^>]+>/g, "").trim(),
    license: "CC BY-SA 4.0",
    license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
    sha256: createHash("sha256").update(svg).digest("hex"),
    modified: false,
  });
  console.log(`Imported ${id}.svg`);
}
await writeFile(
  `${output}manifest.json`,
  JSON.stringify(
    {
      reference: "https://www.armee.ch/de/militaerische-abzeichen",
      description:
        "Licensed vector depictions of Swiss branch insignia; original files preserved. Chaplains asset depicts the Christian variant.",
      assets,
      unavailable: [
        {
          id: "sozialdienst",
          reason:
            "No freely licensed file in this set; UI uses a labeled neutral placeholder.",
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  `${output}NOTICE.txt`,
  [
    "Memento – Truppengattungs- und Dienstzweigabzeichen",
    "SVG depictions by Magnum045 / Wikimedia Commons, CC BY-SA 4.0.",
    "Original files preserved without modification; renamed by stable catalog ID.",
    "Source, original URL and SHA-256 of every file: manifest.json.",
    "License: https://creativecommons.org/licenses/by-sa/4.0/",
    "Reference: https://www.armee.ch/de/militaerische-abzeichen",
    "The artwork license applies to these assets, not to the application's source code.",
    "No endorsement by the Swiss Armed Forces or the artist is implied.",
    ...assets.map((a) => `${a.file}: ${a.author} — ${a.source}`),
  ].join("\n") + "\n",
);
