import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db";

/**
 * Passwort-Reset-Tokens werden nur als SHA-256-Hash gespeichert.
 * Der Klartext existiert ausschliesslich im Versand-Link.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createPasswordResetToken(
  userId: string,
  ttlMinutes = 60,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
  return raw;
}

export async function consumePasswordResetToken(raw: string): Promise<string | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}
