import { NextRequest, NextResponse } from "next/server";
import { requireUser, adminClient } from "@/lib/supabase/server";
import { assertOrigin, rateLimit } from "@/lib/server/shares";
export async function DELETE(request: NextRequest) {
  try {
    assertOrigin(request);
    const { user, client } = await requireUser();
    await rateLimit(request, `delete-${user.id}`, 3);
    const body = await request.json();
    if (body.confirmation !== "KONTO LÖSCHEN")
      throw new Error("Bestätigung fehlt.");
    const admin = adminClient();
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage
        .from("diary-media")
        .list(user.id, { limit: 100, offset });
      if (error) throw error;
      if (!data?.length) break;
      const { error: removeError } = await admin.storage
        .from("diary-media")
        .remove(data.map((f) => `${user.id}/${f.name}`));
      if (removeError) throw removeError;
      offset = 0;
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    await client.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Konto konnte nicht gelöscht werden.",
      },
      { status: 400 },
    );
  }
}
