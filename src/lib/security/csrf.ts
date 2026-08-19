import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "../env";

export const CSRF_COOKIE = "gb_csrf";
export const CSRF_HEADER = "x-csrf-token";

function sign(nonce: string): string {
  return createHmac("sha256", getEnv().CSRF_SECRET).update(nonce).digest("base64url");
}

export function issueCsrfToken(): string {
  const nonce = randomBytes(18).toString("base64url");
  return `${nonce}.${sign(nonce)}`;
}

export function isValidCsrfToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) return false;
  const expected = sign(nonce);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Setzt das CSRF-Cookie, falls noch keins existiert, und liefert den Token. */
export async function ensureCsrfCookie(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  if (existing && isValidCsrfToken(existing)) return existing;

  const token = issueCsrfToken();
  jar.set(CSRF_COOKIE, token, {
    // Muss für den Client lesbar sein (Double-Submit-Verfahren).
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return token;
}

export type CsrfCheck = { ok: true } | { ok: false; reason: string };

/**
 * Double-Submit-Prüfung plus Origin-Abgleich.
 * Webhook-Endpunkte sind ausgenommen – sie werden über Signaturen verifiziert.
 */
export function checkCsrf(request: Request, cookieToken: string | undefined): CsrfCheck {
  const headerToken = request.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return { ok: false, reason: "csrf_token_missing" };
  if (!isValidCsrfToken(cookieToken)) return { ok: false, reason: "csrf_token_invalid" };

  const a = Buffer.from(headerToken);
  const b = Buffer.from(cookieToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "csrf_token_mismatch" };
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const allowed = new URL(getEnv().APP_URL).host;
      const seen = new URL(origin).host;
      if (allowed !== seen) return { ok: false, reason: "origin_mismatch" };
    } catch {
      return { ok: false, reason: "origin_invalid" };
    }
  }
  return { ok: true };
}

export async function assertCsrf(request: Request): Promise<CsrfCheck> {
  const jar = await cookies();
  return checkCsrf(request, jar.get(CSRF_COOKIE)?.value);
}
