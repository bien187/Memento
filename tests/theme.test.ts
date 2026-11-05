import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { branches } from "../src/lib/domain/catalogs";
import {
  applyBranchTheme,
  branchThemes,
  defaultBranchTheme,
  getBranchTheme,
  type ThemeMode,
} from "../src/lib/domain/theme";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first: string, second: string) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const css = readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);
function neutrals(mode: ThemeMode) {
  const selector = mode === "light" ? ":root {" : '[data-theme="dark"] {';
  const block = css.slice(css.indexOf(selector)).split("}")[0];
  const colour = (name: string) => {
    const match = block.match(new RegExp(`--${name}: (#[0-9a-f]{6});`));
    if (!match) throw new Error(`Missing ${mode} neutral token: ${name}`);
    return match[1];
  };
  return {
    surfaces: [colour("bg"), colour("surface"), colour("surface-muted")],
    text: colour("text"),
    muted: colour("muted"),
  };
}

describe("branch themes", () => {
  it("covers every current catalogue ID and falls back safely for old or missing IDs", () => {
    expect(branchThemes.map((theme) => theme.id)).toEqual(
      branches.map(([id]) => id),
    );
    expect(new Set(branchThemes.map((theme) => theme.id)).size).toBe(
      branches.length,
    );
    for (const [id, name] of branches) {
      expect(getBranchTheme(id).name).toBe(name);
      expect(getBranchTheme(id).status).toBe("provisional-design");
    }
    for (const unknown of [null, undefined, "", "retired-branch"])
      expect(getBranchTheme(unknown)).toBe(defaultBranchTheme);
    expect(getBranchTheme("luftwaffe").palette).toBe("sky");
    expect(getBranchTheme("spezialkraefte").palette).toBe("sand");
  });

  for (const mode of ["light", "dark"] as const) {
    it(`${mode}: every branch meets text and control contrast requirements`, () => {
      const neutral = neutrals(mode);
      for (const theme of [...branchThemes, defaultBranchTheme]) {
        const tokens = theme.tokens[mode];
        for (const surface of [...neutral.surfaces, tokens.tint]) {
          expect(
            contrast(tokens.primary, surface),
            `${theme.id}: accent text`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(tokens.secondary, surface),
            `${theme.id}: secondary text`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(tokens.focus, surface),
            `${theme.id}: focus outline`,
          ).toBeGreaterThanOrEqual(3);
          expect(
            contrast(neutral.text, surface),
            `${theme.id}: neutral text`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(neutral.muted, surface),
            `${theme.id}: muted text`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        expect(
          contrast(tokens.onPrimary, tokens.primary),
          `${theme.id}: button label`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(tokens.primary, tokens.primarySoft),
          `${theme.id}: selected label`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(tokens.secondary, tokens.secondarySoft),
          `${theme.id}: secondary label`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(tokens.focus, tokens.primarySoft),
          `${theme.id}: selected focus`,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("replaces all accent tokens when branch or mode changes and clears the old identity", () => {
    const values = new Map<string, string>();
    const target = {
      dataset: { theme: "", branch: "", themePalette: "" },
      style: {
        setProperty: (name: string, value: string) => {
          values.set(name, value);
        },
      },
    };
    applyBranchTheme(target, "luftwaffe", "light");
    expect(target.dataset).toEqual({
      theme: "light",
      branch: "luftwaffe",
      themePalette: "sky",
    });
    expect(values.get("--accent")).toBe(
      getBranchTheme("luftwaffe").tokens.light.primary,
    );
    applyBranchTheme(target, "spezialkraefte", "dark");
    expect(target.dataset).toEqual({
      theme: "dark",
      branch: "spezialkraefte",
      themePalette: "sand",
    });
    expect(values.get("--accent")).toBe(
      getBranchTheme("spezialkraefte").tokens.dark.primary,
    );
    expect(values.get("--accent-secondary")).toBe(
      getBranchTheme("spezialkraefte").tokens.dark.secondary,
    );
    expect(values.get("--focus")).toBe(
      getBranchTheme("spezialkraefte").tokens.dark.focus,
    );
    expect(values.size).toBe(7);
    applyBranchTheme(target, null, "light");
    expect(target.dataset.branch).toBe("");
    expect(values.get("--accent")).toBe(
      defaultBranchTheme.tokens.light.primary,
    );
  });
});
