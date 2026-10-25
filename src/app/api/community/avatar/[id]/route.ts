import { communityImage } from "@/lib/server/community";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return communityImage("avatar", (await params).id);
}
