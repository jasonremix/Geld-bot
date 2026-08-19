import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Interne Bereiche und API-Endpunkte gehören nicht in den Index.
        disallow: ["/admin", "/dashboard", "/api/", "/checkout", "/login", "/register", "/reset-password"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
