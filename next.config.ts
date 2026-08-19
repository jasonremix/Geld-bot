import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Sicherheits-Header gelten fuer alle Routen. Die CSP ist bewusst eng gehalten:
 * kein externes Script, keine Inline-Scripts ausser dem Next.js-Bootstrap.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js benoetigt inline-Script fuer den Hydration-Bootstrap.
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/adapter-pg", "nodemailer"],
  experimental: {
    optimizePackageImports: [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...(isProd
        ? [
            {
              source: "/:path*",
              headers: [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ],
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
