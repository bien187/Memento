import type { Metadata } from "next";
import { App } from "@/components/app";
export const metadata: Metadata = {
  title: "Demo",
  description:
    "Memento ausprobieren: ein vollständig fiktives Militärtagebuch, ohne Anmeldung und ohne Konto.",
};
/** Public demo. Runs entirely in the browser with fictional data (see src/lib/demo). */
export default async function DemoPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return <App section={section?.[0] ?? "diary"} />;
}
