// Generates the fictional, illustrated photos used by the public demo (/demo).
// The motifs are drawn from simple shapes and contain no real people or places.
// Usage: node scripts/generate-demo-photos.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const out = new URL("../public/demo/photos/", import.meta.url);
await mkdir(out, { recursive: true });
const W = 1200,
  H = 900;
const sky = (id, top, bottom) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
const ridge = (points, fill, opacity = 1) =>
  `<polygon points="0,${H} ${points} ${W},${H}" fill="${fill}" opacity="${opacity}"/>`;
const trees = (y, count, color, seed = 1) =>
  Array.from({ length: count }, (_, i) => {
    const x = ((i * 97 * seed) % W) + 10;
    const h = 60 + ((i * 37 * seed) % 70);
    return `<polygon points="${x},${y - h} ${x - h / 3},${y} ${x + h / 3},${y}" fill="${color}"/>`;
  }).join("");
const scenes = {
  "morgenappell.jpg": `${sky("s", "#f3c98b", "#e9e2cf")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    <circle cx="880" cy="300" r="70" fill="#fbe3b0"/>
    ${ridge("0,520 180,400 360,480 560,350 780,470 980,380 1200,460", "#8c977f", 0.8)}
    ${ridge("0,640 300,560 600,620 900,560 1200,610", "#5b6a50")}
    <rect x="0" y="700" width="${W}" height="200" fill="#c9bfa6"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${240 + i * 80}" y="610" width="34" height="96" rx="12" fill="#3d4939"/><circle cx="${257 + i * 80}" cy="596" r="16" fill="#2f382c"/>`).join("")}`,
  "marsch-nebel.jpg": `${sky("s", "#d9dccf", "#b9c0ad")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    ${ridge("0,430 200,330 420,410 640,300 900,420 1200,340", "#a3ab96", 0.7)}
    ${trees(560, 22, "#6f7b62", 3)}
    ${ridge("0,620 400,580 800,640 1200,590", "#4f5c45")}
    <path d="M520,${H} C560,760 640,700 700,620" stroke="#d8cfb4" stroke-width="40" fill="none"/>
    <rect width="${W}" height="${H}" fill="#f2f2ea" opacity="0.25"/>`,
  "biwak-abend.jpg": `${sky("s", "#2c3445", "#7a5a4a")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 131) % W}" cy="${(i * 53) % 380}" r="${1 + (i % 3)}" fill="#f6efd8" opacity="0.8"/>`).join("")}
    ${ridge("0,560 260,470 520,540 820,450 1200,530", "#232a22")}
    <polygon points="380,720 520,560 660,720" fill="#55603f"/>
    <polygon points="700,730 820,600 940,730" fill="#4a5537"/>
    <ellipse cx="600" cy="780" rx="70" ry="18" fill="#3a2b20"/>
    <polygon points="570,780 600,690 630,780" fill="#f2a14b"/><polygon points="585,780 600,720 615,780" fill="#fbe08a"/>
    <rect x="0" y="790" width="${W}" height="110" fill="#1d231b"/>`,
  "kaserne-hof.jpg": `${sky("s", "#a9c3d6", "#e7ecef")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    <rect x="140" y="300" width="920" height="380" fill="#d8d0bf"/>
    <polygon points="120,300 600,190 1080,300" fill="#7b5d48"/>
    ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 10 }, (_, c) => `<rect x="${190 + c * 86}" y="${340 + r * 80}" width="44" height="50" fill="#5e6d78" opacity="0.85"/>`).join("")).join("")}
    <rect x="560" y="590" width="80" height="90" fill="#3d4939"/>
    <rect x="0" y="680" width="${W}" height="220" fill="#b7ae9a"/>
    <rect x="930" y="420" width="8" height="260" fill="#555"/><rect x="938" y="420" width="70" height="46" fill="#c0392b"/><rect x="963" y="430" width="20" height="26" fill="#fff"/><rect x="956" y="437" width="34" height="12" fill="#fff"/>`,
  "seeufer.jpg": `${sky("s", "#f0b98d", "#9fb6c4")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    ${ridge("0,460 240,320 460,420 700,280 960,400 1200,330", "#6d7b8a", 0.85)}
    <polygon points="700,280 660,330 740,330" fill="#f4f1ea"/>
    <rect x="0" y="520" width="${W}" height="380" fill="#6f93a8"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${(i * 173) % 1100}" y="${560 + (i * 29) % 260}" width="${80 + (i % 4) * 30}" height="4" fill="#d9e6ec" opacity="0.6"/>`).join("")}
    ${ridge("0,820 400,780 800,830 1200,790", "#4a5640")}`,
  "schnee-uebung.jpg": `${sky("s", "#c7d3dc", "#f3f5f6")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    ${ridge("0,420 220,300 460,380 700,260 960,360 1200,290", "#e8edf0")}
    ${ridge("0,420 220,300 300,340 460,380", "#b9c5cc", 0.6)}
    ${trees(640, 18, "#4c5a48", 5)}
    <rect x="0" y="640" width="${W}" height="260" fill="#f6f8f9"/>
    ${Array.from({ length: 5 }, (_, i) => `<rect x="${300 + i * 130}" y="${650 - i * 6}" width="30" height="80" rx="10" fill="#7d866f"/><circle cx="${315 + i * 130}" cy="${636 - i * 6}" r="14" fill="#5c644f"/>`).join("")}`,
  "feldkueche.jpg": `${sky("s", "#e8dcc4", "#d2c4a6")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    <polygon points="160,420 600,240 1040,420" fill="#5d6a4b"/>
    <rect x="200" y="420" width="800" height="300" fill="#6c7a57"/>
    <rect x="420" y="520" width="360" height="200" fill="#3e4632"/>
    <rect x="460" y="560" width="120" height="70" rx="8" fill="#9aa0a6"/><rect x="620" y="560" width="120" height="70" rx="8" fill="#9aa0a6"/>
    ${[0, 1, 2].map((i) => `<path d="M${500 + i * 40},550 c-20,-40 20,-60 0,-100" stroke="#fff" stroke-width="8" fill="none" opacity="0.6"/>`).join("")}
    <rect x="0" y="720" width="${W}" height="180" fill="#a99c7f"/>`,
  "heimweg.jpg": `${sky("s", "#fcd9a8", "#c98c6c")}
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    <circle cx="300" cy="420" r="110" fill="#fff0c8" opacity="0.9"/>
    ${ridge("0,520 300,450 600,500 900,430 1200,490", "#8a6a5a", 0.8)}
    <rect x="0" y="620" width="${W}" height="280" fill="#5b4a3f"/>
    <rect x="0" y="690" width="${W}" height="14" fill="#2f2723"/>
    <rect x="160" y="560" width="760" height="110" rx="18" fill="#c0392b"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${190 + i * 88}" y="580" width="62" height="44" rx="6" fill="#f3d9b5"/>`).join("")}
    <rect x="150" y="660" width="780" height="14" fill="#2f2723"/>`,
};
for (const [name, body] of Object.entries(scenes)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${body.match(/<linearGradient[\s\S]*?<\/linearGradient>/)?.[0] ?? ""}</defs>${body.replace(/<linearGradient[\s\S]*?<\/linearGradient>/, "")}</svg>`;
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(new URL(name, out).pathname);
  console.log("wrote", name);
}
