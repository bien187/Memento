import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Mit fiktivem Beispiel entdecken" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meine Erinnerungen." }),
  ).toBeVisible();
}
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Lokales Tagebuch öffnen" }).click();
  await page.getByLabel("Vollständiger Name").fill("Alex Muster");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page
    .getByRole("button", { name: "Tagebuch öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meine Erinnerungen." }),
  ).toBeVisible();
}
const nav = (page: Page) =>
  page.getByRole("navigation", {
    name:
      page.viewportSize()!.width <= 760
        ? "Mobile Hauptnavigation"
        : "Hauptnavigation",
    exact: true,
  });
const write = async (page: Page) =>
  page
    .getByRole("button", { name: "Eintrag schreiben", exact: true })
    .last()
    .click();
test("new notebooks stay empty and persist distinct optional assessments", async ({
  page,
}) => {
  await onboard(page);
  await expect(
    page.getByText("Jede Geschichte beginnt mit einem Tag."),
  ).toBeVisible();
  await expect(page.getByText("Lukas Meier", { exact: true })).toHaveCount(0);
  await write(page);
  await page.getByLabel("Untertitel (optional)").fill("Mein erster Tag");
  await page
    .getByLabel("Deine Erinnerung", { exact: true })
    .fill("Ein ruhiger Moment.");
  await page.getByRole("slider", { name: "Stimmung", exact: true }).focus();
  await page.keyboard.press("End");
  await page
    .getByRole("slider", { name: "Körperliche Verfassung", exact: true })
    .focus();
  await page.keyboard.press("Home");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mein erster Tag", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mein erster Tag", exact: true }),
  ).toBeVisible();
  await nav(page).getByRole("link", { name: "Statistik" }).click();
  await expect(page.getByText("Stimmung im Mittel")).toBeVisible();
  await expect(page.locator(".stats-overview")).toContainText("100");
  await expect(page.locator(".stats-overview")).toContainText("0");
});
test("draft recovery, offline editing and fulltext search work", async ({
  page,
  context,
}) => {
  await onboard(page);
  await write(page);
  await page.getByLabel("Untertitel (optional)").fill("Entwurf im Feld");
  await page
    .getByLabel("Deine Erinnerung", { exact: true })
    .fill("Ein seltenes Suchwort: Alpenlicht.");
  await page.getByRole("button", { name: "Schliessen", exact: true }).click();
  await expect(
    page.getByText("Ein gesicherter Entwurf wartet auf dich."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await expect(
    page.getByLabel("Deine Erinnerung", { exact: true }),
  ).toHaveValue(/Alpenlicht/);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Entwurf im Feld", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page
    .getByRole("textbox", { name: "Einträge durchsuchen" })
    .fill("Alpenlicht");
  await expect(page.locator(".entry-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Einträge durchsuchen" })
    .fill("kommt-nicht-vor");
  await expect(page.getByText("Keine passenden Erinnerungen.")).toBeVisible();
});
test("four images are accepted and a fifth is rejected", async ({ page }) => {
  await onboard(page);
  await write(page);
  await page.getByLabel("Untertitel (optional)").fill("Vier Momente");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 20;
    c.height = 20;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#617055";
    ctx.fillRect(0, 0, 20, 20);
    return c.toDataURL("image/png").split(",")[1];
  });
  const buffer = Buffer.from(png, "base64");
  const file = (i: number) => ({
    name: `bild-${i}.png`,
    mimeType: "image/png",
    buffer,
  });
  await page
    .getByLabel("Bilder hinzufügen", { exact: true })
    .setInputFiles([0, 1, 2, 3, 4].map(file));
  await expect(
    page.getByRole("status").filter({ hasText: "höchstens vier Bilder" }),
  ).toBeVisible();
  await page
    .getByLabel("Bilder hinzufügen", { exact: true })
    .setInputFiles([0, 1, 2, 3].map(file));
  await expect(page.locator(".editor-images>div")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Vier Momente/ })
    .first()
    .click();
  await expect(page.locator(".reader-photos img")).toHaveCount(4);
});
test("milestones require confirmation to remove and views are distinct", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Meilenstein entfernen", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page
    .getByRole("button", { name: "Meilenstein entfernen", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Markierung entfernen", exact: true })
    .click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".entries-timeline")).toBeVisible();
  await page
    .getByRole("button", { name: "Kartenansicht", exact: true })
    .click();
  await expect(page.locator(".entries-cards")).toBeVisible();
  await page.reload();
  await expect(page.locator(".entries-cards")).toBeVisible();
});
test("calendar, statistics and all major pages fit small screens", async ({
  page,
}) => {
  await demo(page);
  for (const label of [
    "Kalender",
    "Statistik",
    "Community",
    "Profil",
    "Tagebuch",
  ]) {
    await nav(page).getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  if (page.viewportSize()!.width < 760) {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator(".entry-card").last()).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: `test-results/journal-${test.info().project.name}-viewport.png`,
  });
  await page.screenshot({
    path: `test-results/journal-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("books can be created, reordered, published, and exported", async ({
  page,
}) => {
  await demo(page);
  await nav(page).getByRole("link", { name: "Profil", exact: true }).click();
  await page
    .getByRole("button", { name: "Buch erstellen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "RS-Buch erstellen", exact: true })
    .click();
  await page.getByLabel("Buchtitel", { exact: true }).fill("Meine Geschichte");
  await page
    .getByRole("button", { name: "Abschnitt nach unten", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Version veröffentlichen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Version erstellen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Buchversionen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lesen", exact: true }).last().click();
  await expect(
    page.getByRole("heading", { name: "Meine Geschichte", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Schliessen", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Schliessen", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /35 Einträge exportieren/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});
test("ZIP backup can be inspected and safely merged", async ({ page }) => {
  await demo(page);
  await nav(page).getByRole("link", { name: "Profil", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ZIP sichern", exact: true }).click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page
    .getByLabel("Backup importieren", { exact: true })
    .setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "Backup vor dem Import prüfen" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Geprüfte Daten importieren" })
    .click();
  await page
    .getByRole("button", { name: "Import ausführen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Backup vor dem Import prüfen" }),
  ).toHaveCount(0);
  await nav(page).getByRole("link", { name: "Tagebuch", exact: true }).click();
  await expect(page.locator(".entry-card")).toHaveCount(35);
});

test("cached notebook reopens after a full offline reload", async ({
  page,
  context,
}) => {
  await onboard(page);
  await write(page);
  await page.getByLabel("Untertitel (optional)").fill("Offline bewahrt");
  await page
    .getByLabel("Deine Erinnerung", { exact: true })
    .fill("Auch ohne Verbindung bleibt dieser Text.");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Offline bewahrt", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Du bist offline. Deine Änderungen werden auf diesem Gerät gesichert.",
    ),
  ).toBeVisible();
  await context.setOffline(false);
});
