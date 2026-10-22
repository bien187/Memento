import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import {
  assertOrigin,
  hash,
  newToken,
  passwordHash,
  rateLimit,
} from "@/lib/server/shares";
export const dynamic = "force-dynamic";
const schema = z.object({
  kind: z.enum(["diary", "book"]),
  target_id: z.uuid(),
  display_name: z.string().min(1).max(100),
  password: z.string().max(128).optional(),
  expires_at: z.iso.datetime().nullable(),
  excluded_entry_ids: z.array(z.uuid()).max(5000).default([]),
  confirmed: z.literal(true),
});
export async function GET() {
  try {
    const { client } = await requireUser();
    const [diary, book] = await Promise.all([
      client
        .from("diary_shares")
        .select("id,period_id,display_name,expires_at,revoked_at,created_at"),
      client
        .from("book_shares")
        .select("id,version_id,display_name,expires_at,revoked_at,created_at"),
    ]);
    if (diary.error || book.error)
      throw new Error("Freigaben konnten nicht geladen werden.");
    return NextResponse.json(
      { diary: diary.data, book: book.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Anmeldung oder Server-Konfiguration fehlt." },
      { status: 401 },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
    const { client, user } = await requireUser();
    await rateLimit(request, `create-${user.id}`, 10);
    const body = schema.parse(await request.json());
    if (body.password && body.password.length < 8)
      throw new Error(
        "Das Freigabepasswort muss mindestens acht Zeichen haben.",
      );
    if (body.expires_at && new Date(body.expires_at) <= new Date())
      throw new Error("Das Ablaufdatum muss in der Zukunft liegen.");
    const token = newToken();
    const value = {
      owner_id: user.id,
      display_name: body.display_name,
      token_hash: hash(token),
      password_hash: body.password ? passwordHash(body.password) : null,
      expires_at: body.expires_at,
      ...(body.kind === "diary"
        ? {
            period_id: body.target_id,
            excluded_entry_ids: body.excluded_entry_ids,
          }
        : { version_id: body.target_id }),
    };
    const { error } =
      body.kind === "diary"
        ? await client.from("diary_shares").insert({
            ...value,
            period_id: body.target_id,
            excluded_entry_ids: body.excluded_entry_ids,
          })
        : await client
            .from("book_shares")
            .insert({ ...value, version_id: body.target_id });
    if (error) throw error;
    return NextResponse.json(
      { url: `${request.nextUrl.origin}/share/${token}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Freigabe fehlgeschlagen" },
      { status: 400 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    assertOrigin(request);
    const { client } = await requireUser();
    const body = z
      .object({ kind: z.enum(["diary", "book"]), id: z.uuid() })
      .parse(await request.json());
    const { error } = await client
      .from(body.kind === "diary" ? "diary_shares" : "book_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Freigabe konnte nicht widerrufen werden." },
      { status: 400 },
    );
  }
}
