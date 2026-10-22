import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/store";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Memento · Deine Dienstzeit. Deine Geschichte.",
    template: "%s · Memento",
  },
  description:
    "Dein persönliches Militärtagebuch. Erinnerungen festhalten, Dienstzeit begleiten und Geschichten bewahren.",
  applicationName: "Memento",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Memento · Deine Dienstzeit. Deine Geschichte.",
    siteName: "Memento",
    description:
      "Dein persönliches Militärtagebuch. Erinnerungen festhalten und Geschichten bewahren.",
    locale: "de_CH",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Memento – Deine Dienstzeit. Deine Geschichte.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Memento",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Memento" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3d4939",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
