import { NextRequest, NextResponse } from "next/server";
import {
  authorizedShare,
  publicContents,
  rateLimit,
} from "@/lib/server/shares";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  try {
    await rateLimit(request, "public-media", 150);
    const { token, id } = await params;
    const access = await authorizedShare(request, token);
    const { paths } = await publicContents(access, token);
    const path = paths.get(id);
    if (!path) return new NextResponse(null, { status: 404 });
    const { data, error } = await access.admin.storage
      .from("diary-media")
      .download(path);
    if (error || !data) throw new Error("Bild nicht verfügbar");
    return new NextResponse(data, {
      headers: {
        "Content-Type": data.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
