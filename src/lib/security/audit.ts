import "server-only";
import { prisma } from "../db";

export type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  ip?: string | null;
  meta?: Record<string, unknown>;
};

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "signature",
  "iban",
  "accountnumber",
];

/** Entfernt sensible Felder, bevor sie in Audit-Logs landen. */
export function redact(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      out[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redact(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        ip: input.ip ?? null,
        meta: redact(input.meta) as object,
      },
    });
  } catch (error) {
    // Audit darf den eigentlichen Request niemals zum Absturz bringen.
    console.error("audit_log_failed", (error as Error).message);
  }
}
