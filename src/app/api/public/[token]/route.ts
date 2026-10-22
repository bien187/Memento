import { NextRequest, NextResponse } from "next/server";
import {
  authorizedShare,
  publicContents,
  cookieName,
  cookieProof,
  rateLimit,
} from "@/lib/server/shares";
export const dynamic = "force-dynamic";
async function read(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await rateLimit(request, "public-read", 60);
    const { token } = await context.params;
    let password: string | undefined;
    if (request.method === "POST") {
      const body = await request.json();
      if (typeof body.password === "string" && body.password.length <= 128)
        password = body.password;
    }
    const access = await authorizedShare(request, token, password);
    const { snapshot } = await publicContents(access, token);
    const response = NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, no-store" },
    });
    if (access.share.password_hash)
      response.cookies.set(
        cookieName(token),
        cookieProof(token, access.share.password_hash),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: `/api/public/${token}`,
          maxAge: 900,
        },
      );
    return response;
  } catch (e) {
    const text = e instanceof Error ? e.message : "Freigabe nicht verfügbar.";
    return NextResponse.json(
      { error: text },
      {
        status: text === "PASSWORD_REQUIRED" ? 401 : 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export const GET = read;
export const POST = read;
