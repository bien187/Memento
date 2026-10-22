import { App } from "@/components/app";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return <App section={section?.[0] ?? "diary"} />;
}
