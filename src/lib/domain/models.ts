import { z } from "zod";
import { dayNumber } from "./dates";
// PostgreSQL serializes timestamptz with an explicit offset, not necessarily Z.
// Retain precision and require timezone information at each data boundary.
export const timestampSchema = z.iso.datetime({ offset: true });
export const dateSchema = z.string().refine((v) => {
  try {
    dayNumber(v);
    return true;
  } catch {
    return false;
  }
}, "Gültiges Datum erforderlich");
const base = {
  id: z.uuid(),
  owner_id: z.uuid(),
  version: z.number().int().nonnegative(),
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable().default(null),
};
export const profileSchema = z.object({
  ...base,
  name: z.string().trim().min(2).max(100),
  username: z
    .string()
    .regex(/^[a-z0-9_]{3,30}$/)
    .nullable(),
  rank_id: z.string().max(40).nullable(),
  function_id: z.string().max(60).nullable(),
  branch_id: z.string().max(40).nullable(),
  barracks_id: z.string().max(60).nullable().optional(),
  unit: z.string().max(100),
  discoverable: z.boolean(),
  private_profile: z.boolean(),
  share_function: z.boolean().optional(),
  share_service_period: z.boolean().optional(),
  share_connections: z.boolean().optional(),
  avatar_id: z.uuid().nullable(),
});
export const periodSchema = z
  .object({
    ...base,
    type: z.enum(["RS", "WK", "UOS", "OS", "Andere"]),
    title: z.string().trim().min(2).max(120),
    start_date: dateSchema,
    end_date: dateSchema,
    unit: z.string().max(100),
    rank_id: z.string().nullable(),
    function_id: z.string().nullable(),
    branch_id: z.string().nullable(),
    barracks_id: z.string().max(60).nullable().optional(),
  })
  .refine((p) => p.end_date >= p.start_date, {
    message: "Das Ende muss nach dem Beginn liegen",
    path: ["end_date"],
  });
export const entrySchema = z
  .object({
    ...base,
    period_id: z.uuid(),
    date: dateSchema,
    subtitle: z.string().max(160).default(""),
    content: z.string().max(100000).default(""),
    mood: z.number().int().min(0).max(100).nullable().default(null),
    condition: z.number().int().min(0).max(100).nullable().default(null),
    milestone: z.boolean().default(false),
    visibility: z
      .enum(["private", "followers", "link", "public"])
      .default("private"),
    media_ids: z.array(z.uuid()).max(4).default([]),
    cover_id: z.uuid().nullable().default(null),
    created_at: timestampSchema,
  })
  .refine((e) => !e.cover_id || e.media_ids.includes(e.cover_id), {
    message: "Titelbild muss zum Eintrag gehören",
    path: ["cover_id"],
  });
// The editor validates user input separately from server/local storage metadata.
export const entryInputSchema = z
  .object(entrySchema.shape)
  .omit({
    id: true,
    owner_id: true,
    version: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
  })
  .refine((e) => !e.cover_id || e.media_ids.includes(e.cover_id), {
    message: "Das Titelbild muss zu diesem Eintrag gehören.",
    path: ["cover_id"],
  });
export const mediaSchema = z.object({
  ...base,
  entry_id: z.uuid().nullable(),
  name: z.string().max(200),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  storage_path: z.string().max(300).nullable(),
});
export const itemSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["entry", "text", "gallery"]),
  entry_id: z.uuid().nullable(),
  title: z.string().max(160),
  text: z.string().max(100000),
  media_ids: z.array(z.uuid()).max(30),
});
export const chapterSchema = z.object({
  id: z.uuid(),
  title: z.string().max(160),
  items: z.array(itemSchema).max(1000),
});
export const bookSchema = z.object({
  ...base,
  period_id: z.uuid(),
  title: z.string().min(2).max(160),
  subtitle: z.string().max(200),
  dedication: z.string().max(10000),
  intro: z.string().max(50000),
  outro: z.string().max(50000),
  template: z.enum(["editorial", "dienstbuch", "fotoreportage"]),
  accent: z.enum(["olive", "slate", "rust"]),
  cover_id: z.uuid().nullable(),
  chapters: z.array(chapterSchema).max(100),
});
export const preferencesSchema = z.object({
  ...base,
  theme: z.enum(["light", "dark", "system"]),
  view: z.enum(["grid", "timeline", "cards"]),
  active_period_id: z.uuid().nullable(),
  reminder_enabled: z.boolean(),
  reminder_days: z.array(z.number().int().min(0).max(6)).max(7),
  reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export type Profile = z.infer<typeof profileSchema>;
export type Period = z.infer<typeof periodSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Media = z.infer<typeof mediaSchema> & { blob?: Blob };
export type Book = z.infer<typeof bookSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type BookItem = z.infer<typeof itemSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export const snapshotSchema = z.object({
  book: bookSchema,
  period: periodSchema,
  entries: z.array(entrySchema),
  media: z.array(mediaSchema),
  display_name: z.string().max(100),
});
export const bookVersionSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  book_id: z.uuid(),
  number: z.number().int().positive(),
  snapshot: snapshotSchema,
  created_at: timestampSchema,
  archived: z.boolean(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type BookVersion = z.infer<typeof bookVersionSchema>;
export type Entity =
  Profile | Period | Entry | Book | Preferences | Media | BookVersion;
export type EntityTable =
  | "profiles"
  | "service_periods"
  | "diary_entries"
  | "books"
  | "user_preferences"
  | "entry_media"
  | "book_versions";
export const schemas = {
  profiles: profileSchema,
  service_periods: periodSchema,
  diary_entries: entrySchema,
  books: bookSchema,
  user_preferences: preferencesSchema,
  entry_media: mediaSchema,
  book_versions: bookVersionSchema,
};
export function parseEntity(table: EntityTable, value: unknown): Entity {
  return schemas[table].parse(value);
}
export function baseRecord(owner_id: string, id = crypto.randomUUID()) {
  return {
    id,
    owner_id,
    version: 0,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
}
export function defaultPreferences(owner: string): Preferences {
  return {
    ...baseRecord(owner, owner),
    theme: "system",
    view: "grid",
    active_period_id: null,
    reminder_enabled: false,
    reminder_days: [0, 1, 2, 3, 4, 5, 6],
    reminder_time: "20:30",
  };
}
export function scaleLabel(value: number | null, kind: "mood" | "condition") {
  if (value === null) return "Nicht bewertet";
  return (
    kind === "mood"
      ? [
          "Sehr belastet",
          "Gedrückt",
          "Ausgeglichen",
          "Zuversichtlich",
          "Sehr positiv",
        ]
      : ["Stark erschöpft", "Müde", "Stabil", "Kraftvoll", "Voller Energie"]
  )[Math.min(4, Math.floor(value / 20))];
}
