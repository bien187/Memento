import { NextResponse } from "next/server";
import { requireUser, adminClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { client } = await requireUser();
    const admin = adminClient();
    const { data: media } = await admin
      .from("entry_media")
      .select("entry_id,storage_path")
      .eq("id", id)
      .single();
    if (!media?.entry_id) return new NextResponse(null, { status: 404 });
    const { data: entry } = await admin
      .from("diary_entries")
      .select("owner_id")
      .eq("id", media.entry_id)
      .single();
    const { data: feed, error } = await client.rpc("community_feed", {
      person: entry?.owner_id,
    });
    if (
      error ||
      !Array.isArray(feed) ||
      !feed.some((e) => e.id === media.entry_id && e.media_ids.includes(id))
    )
      return new NextResponse(null, { status: 404 });
    const { data, error: downloadError } = await admin.storage
      .from("diary-media")
      .download(media.storage_path);
    if (downloadError || !data) throw new Error();
    return new NextResponse(data, {
      headers: {
        "Content-Type": data.type,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
