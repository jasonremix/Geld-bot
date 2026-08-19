import { prisma } from "@/lib/db";
import { guard, readJson } from "@/lib/api-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { createPasswordResetToken } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/email/mailer";
import { formatZodError, passwordResetRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = await guard(request, { limit: "passwordReset" });
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = passwordResetRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte E-Mail prüfen.", formatZodError(parsed.error));
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (user && !user.disabledAt) {
    const token = await createPasswordResetToken(user.id, 60);
    await sendMail(user.email, "password_reset", {
      resetUrl: `${getEnv().APP_URL}/reset-password?token=${token}`,
    });
  }

  // Immer dieselbe Antwort – kein Rückschluss auf existierende Accounts.
  return jsonOk({
    ok: true,
    message: "Falls ein Account existiert, wurde eine E-Mail mit weiteren Schritten versendet.",
  });
}
