import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { functionGroups, functions, functionTeam } from "@/lib/domain/catalogs";
import {
  barracks,
  functionBarracks,
  barracksForFunction,
  suggestedBarracks,
} from "@/lib/domain/barracks";
import { insigniaForBranch } from "@/lib/domain/insignia";
import { profileSchema, periodSchema } from "@/lib/domain/models";
import { demoRecords } from "@/lib/local/demo";
import manifest from "../public/insignia/manifest.json";

describe("military function, location and insignia catalogs", () => {
  it("contains all 125 functions in the requested four teams without duplicate identifiers", () => {
    expect(
      functionGroups.map((group) => [group.id, group.functions.length]),
    ).toEqual([
      ["kampf", 21],
      ["hilfe", 18],
      ["unterstuetzung", 41],
      ["technik", 45],
    ]);
    expect(functions).toHaveLength(125);
    expect(new Set(functions.map(([id]) => id)).size).toBe(125);
    expect(new Set(functions.map(([, name]) => name)).size).toBe(125);
    for (const id of [
      "infanterist",
      "artillerist",
      "panzersoldat",
      "bueroordonnanz",
      "truppenkoch",
    ])
      expect(functionTeam(id)).toBeDefined();
    expect(functionTeam("zivilschutzpionier")?.id).toBe("hilfe");
    expect(functionTeam("weltraumsoldat")?.id).toBe("technik");
  });
  it("keeps every suggested location and function reference valid", () => {
    expect(barracks).toHaveLength(29);
    expect(new Set(barracks.map((location) => location.id)).size).toBe(29);
    for (const [id, locations] of Object.entries(functionBarracks)) {
      expect(
        functions.some(([key]) => key === id),
        id,
      ).toBe(true);
      expect(new Set(locations).size).toBe(locations.length);
      for (const location of locations)
        expect(
          barracks.some((item) => item.id === location),
          `${id}: ${location}`,
        ).toBe(true);
    }
  });
  it("suggests specific schools and retains an already selected valid alternative", () => {
    expect(suggestedBarracks("artillerist")).toBe("biere");
    expect(suggestedBarracks("richtstrahlpionier")).toBe("kloten");
    expect(suggestedBarracks("truppenkoch")).toBe("thun");
    expect(suggestedBarracks("cybersoldat")).toBe("jassbach");
    expect(
      barracksForFunction("infanterist").map((location) => location.id),
    ).toContain("colombier");
    expect(suggestedBarracks("infanterist", "colombier")).toBe("colombier");
    expect(suggestedBarracks("artillerist", "colombier")).toBe("biere");
  });
  it("never invents a location for an unmapped or empty function", () => {
    for (const id of [null, "unknown", "weltraumsoldat", "zivilschutzpionier"])
      expect(suggestedBarracks(id, "thun")).toBeNull();
  });
  it("accepts old records without a location and independent selections per period", () => {
    const f = demoRecords(crypto.randomUUID());
    const { barracks_id: _, ...oldProfile } = f.profile;
    const { barracks_id: __, ...oldPeriod } = f.period;
    expect(profileSchema.safeParse(oldProfile).success).toBe(true);
    expect(periodSchema.safeParse(oldPeriod).success).toBe(true);
    expect(
      profileSchema.parse({ ...oldProfile, barracks_id: "biere" }).barracks_id,
    ).toBe("biere");
    expect(
      periodSchema.parse({ ...oldPeriod, barracks_id: "thun" }).barracks_id,
    ).toBe("thun");
  });
  it("ships all 24 licensed SVGs unchanged and identifies unavailable art explicitly", () => {
    expect(manifest.assets).toHaveLength(24);
    for (const asset of manifest.assets) {
      const svg = readFileSync(`public/insignia/${asset.file}`, "utf8");
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(
        /<script\b|<foreignObject\b|\son\w+\s*=|(?:href|src)=["'](?:https?:|\/\/|data:)/i,
      );
      expect(createHash("sha256").update(svg).digest("hex")).toBe(asset.sha256);
      expect(asset.license).toBe("CC BY-SA 4.0");
      expect(asset.author).toBe("Magnum045");
      expect(insigniaForBranch(asset.id)?.path).toBe(`/insignia/${asset.file}`);
    }
    expect(insigniaForBranch("sozialdienst")).toBeNull();
    expect(insigniaForBranch(null)).toBeNull();
  });
});
