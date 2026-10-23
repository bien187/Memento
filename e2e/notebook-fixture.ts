import { expect, type Page } from "@playwright/test";
import JSZip from "jszip";
import sharp from "sharp";
import { demoRecords } from "../tests/fixtures/notebook";
import {
  baseRecord,
  defaultPreferences,
  type Media,
} from "../src/lib/domain/models";

// Test-only data enters through the real backup importer; the app has no demo login.
async function fixtureZip(owner: string) {
  const fixture = demoRecords(owner);
  const zip = new JSZip();
  const media: Media[] = [];
  for (const [index, entry] of fixture.entries.entries()) {
    if (index % 5 !== 0) continue;
    const id = crypto.randomUUID();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#d9dfd4"/><path d="M0 600 350 210 700 650 1000 280 1200 620V800H0Z" fill="#8f9b83"/><path d="M0 800 500 480 1200 800" fill="#53604b"/><text x="50" y="70" fill="#253326" font-family="sans-serif" font-size="24">FIKTIVES BILDMOTIV / MEMENTO</text></svg>`;
    const bytes = await sharp(Buffer.from(svg))
      .jpeg({ quality: 80 })
      .toBuffer();
    media.push({
      ...baseRecord(owner, id),
      entry_id: entry.id,
      name: "Fiktive Landschaft.jpg",
      mime: "image/jpeg",
      size: bytes.length,
      storage_path: null,
    });
    entry.media_ids = [id];
    entry.cover_id = id;
    zip.file(`media/${id}`, bytes);
  }
  fixture.book.cover_id = media[0].id;
  fixture.version.snapshot = {
    book: fixture.book,
    period: fixture.period,
    entries: fixture.entries,
    media,
    display_name: fixture.profile.name,
  };
  zip.file(
    "feldbuch.json",
    JSON.stringify({
      format: "feldbuch",
      schema_version: 1,
      exported_at: new Date().toISOString(),
      owner_id: owner,
      data: {
        profiles: [fixture.profile],
        service_periods: [fixture.period],
        diary_entries: fixture.entries,
        entry_media: media,
        books: [fixture.book],
        book_versions: [fixture.version],
        user_preferences: [
          { ...defaultPreferences(owner), active_period_id: fixture.period.id },
        ],
      },
    }),
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
export async function populateNotebook(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Lokales Tagebuch öffnen" }).click();
  await page.getByLabel("Vollständiger Name").fill("Lukas Meier");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Dienstperiode später erfassen/ })
    .check();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page
    .getByRole("button", { name: "Tagebuch öffnen", exact: true })
    .click();
  const navigation = page.getByRole("navigation", {
    name:
      page.viewportSize()!.width <= 760
        ? "Mobile Hauptnavigation"
        : "Hauptnavigation",
    exact: true,
  });
  await navigation.getByRole("link", { name: "Profil", exact: true }).click();
  const owner = await page.evaluate(
    () => JSON.parse(localStorage.getItem("feldbuch.identity")!).id as string,
  );
  await page
    .getByLabel("Backup importieren", { exact: true })
    .setInputFiles({
      name: "test-fixture.zip",
      mimeType: "application/zip",
      buffer: await fixtureZip(owner),
    });
  await expect(
    page.getByRole("heading", { name: "Backup vor dem Import prüfen" }),
  ).toBeVisible();
  await page.getByLabel("Importmodus", { exact: true }).selectOption("restore");
  await page
    .getByRole("button", { name: "Geprüfte Daten importieren", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import ausführen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Backup vor dem Import prüfen" }),
  ).toHaveCount(0);
  await navigation.getByRole("link", { name: "Tagebuch", exact: true }).click();
  await expect(page.locator(".entry-card")).toHaveCount(35);
  await expect(page.locator(".entry-card").last()).toHaveCSS("opacity", "1");
}
