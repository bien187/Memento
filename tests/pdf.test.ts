import { describe, it, expect } from "vitest";
import { generatePDF, type Paper } from "@/lib/pdf";
import { demoRecords } from "@/lib/local/demo";
describe("printable private exports", () => {
  const fixture = demoRecords(crypto.randomUUID());
  for (const paper of ["a4", "a5", "square"] as Paper[])
    it(`exports long content as a valid ${paper} PDF`, async () => {
      const blob = await generatePDF({
        entries: [
          {
            ...fixture.entries[0],
            content:
              "Eine Erinnerung mit Umlauten: Mühe, Glück und Zuversicht.\n".repeat(
                120,
              ),
          },
        ],
        period: fixture.period,
        title: "Meine Geschichte",
        paper,
      });
      const raw = Buffer.from(await blob.arrayBuffer()).toString("latin1");
      expect(raw.startsWith("%PDF-")).toBe(true);
      expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(2);
      const box = raw.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
      expect(box).not.toBeNull();
      const width = Number(box![1]),
        height = Number(box![2]);
      if (paper === "square") expect(width).toBeCloseTo(height);
      else expect(height).toBeGreaterThan(width);
    });
  it("exports a multi-page table of contents without dropping chapters", async () => {
    const snapshot = {
      ...fixture.version.snapshot,
      book: {
        ...fixture.book,
        chapters: Array.from({ length: 100 }, (_, i) => ({
          id: crypto.randomUUID(),
          title: `Kapitel ${i + 1}: Ein langer Titel für eine bleibende Erinnerung`,
          items: [],
        })),
      },
    };
    const blob = await generatePDF({
      entries: [],
      period: fixture.period,
      title: snapshot.book.title,
      paper: "a5",
      snapshot,
    });
    const raw = Buffer.from(await blob.arrayBuffer()).toString("latin1");
    expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(103);
  });
});
