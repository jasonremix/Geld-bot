import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { issueCsrfTokenEdge, looksLikeCsrfToken } from "@/lib/security/csrf-edge";

/**
 * Proxy (früher: Middleware) mit zwei Aufgaben:
 *  1. CSRF-Cookie ausstellen (Double-Submit-Verfahren).
 *  2. Geschützte Bereiche früh absichern: ohne gültige Session gibt es keinen
 *     Zugriff auf /dashboard oder /admin. Die feingranulare Rechteprüfung
 *     erfolgt zusätzlich in der jeweiligen Seite bzw. Route.
 */

const SESSION_COOKIE = "gb_session";
const CSRF_COOKIE = "gb_csrf";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

async function readSessionRole(token: string | undefined): Promise<"CUSTOMER" | "ADMIN" | null> {
  if (!token) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "geld-bot",
      audience: "geld-bot",
      algorithms: ["HS256"],
    });
    return payload.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response: NextResponse | null = null;

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const role = await readSessionRole(request.cookies.get(SESSION_COOKIE)?.value);

    if (!role) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      response = NextResponse.redirect(url);
    } else if (pathname.startsWith("/admin") && role !== "ADMIN") {
      // Admin-Bereiche sind niemals öffentlich erreichbar.
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "?error=forbidden";
      response = NextResponse.redirect(url);
    }
  }

  const result = response ?? NextResponse.next();

  const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;
  if (!looksLikeCsrfToken(csrfCookie)) {
    const secret = process.env.CSRF_SECRET;
    if (secret && secret.length >= 32) {
      result.cookies.set(CSRF_COOKIE, await issueCsrfTokenEdge(secret), {
        httpOnly: false, // muss für das Double-Submit clientseitig lesbar sein
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
    }
  }

  return result;
}

export const config = {
  matcher: [
    // Statische Assets und Webhooks bleiben unberührt.
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|robots.txt|sitemap.xml).*)",
  ],
};
