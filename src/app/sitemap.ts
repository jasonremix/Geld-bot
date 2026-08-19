import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const now = new Date();

  return [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/impressum`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/datenschutz`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/agb`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/widerruf`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
