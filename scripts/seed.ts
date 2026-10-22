import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { demoRecords } from "../src/lib/local/demo";
import { ranks, branches, functions } from "../src/lib/domain/catalogs";
import {
  baseRecord,
  defaultPreferences,
  type Entity,
  type EntityTable,
  type Media,
} from "../src/lib/domain/models";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY,
  email = process.env.SEED_EMAIL,
  password = process.env.SEED_PASSWORD;
if (!url || !key || !secret || !email || !password || password.length < 12)
  throw new Error(
    "Supabase-Konfiguration, SEED_EMAIL und SEED_PASSWORD (mindestens 12 Zeichen) sind erforderlich. Siehe .env.example.",
  );
const admin = createClient(url, secret, { auth: { persistSession: false } });
function stable(value: string) {
  const b = createHash("sha256").update(value).digest();
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = b.subarray(0, 16).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
for (const [table, values] of [
  [
    "military_ranks",
    ranks.map(([id, name], position) => ({ id, name, position })),
  ],
  ["military_functions", functions.map(([id, name]) => ({ id, name }))],
  ["military_branches", branches.map(([id, name]) => ({ id, name }))],
] as [string, Record<string, string | number>[]][]) {
  const { error } = await admin.from(table).upsert(values);
  if (error) throw error;
}
const [stem, domain] = email.split("@");
if (!domain) throw new Error("Gültige SEED_EMAIL erforderlich.");
const people = [
  {
    email,
    name: "Lukas Meier",
    username: "lukas_meier_test",
    branch: "infanterie",
    private: true,
  },
  {
    email: `${stem}+nina@${domain}`,
    name: "Nina Keller",
    username: "nina_keller_test",
    branch: "sanitaet",
    private: true,
  },
  {
    email: `${stem}+jan@${domain}`,
    name: "Jan Brunner",
    username: "jan_brunner_test",
    branch: "genie",
    private: false,
  },
];
const users: { id: string; client: SupabaseClient }[] = [];
for (const [index, person] of people.entries()) {
  const { error: createError } = await admin.auth.admin.createUser({
    email: person.email,
    password,
    email_confirm: true,
    user_metadata: { feldbuch_seed: true },
  });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error } = await client.auth.signInWithPassword({
    email: person.email,
    password,
  });
  if (error || !auth.user)
    throw error ?? createError ?? new Error("Seed-Anmeldung fehlgeschlagen.");
  if (auth.user.user_metadata.feldbuch_seed !== true)
    throw new Error(
      "Das vorhandene Konto ist kein dediziertes Testkonto. Seed wurde gestoppt.",
    );
  const owner = auth.user.id;
  users.push({ id: owner, client });
  const fixture = demoRecords(owner);
  const ids = new Map<string, string>();
  let counter = 0;
  function remap(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(remap);
    if (!value || typeof value !== "object") return value;
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (key === "id" || key.endsWith("_id")) {
        if (v === owner || v === null) result[key] = v;
        else if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) {
          if (!ids.has(v)) ids.set(v, stable(`${owner}:${counter++}`));
          result[key] = ids.get(v);
        } else result[key] = v;
      } else result[key] = remap(v);
    }
    return result;
  }
  const f = remap(fixture) as typeof fixture;
  f.profile = {
    ...f.profile,
    name: person.name,
    username: person.username,
    branch_id: person.branch,
    discoverable: true,
    private_profile: person.private,
  };
  const photos: Media[] = [];
  for (const [i, entry] of f.entries.entries()) {
    if (i % 5 !== 0) continue;
    const id = stable(`${owner}:photo:${i}`),
      path = `${owner}/${id}.jpeg`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#d9dfd4"/><path d="M0 650 330 250 700 660 1000 300 1200 650V800H0Z" fill="#8f9b83"/><path d="m0 800 500-300 700 300" fill="#53604b"/><text x="50" y="70" fill="#253326" font-family="sans-serif" font-size="24">FIKTIVES BILDMOTIV / TESTDATEN</text></svg>`;
    const bytes = await sharp(Buffer.from(svg))
      .jpeg({ quality: 82 })
      .toBuffer();
    const { error: upload } = await admin.storage
      .from("diary-media")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (upload && !/already exists|duplicate/i.test(upload.message))
      throw upload;
    photos.push({
      ...baseRecord(owner, id),
      entry_id: entry.id,
      name: "Fiktive Landschaft.jpeg",
      mime: "image/jpeg",
      size: bytes.byteLength,
      storage_path: path,
    });
    entry.media_ids = [id];
    entry.cover_id = id;
  }
  async function put(table: EntityTable, record: Entity) {
    if (table === "book_versions") {
      const { data } = await client
        .from(table)
        .select("id")
        .eq("id", record.id)
        .maybeSingle();
      if (data) return;
    }
    const { data } = await client
      .from(table)
      .select(table === "book_versions" ? "id" : "version")
      .eq("id", record.id)
      .maybeSingle();
    const { data: result, error } = await client.rpc("sync_entity", {
      entity_table: table,
      payload: record,
      expected_version: (data as { version?: number } | null)?.version ?? 0,
      operation_id: crypto.randomUUID(),
    });
    if (error || result?.conflict)
      throw error ?? new Error("Seed-Versionskonflikt.");
  }
  await put("profiles", f.profile);
  await put("service_periods", f.period);
  await put("user_preferences", {
    ...defaultPreferences(owner),
    active_period_id: f.period.id,
  });
  for (const entry of f.entries) await put("diary_entries", entry);
  for (const photo of photos) await put("entry_media", photo);
  await put("books", f.book);
  f.version.snapshot = {
    book: f.book,
    period: f.period,
    entries: structuredClone(f.entries),
    media: photos,
    display_name: person.name,
  };
  await put("book_versions", f.version);
  console.log(
    `Fiktives Testkonto ${index + 1}: 35 Einträge, ${photos.length} Bilder, ein Buch und eine Version eingerichtet.`,
  );
}
for (const [from, to] of [
  [0, 1],
  [0, 2],
  [1, 0],
]) {
  const { error } = await users[from].client.rpc("community_action", {
    target: users[to].id,
    action: "follow",
  });
  if (error) throw error;
  if (people[to].private) {
    const { error } = await users[to].client.rpc("community_action", {
      target: users[from].id,
      action: "accept",
    });
    if (error) throw error;
  }
}
console.log(
  "Seed abgeschlossen. Zugangsdaten wurden ausschliesslich aus Umgebungsvariablen gelesen.",
);
