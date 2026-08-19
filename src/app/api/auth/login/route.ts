import { prisma } from "@/lib/db";
import { guard, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { loginSchema, formatZodError } from "@/lib/validation";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJson<{ email?: string }>(request);
  if (!body.ok) return body.response;

  const parsed = loginSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte Eingaben prüfen.", formatZodError(parsed.error));
  }

  // Rate Limit pro IP und zusätzlich pro E-Mail-Adresse.
  const ip = clientIp(request);
  const blockedIp = await guard(request, { limit: "login", identifier: ip });
  if (blockedIp) return blockedIp;
  const blockedUser = await guard(request, {
    limit: "login",
    identifier: `mail:${parsed.data.email}`,
    csrf: false,
  });
  if (blockedUser) return blockedUser;

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

  if (!user || !valid || user.disabledAt) {
    await writeAudit({
      action: "auth.login_failed",
      entity: "User",
      entityId: user?.id,
      ip,
      meta: { email: parsed.data.email },
    });
    // Einheitliche Fehlermeldung – keine Unterscheidung zwischen
    // unbekannter Adresse und falschem Passwort.
    return jsonError(401, "invalid_credentials", "E-Mail oder Passwort ist falsch.");
  }

  const role = user.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
  await startSession(user.id, role);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ actorUserId: user.id, action: "auth.login", entity: "User", entityId: user.id, ip });

  const next = parsed.data.next;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  return jsonOk({ ok: true, redirect: safeNext ?? (role === "ADMIN" ? "/admin" : "/dashboard") });
}
