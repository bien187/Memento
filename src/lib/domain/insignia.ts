import manifest from "../../../public/insignia/manifest.json";
// The source manifest is shared by the importer, database seed and UI.
export function insigniaForBranch(id: string | null) {
  const asset = manifest.assets.find((asset) => asset.id === id);
  return asset ? { ...asset, path: `/insignia/${asset.file}` } : null;
}
