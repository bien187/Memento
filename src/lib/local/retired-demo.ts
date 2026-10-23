import { db, type FeldbuchDB } from "./db";

type BrowserStorage = Pick<Storage, "getItem" | "removeItem">;
/** Remove only identities explicitly marked by the retired example mode. */
export async function removeRetiredDemo(
  storage: BrowserStorage,
  database: FeldbuchDB = db,
) {
  let cached: { id?: string; mode?: string } | null = null;
  try {
    cached = JSON.parse(storage.getItem("feldbuch.identity") ?? "null");
  } catch {
    /* Invalid cache is not an identity. */
  }
  const owners = new Set([
    storage.getItem("feldbuch.demo-id"),
    cached?.mode === "demo" ? cached.id : null,
  ]);
  const personalOwner = storage.getItem("feldbuch.local-id");
  for (const owner of owners) {
    if (
      !owner ||
      owner === personalOwner ||
      (cached?.mode === "cloud" && owner === cached.id)
    )
      continue;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        owner,
      )
    )
      continue;
    await database.transaction("rw", database.tables, async () => {
      for (const table of database.tables)
        await table.where("owner_id").equals(owner).delete();
    });
  }
  storage.removeItem("feldbuch.demo-id");
  if (cached?.mode === "demo") storage.removeItem("feldbuch.identity");
}
