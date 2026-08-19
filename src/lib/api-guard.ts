import "server-only";
import type { NextResponse } from "next/server";
import { getEnv } from "./env";
import { assertCsrf } from "./security/csrf";
import { rateLimit, type RateLimitName } from "./security/rate-limit";
import { clientIp, jsonError, tooManyRequests } from "./http";
import { getCurrentUser, type CurrentUser } from "./auth/current-user";
import { hasPermission, type Permission } from "./auth/rbac";

/**
 * Gemeinsame Schutzschicht für schreibende API-Routen:
 * Rate Limiting + CSRF-Prüfung. Webhook-Endpunkte nutzen stattdessen die
 * Signaturprüfung des Providers.
 */
export async function guard(
  request: Request,
  options: { limit?: RateLimitName; identifier?: string; csrf?: boolean } = {},
): Promise<NextResponse | null> {
  const env = getEnv();

  if (options.limit) {
    const id = options.identifier ?? clientIp(request);
    const result = await rateLimit(options.limit, id, env.RATE_LIMIT_DISABLED);
    if (!result.allowed) return tooManyRequests(result.resetAt);
  }

  if (options.csrf !== false) {
    const check = await assertCsrf(request);
    if (!check.ok) {
      // Der Grund bleibt serverseitig (keine Hinweise für Angreifer), ist aber
      // für die Diagnose wichtig: `origin_mismatch` bedeutet fast immer, dass
      // APP_URL nicht zur tatsächlich aufgerufenen Domain passt.
      console.warn(
        `csrf_rejected reason=${check.reason} path=${new URL(request.url).pathname} ` +
          `origin=${request.headers.get("origin") ?? "-"} app_url=${env.APP_URL}`,
      );
      return jsonError(403, "csrf_failed", "Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden.");
    }
  }

  return null;
}

/** Liest und begrenzt den JSON-Body einer Anfrage. */
export async function readJson<T = unknown>(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const text = await request.text();
  if (text.length > maxBytes) {
    return { ok: false, response: jsonError(413, "payload_too_large", "Anfrage ist zu groß.") };
  }
  try {
    return { ok: true, data: JSON.parse(text || "{}") as T };
  } catch {
    return { ok: false, response: jsonError(400, "invalid_json", "Ungültiger JSON-Body.") };
  }
}

/**
 * Schutz für Admin-API-Routen: Session, Rolle, Berechtigung.
 * Ohne Treffer wird eine Fehlerantwort zurückgegeben (nie ein Redirect).
 */
export async function adminApi(
  request: Request,
  permission: Permission,
  options: { csrf?: boolean; limit?: RateLimitName } = {},
): Promise<{ ok: true; user: CurrentUser } | { ok: false; response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || !user.adminRole) {
    return { ok: false, response: jsonError(404, "not_found", "Nicht gefunden.") };
  }

  const blocked = await guard(request, {
    limit: options.limit ?? "adminWrite",
    identifier: user.id,
    csrf: options.csrf,
  });
  if (blocked) return { ok: false, response: blocked };

  if (!hasPermission({ adminRole: user.adminRole, permissions: user.permissions }, permission)) {
    return {
      ok: false,
      response: jsonError(403, "forbidden", "Für diese Aktion fehlt die Berechtigung."),
    };
  }

  return { ok: true, user };
}
