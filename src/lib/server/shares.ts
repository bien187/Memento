import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { NextRequest } from "next/server";
import { adminClient } from "../supabase/server";
import type { Snapshot } from "../domain/models";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  try {
    const [salt, digest] = stored.split(":");
    const expected = Buffer.from(digest, "hex"),
      actual = scryptSync(password, salt, 32);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("Unzulässiger Ursprung.");
}
export async function rateLimit(
  request: Request,
  category: string,
  limit = 30,
) {
  const client = adminClient();
  const address =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    "local";
  const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(category + address)
    .digest("hex");
  const { data, error } = await client.rpc("take_rate_limit", {
    rate_key: key,
    max_hits: limit,
  });
  if (error || !data)
    throw new Error(
      "Zu viele Anfragen. Bitte in einer Minute erneut versuchen.",
    );
}
export const cookieName = (token: string) =>
  `feldbuch-share-${hash(token).slice(0, 16)}`;
export function cookieProof(token: string, password_hash: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`${token}:${password_hash}`)
    .digest("hex");
}
export async function authorizedShare(
  request: NextRequest,
  token: string,
  password?: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("Diese Freigabe ist nicht verfügbar.");
  const admin = adminClient(),
    token_hash = hash(token);
  const [{ data: diary, error: de }, { data: book, error: be }] =
    await Promise.all([
      admin
        .from("diary_shares")
        .select("*")
        .eq("token_hash", token_hash)
        .maybeSingle(),
      admin
        .from("book_shares")
        .select("*")
        .eq("token_hash", token_hash)
        .maybeSingle(),
    ]);
  if (de || be) throw new Error("Freigabe derzeit nicht erreichbar.");
  const share = diary ?? book;
  if (
    !share ||
    share.revoked_at ||
    (share.expires_at && new Date(share.expires_at) <= new Date())
  )
    throw new Error("Diese Freigabe ist nicht verfügbar.");
  if (share.password_hash) {
    const proof = request.cookies.get(cookieName(token))?.value,
      expected = cookieProof(token, share.password_hash);
    const valid =
      proof &&
      proof.length === expected.length &&
      timingSafeEqual(Buffer.from(proof), Buffer.from(expected));
    if (!valid && (!password || !checkPassword(password, share.password_hash)))
      throw new Error("PASSWORD_REQUIRED");
  }
  return { admin, share, kind: diary ? ("diary" as const) : ("book" as const) };
}
export async function publicContents(
  access: Awaited<ReturnType<typeof authorizedShare>>,
  token: string,
) {
  const { admin, share, kind } = access;
  let snapshot: Snapshot;
  if (kind === "diary") {
    const { data: period, error: pe } = await admin
      .from("service_periods")
      .select("*")
      .eq("id", share.period_id)
      .eq("owner_id", share.owner_id)
      .is("deleted_at", null)
      .single();
    if (pe || !period) throw new Error("Diese Freigabe ist nicht verfügbar.");
    const { data, error } = await admin
      .from("diary_entries")
      .select("*")
      .eq("period_id", period.id)
      .eq("owner_id", share.owner_id)
      .eq("visibility", "link")
      .is("deleted_at", null)
      .order("date");
    if (error) throw error;
    const entries = (data ?? []).filter(
      (e) => !share.excluded_entry_ids.includes(e.id),
    );
    snapshot = {
      period,
      entries,
      media: [],
      display_name: share.display_name,
      book: {
        id: share.id,
        title: period.title,
        subtitle: "Ein persönliches Tagebuch",
        template: "editorial",
        accent: "olive",
        dedication: "",
        intro: "",
        outro: "",
        cover_id: entries.find((e) => e.cover_id)?.cover_id ?? null,
        chapters: [],
        owner_id: share.owner_id,
        period_id: period.id,
        version: 1,
        updated_at: "",
        deleted_at: null,
      },
    };
  } else {
    const { data: version, error } = await admin
      .from("book_versions")
      .select("snapshot")
      .eq("id", share.version_id)
      .eq("owner_id", share.owner_id)
      .single();
    if (error || !version)
      throw new Error("Diese Freigabe ist nicht verfügbar.");
    snapshot = version.snapshot as Snapshot;
  }
  const mediaIds = new Set<string>([
    ...snapshot.entries.flatMap((e) => e.media_ids),
    ...snapshot.book.chapters.flatMap((c) =>
      c.items.flatMap((i) => i.media_ids),
    ),
    ...(snapshot.book.cover_id ? [snapshot.book.cover_id] : []),
  ]);
  // Resolve real owner-controlled objects; never sign a path taken only from client JSON.
  const { data: media, error } = mediaIds.size
    ? await admin
        .from("entry_media")
        .select("id,storage_path")
        .eq("owner_id", share.owner_id)
        .in("id", [...mediaIds])
    : { data: [], error: null };
  if (error) throw error;
  const paths = new Map(
    (media ?? [])
      .filter((m) =>
        ["jpeg", "png", "webp"].some(
          (ext) => m.storage_path === `${share.owner_id}/${m.id}.${ext}`,
        ),
      )
      .map((m) => [m.id, m.storage_path as string]),
  );
  return {
    snapshot: {
      display_name: share.display_name,
      period: {
        title: snapshot.period.title,
        type: snapshot.period.type,
        start_date: snapshot.period.start_date,
        end_date: snapshot.period.end_date,
      },
      book: {
        title: snapshot.book.title,
        subtitle: snapshot.book.subtitle,
        dedication: snapshot.book.dedication,
        intro: snapshot.book.intro,
        outro: snapshot.book.outro,
        template: snapshot.book.template,
        accent: snapshot.book.accent,
        cover_id: snapshot.book.cover_id,
        chapters: snapshot.book.chapters,
      },
      entries: snapshot.entries.map((e) => ({
        id: e.id,
        date: e.date,
        subtitle: e.subtitle,
        content: e.content,
        milestone: e.milestone,
        media_ids: e.media_ids,
        cover_id: e.cover_id,
      })),
      media: [...paths.keys()].map((id) => ({
        id,
        url: `/api/public/${token}/media/${id}`,
      })),
    },
    paths,
  };
}
