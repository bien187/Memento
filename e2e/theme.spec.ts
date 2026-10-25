import { expect, test } from "@playwright/test";
import { getBranchTheme } from "../src/lib/domain/theme";

test("saved branch updates every mode immediately and fits 375 and 430 px", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Lokales Tagebuch öffnen" }).click();
  await page.getByLabel("Vollständiger Name").fill("Alex Muster");
  await page
    .getByLabel("Truppengattung / Dienstzweig", { exact: true })
    .fill("Luftwaffe / Fliegertruppen");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page
    .getByRole("button", { name: "Tagebuch öffnen", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-branch",
    "luftwaffe",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const accent = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim(),
    );
  await expect
    .poll(accent)
    .toBe(getBranchTheme("luftwaffe").tokens.light.primary);

  const navigation = () =>
    page.getByRole("navigation", {
      name:
        page.viewportSize()!.width <= 760
          ? "Mobile Hauptnavigation"
          : "Hauptnavigation",
      exact: true,
    });
  await navigation().getByRole("link", { name: "Profil", exact: true }).click();
  await page.getByRole("button", { name: "Dunkel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(accent)
    .toBe(getBranchTheme("luftwaffe").tokens.dark.primary);
  await page
    .getByRole("button", { name: "Profil bearbeiten", exact: true })
    .click();
  await page
    .getByLabel("Truppengattung / Dienstzweig", { exact: true })
    .fill("Spezialkräfte");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-branch",
    "spezialkraefte",
  );
  await expect
    .poll(accent)
    .toBe(getBranchTheme("spezialkraefte").tokens.dark.primary);
  await expect(page.locator(".brand-icon").first()).toHaveAttribute(
    "src",
    "/logo.svg",
  );

  for (const width of [375, 430]) {
    await page.setViewportSize({ width, height: 850 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await page.getByRole("button", { name: "Hell", exact: true }).click();
  await expect
    .poll(accent)
    .toBe(getBranchTheme("spezialkraefte").tokens.light.primary);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-branch",
    "spezialkraefte",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(accent)
    .toBe(getBranchTheme("spezialkraefte").tokens.dark.primary);
});
