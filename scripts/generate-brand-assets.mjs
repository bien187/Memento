import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
const logo = await readFile(
  new URL("../public/logo.svg", import.meta.url),
  "utf8",
);
const mini = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
);
const square = logo.replace(
  'width="512" height="512" rx="104"',
  'width="512" height="512" rx="0"',
);
const output = new URL("../public/", import.meta.url);
for (const [name, size, source] of [
  ["icon-192.png", 192, logo],
  ["icon-512.png", 512, logo],
  ["maskable-icon-512.png", 512, square],
  ["apple-touch-icon.png", 180, square],
  ["favicon-16.png", 16, mini],
  ["favicon-32.png", 32, mini],
]) {
  let render = sharp(Buffer.from(source)).resize(size, size);
  if (name.startsWith("apple-") || name.startsWith("maskable-"))
    render = render.flatten({ background: "#3d4939" });
  await render.png().toFile(new URL(name, output).pathname);
}
const sizes = [16, 32, 48],
  images = await Promise.all(
    sizes.map((size) =>
      sharp(Buffer.from(mini)).resize(size, size).png().toBuffer(),
    ),
  );
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [i, size] of sizes.entries()) {
  const at = 6 + i * 16;
  header[at] = size;
  header[at + 1] = size;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
}
await writeFile(
  new URL("favicon.ico", output),
  Buffer.concat([header, ...images]),
);
// Preserve the legacy asset URL without changing browser storage/data identifiers.
await writeFile(new URL("icon.svg", output), logo);
const mark = logo.replace(
  /<svg[^>]*>/,
  '<svg x="78" y="140" width="236" height="236" viewBox="0 0 512 512">',
);
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f5f4ef"/>${mark}<text x="366" y="266" font-family="Helvetica,Arial,sans-serif" font-size="94" letter-spacing="-4" fill="#293225">Memento</text><text x="370" y="326" font-family="Helvetica,Arial,sans-serif" font-size="26" fill="#69745f">Deine Dienstzeit. Deine Geschichte.</text><path d="M80 476h1040" stroke="#d5d9cd"/><text x="80" y="521" font-family="Helvetica,Arial,sans-serif" font-size="15" letter-spacing="3" fill="#69745f">ERLEBT. FESTGEHALTEN. BEWAHRT.</text></svg>`;
await sharp(Buffer.from(og))
  .png()
  .toFile(new URL("og-image.png", output).pathname);
console.log(
  "Memento-Assets erstellt: Hauptmarke, Mini-Icons, ICO, Apple-, PWA- und Maskable-Icons sowie Open Graph.",
);
