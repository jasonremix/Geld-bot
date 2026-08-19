import { prisma } from "@/lib/db";
import { guard, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { consumePasswordResetToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { formatZodError, passwordResetConfirmSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = await guard(request, { limit: "passwordReset" });
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = passwordResetConfirmSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte Eingaben prüfen.", formatZodError(parsed.error));
  }

  const userId = await consumePasswordResetToken(parsed.data.token);
  if (!userId) {
    return jsonError(400, "token_invalid", "Der Link ist ungültig oder abgelaufen.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  await writeAudit({
    actorUserId: userId,
    action: "auth.password_reset",
    entity: "User",
    entityId: userId,
    ip: clientIp(request),
  });

  return jsonOk({ ok: true, redirect: "/login" });
}
