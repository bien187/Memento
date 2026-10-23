import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { tsImport } from "tsx/esm/api";
const { populateNotebook } = await tsImport(
  "../e2e/notebook-fixture.ts",
  import.meta.url,
);

const baseURL = process.env.MEMENTO_SCREENSHOT_URL ?? "http://localhost:3200";
const output = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? "chrome",
});

async function screenshot(page, filename) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.screenshot({
    path: `${output}/${filename}.png`,
    animations: "disabled",
  });
  console.log(`Captured ${filename}.png`);
}

async function demo(viewport, mobile = false) {
  const context = await browser.newContext({
    baseURL,
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
  });
  const page = await context.newPage();
  await populateNotebook(page);
  return page;
}

async function navigate(page, name, mobile = false) {
  await page
    .getByRole("navigation", {
      name: mobile ? "Mobile Hauptnavigation" : "Hauptnavigation",
      exact: true,
    })
    .getByRole("link", { name, exact: true })
    .click();
  await expect(page.locator("main h1")).toBeVisible();
}

try {
  const desktop = await demo({ width: 1440, height: 1000 });
  await screenshot(desktop, "desktop-diary");
  await navigate(desktop, "Statistik");
  await expect(desktop.locator(".recharts-surface").first()).toBeVisible();
  await screenshot(desktop, "desktop-statistics");
  await navigate(desktop, "Profil");
  await desktop
    .getByRole("button", { name: "Profil bearbeiten", exact: true })
    .click();
  await desktop
    .getByLabel("Grundfunktion", { exact: true })
    .fill("Richtstrahlpionier/-in");
  await expect(
    desktop.getByLabel("Kaserne / Standort (privat)", { exact: true }),
  ).toHaveValue("kloten");
  await desktop
    .getByLabel("Kaserne / Standort (privat)", { exact: true })
    .scrollIntoViewIfNeeded();
  await screenshot(desktop, "desktop-function-barracks");
  await desktop
    .getByRole("button", { name: "Alle Abzeichen", exact: true })
    .click();
  await expect
    .poll(() =>
      desktop
        .locator(".insignia-grid img")
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await screenshot(desktop, "desktop-insignia");
  await desktop
    .getByRole("button", { name: "Schliessen", exact: true })
    .last()
    .click();
  await desktop
    .getByRole("button", { name: "Schliessen", exact: true })
    .last()
    .click();
  await desktop.locator(".book-card > button").first().click();
  await expect(desktop.getByLabel("Buchtitel", { exact: true })).toBeVisible();
  await screenshot(desktop, "desktop-book-editor");
  await desktop.getByRole("button", { name: "Vorschau", exact: true }).click();
  await expect(desktop.locator(".book-reading")).toBeVisible();
  await screenshot(desktop, "desktop-book-reader");

  const mobile = await demo({ width: 390, height: 844 }, true);
  await screenshot(mobile, "mobile-diary");
  await navigate(mobile, "Kalender", true);
  await expect(mobile.locator(".calendar-panel")).toBeVisible();
  await screenshot(mobile, "mobile-calendar");
  await navigate(mobile, "Tagebuch", true);
  await mobile
    .getByRole("button", { name: "Eintrag schreiben", exact: true })
    .last()
    .click();
  await mobile
    .getByLabel("Untertitel (optional)")
    .fill("Ein Moment, der bleibt");
  await mobile
    .getByLabel("Deine Erinnerung", { exact: true })
    .fill(
      "Nach der Übung sitzen wir noch einen Moment zusammen. Die Berge liegen schon im Schatten. Heute ist aus einer Gruppe ein Team geworden.",
    );
  await expect(
    mobile.getByText("Entwurf auf diesem Gerät gesichert", { exact: true }),
  ).toBeVisible();
  await screenshot(mobile, "mobile-entry-editor");
} finally {
  await browser.close();
}
