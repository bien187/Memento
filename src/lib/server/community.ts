import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser, adminClient } from "@/lib/supabase/server";

const mediaGrantSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  storage_path: z.string(),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

/** Authorize with the caller's session before using privileged Storage access. */
export async function communityImage(kind: "entry" | "avatar", id: string) {
  if (!z.uuid().safeParse(id).success)
    return new NextResponse(null, { status: 404 });
  try {
    const { client } = await requireUser();
    const { data: grant, error } = await client.rpc(
      kind === "avatar" ? "community_avatar" : "community_media",
      kind === "avatar" ? { person: id } : { media_id: id },
    );
    const parsed = mediaGrantSchema.safeParse(grant);
    if (error || !parsed.success)
      return new NextResponse(null, { status: 404 });
    const media = parsed.data;
    const expected = `${media.owner_id}/${media.id}.${media.mime.split("/")[1]}`;
    if (media.storage_path !== expected)
      return new NextResponse(null, { status: 404 });
    const { data, error: downloadError } = await adminClient()
      .storage.from("diary-media")
      .download(expected);
    if (downloadError || !data)
      return new NextResponse(null, { status: 404 });
    return new NextResponse(data, {
      headers: {
        "Content-Type": media.mime,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Community image could not be loaded", error);
    return new NextResponse(null, { status: 404 });
  }
}
