import { test, expect, type Page } from "@playwright/test";
const nav = (page: Page) =>
  page.getByRole("navigation", {
    name:
      page.viewportSize()!.width <= 760
        ? "Mobile Hauptnavigation"
        : "Hauptnavigation",
    exact: true,
  });
async function openDemo(page: Page, path = "/demo") {
  await page.goto(path);
  await expect(page.getByRole("note", { name: "Demo-Hinweis" })).toContainText(
    "fiktive Testdaten",
  );
}

test("the demo opens without login and shows the fictional notebook", async ({
  page,
}) => {
  const cloud: string[] = [];
  page.on("request", (request) => {
    if (/supabase\.(co|in)/.test(new URL(request.url()).host))
      cloud.push(request.url());
  });
  await openDemo(page);
  await expect(
    page.getByRole("button", { name: "Lokales Tagebuch öffnen" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Einrücken", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Dienstperiode wechseln")).toHaveValue(
    /0d3e0000-/,
  );
  await expect(page.locator("img").first()).toBeVisible();
  // The demo never persists an identity for the regular app.
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).not.toContain("feldbuch.identity");
  expect(keys).not.toContain("feldbuch.local-id");
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name),
  );
  expect(databases).toContain("memento-demo-v1");
  expect(databases).not.toContain("feldbuch-v1");
  expect(cloud).toEqual([]);
});

test("demo search, calendar, statistics and profile work under /demo", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByPlaceholder("Erinnerungen durchsuchen …").fill("Biwak");
  await expect(
    page.getByRole("heading", { name: "Die erste Nacht im Biwak" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Einrücken", exact: true }),
  ).toHaveCount(0);
  await nav(page).getByRole("link", { name: "Kalender" }).click();
  await expect(page).toHaveURL(/\/demo\/calendar$/);
  await nav(page).getByRole("link", { name: "Statistik" }).click();
  await expect(page).toHaveURL(/\/demo\/statistics$/);
  await expect(page.getByText("Stimmung im Mittel")).toBeVisible();
  await nav(page).getByRole("link", { name: "Community" }).click();
  await expect(page.getByText("In der Demo nicht verfügbar.")).toBeVisible();
  await nav(page).getByRole("link", { name: "Profil" }).click();
  await expect(page).toHaveURL(/\/demo\/profile$/);
  await expect(page.getByText("Demo · fiktives Profil")).toBeVisible();
  await expect(page.getByText("Achtzehn Wochen.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Abmelden" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Demo zurücksetzen" }),
  ).toBeVisible();
});

test("demo changes stay in the demo and reset on reload", async ({ page }) => {
  await openDemo(page);
  await page
    .getByRole("button", { name: "Eintrag schreiben", exact: true })
    .last()
    .click();
  await page.getByLabel("Untertitel (optional)").fill("Besuch in der Demo");
  await page
    .getByLabel("Deine Erinnerung", { exact: true })
    .fill("Nur ein Test.");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Besuch in der Demo" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Einrücken", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Besuch in der Demo" }),
  ).toHaveCount(0);
  // The regular app is unaffected and still starts at its own entry point.
  await page.goto("/");
  await expect(page.getByRole("note", { name: "Demo-Hinweis" })).toHaveCount(0);
  await expect(page.getByText("Matteo Fischer")).toHaveCount(0);
});

test("the demo fits the viewport without horizontal scrolling", async ({
  page,
}) => {
  for (const path of ["/demo", "/demo/calendar", "/demo/profile"]) {
    await openDemo(page, path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
