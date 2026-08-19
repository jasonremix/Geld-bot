import { prisma } from "@/lib/db";
import { guard, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { registerSchema, formatZodError } from "@/lib/validation";
import { sendMail } from "@/lib/email/mailer";
import { writeAudit } from "@/lib/security/audit";
import { trackEvent } from "@/lib/analytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = await guard(request, { limit: "register" });
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = registerSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte Eingaben prüfen.", formatZodError(parsed.error));
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Keine Auskunft darüber, ob die Adresse registriert ist (Enumeration-Schutz):
    // die Antwort ist identisch zum Erfolgsfall, es wird aber kein Login gesetzt.
    await sendMail(email, "registration", { name: name || null });
    return jsonOk({ ok: true, redirect: "/login" });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      role: "CUSTOMER",
      customer: { create: { email, name: name || null } },
    },
  });

  await startSession(user.id, "CUSTOMER");
  await sendMail(email, "registration", { name: name || null });
  await writeAudit({
    actorUserId: user.id,
    action: "user.registered",
    entity: "User",
    entityId: user.id,
    ip: clientIp(request),
  });
  await trackEvent({ type: "registration", userId: user.id });

  return jsonOk({ ok: true, redirect: "/dashboard" });
}
