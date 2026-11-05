import { test, expect } from "@playwright/test";
import { authorId, publicEntries } from "../tests/fixtures/community";

test.beforeEach(async ({ page, request }) => {
  await request.get("http://127.0.0.1:54389/__reset");
  await page.goto("/");
  await page.getByLabel("E-Mail", { exact: true }).fill("test@example.test");
  await page.getByLabel("Passwort", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Meine Erinnerungen." }),
  ).toBeVisible();
});

test("feed, direct profiles, pagination and full entry remain read only", async ({
  page,
}) => {
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Community." })).toBeVisible();
  await expect(page.locator(".social-entries .entry-card")).toHaveCount(20);
  await page.getByRole("button", { name: "Weitere Einträge laden" }).click();
  await expect(page.locator(".social-entries .entry-card")).toHaveCount(25);
  await page.locator(".social-author a").first().click();
  await expect(page).toHaveURL(new RegExp(`/community/profile/${authorId}`));
  await expect(
    page.getByRole("heading", { name: "Robin Beispiel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bearbeiten", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Sichtbare Einträge", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Stimmung", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".entries-timeline")).toBeVisible();
  await page.getByRole("button", { name: "Meilensteine", exact: true }).click();
  await expect(page.locator(".social-entries .entry-card")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Alle Einträge", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Erinnerung 1$/, exact: false })
    .first()
    .click();
  const reader = page.getByRole("dialog");
  await expect(reader).toContainText(publicEntries[0].content);
  await expect(reader.locator(".reader-photos img")).toHaveCount(2);
  await expect
    .poll(() =>
      reader
        .locator(".reader-photos img")
        .evaluateAll((images: HTMLImageElement[]) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await reader.getByRole("button", { name: "Foto 1 vergrössern" }).click();
  await expect(page.locator(".public-gallery-photo")).toBeVisible();
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Schliessen", exact: true })
    .click();
  await expect(reader.getByRole("button", { name: "Bearbeiten" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Schliessen", exact: true }).click();
  await page.getByRole("link", { name: "Zurück zur Community" }).click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(page.locator(".social-entries .entry-card")).toHaveCount(25);
  await page.goto(`/community/profile/${authorId}`);
  await expect(
    page.getByRole("heading", { name: "Robin Beispiel", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/community-profile-${test.info().project.name}.png`,
    fullPage: false,
    animations: "disabled",
  });
});

test("menu handles keyboard, search, requests and refreshed counters", async ({
  page,
}) => {
  await page.goto("/community");
  const menu = page.getByRole("button", { name: /Community-Menü/ });
  await expect(menu).toContainText("1");
  await menu.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Leute finden", exact: true }).click();
  await page.getByRole("textbox", { name: "Personen suchen" }).fill("Robin");
  await expect(
    page.getByRole("link", { name: /Robin Beispiel/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zum Menü" }).click();
  await page
    .getByRole("button", { name: "Follow-Anfragen", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Kim Beispiel/ })).toBeVisible();
  await page.getByRole("button", { name: "Annehmen", exact: true }).click();
  await expect(page.getByText("Alles ruhig hier.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu.locator(".request-count")).toHaveCount(0);
  await menu.tap();
  await page
    .getByRole("button", { name: "Gefolgte Benutzer", exact: true })
    .tap();
  await expect(
    page.getByRole("link", { name: /Robin Beispiel/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Dunkel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/community");
  await expect(
    page.locator(".social-entries .entry-card").first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/community-feed-${test.info().project.name}.png`,
  });
});

test("offset timestamp roundtrip can be edited and reopened", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Eintrag schreiben", exact: true })
    .last()
    .click();
  await page.getByLabel("Untertitel (optional)").fill("Cloud-Erinnerung");
  await page
    .getByLabel("Deine Erinnerung", { exact: true })
    .fill("Bleibt nach dem Roundtrip erhalten.");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cloud-Erinnerung", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector(".sync-indicator")?.textContent,
      ),
    )
    .toContain("Synchronisiert");
  await page
    .getByRole("button", { name: /Cloud-Erinnerung/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 20;
    canvas.getContext("2d")!.fillRect(0, 0, 20, 20);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Bilder hinzufügen", { exact: true })
    .setInputFiles({
      name: "moment.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(page.locator(".editor-images > div")).toHaveCount(1);
  await page.getByRole("button", { name: "Meilenstein", exact: true }).click();
  await page.getByRole("slider", { name: "Stimmung", exact: true }).focus();
  await page.keyboard.press("End");
  await page
    .getByRole("slider", { name: "Körperliche Verfassung", exact: true })
    .focus();
  await page.keyboard.press("Home");
  await page
    .getByLabel("Untertitel (optional)")
    .fill("Cloud-Erinnerung ergänzt");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Cloud-Erinnerung ergänzt",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator(".sync-indicator").textContent())
    .toContain("Synchronisiert");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Cloud-Erinnerung ergänzt",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Invalid ISO datetime|invalid_format/),
  ).toHaveCount(0);
});
