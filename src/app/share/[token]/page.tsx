import { PublicReader } from "@/components/public-reader";
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicReader token={token} />;
}
