import { baseRecord, type Media } from "../domain/models";
export async function prepareImage(
  file: File,
  owner: string,
  entry_id: string | null,
): Promise<Media> {
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Das Originalbild darf höchstens 25 MB gross sein.");
  let blob: Blob = file;
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    try {
      const { heicTo } = await import("heic-to/csp");
      blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.85 });
    } catch {
      throw new Error(
        "Dieses HEIC-Bild konnte nicht gelesen werden. Bitte als JPEG exportieren.",
      );
    }
  }
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type))
    throw new Error("Bitte JPEG, PNG, WebP oder HEIC verwenden.");
  const bitmap = await createImageBitmap(blob);
  const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const compressed = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Bildverarbeitung fehlgeschlagen.")),
      "image/jpeg",
      0.86,
    ),
  );
  if (compressed.size > 5 * 1024 * 1024)
    throw new Error("Das komprimierte Bild ist zu gross (maximal 5 MB).");
  return {
    ...baseRecord(owner),
    entry_id,
    name: file.name,
    mime: "image/jpeg",
    size: compressed.size,
    storage_path: null,
    blob: compressed,
  };
}
