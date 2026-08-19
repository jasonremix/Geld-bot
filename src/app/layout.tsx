import type { Metadata, Viewport } from "next";
import "./globals.css";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Music Creator Hub – Premium Tools, Sounds & Creator Assets",
    template: "%s · Music Creator Hub",
  },
  description:
    "Dein Musik-Creator Hub für professionelle digitale Musiktools, Sounds, Presets, Templates und Creator-Ressourcen. Monatlich neue Inhalte für Produzenten, DJs, Sänger und Content Creator.",
  keywords: [
    "Musik Presets",
    "Sample Packs",
    "Creator Assets",
    "Musikproduktion",
    "DJ Tools",
    "Ableton Templates",
    "TikTok Sounds",
    "Musik Abo",
  ],
  applicationName: "Music Creator Hub",
  authors: [{ name: "Music Creator Hub" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: appUrl,
    siteName: "Music Creator Hub",
    title: "Make Music. Create More. Go Further.",
    description:
      "Premium Tools, Sounds und Creator Assets für die nächste Generation der Musik.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Make Music. Create More. Go Further.",
    description:
      "Premium Tools, Sounds und Creator Assets für die nächste Generation der Musik.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
