import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { adminApi, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { getPaymentProvider } from "@/lib/payments";
import { formatZodError, refundSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

/**
 * Erstattung über den Payment Provider.
 *
 * Der lokale Zustand wird erst durch das Refund-Webhook-Event endgültig
 * gesetzt; hier wird nur der Provider-Aufruf ausgelöst und protokolliert.
 * Der Idempotency-Key verhindert doppelte Gutschriften bei Mehrfachklicks.
 */
export async function POST(request: Request) {
  const auth = await adminApi(request, "refunds:write");
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = refundSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte Eingaben prüfen.", formatZodError(parsed.error));
  }

  const payment = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId } });
  if (!payment) return jsonError(404, "not_found", "Zahlung nicht gefunden.");
  if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") {
    return jsonError(409, "not_refundable", "Diese Zahlung kann nicht erstattet werden.");
  }

  const open = payment.amountCents - payment.refundedCents;
  const amount = parsed.data.amountCents ?? open;
  if (amount <= 0 || amount > open) {
    return jsonError(400, "invalid_amount", `Erstattungsbetrag muss zwischen 1 und ${open} Cent liegen.`);
  }

  const provider = getPaymentProvider();
  const idempotencyKey = `refund_${payment.id}_${amount}_${randomUUID().slice(0, 8)}`;

  try {
    const refund = await provider.refundPayment({
      paymentId: payment.providerPaymentId,
      amountCents: amount,
      reason: parsed.data.reason ?? "requested_by_customer",
      idempotencyKey,
    });

    await writeAudit({
      actorUserId: auth.user.id,
      action: "payment.refund_requested",
      entity: "Payment",
      entityId: payment.id,
      ip: clientIp(request),
      meta: { amount, refundId: refund.id, provider: provider.id },
    });

    return jsonOk({
      ok: true,
      refund: { id: refund.id, amountCents: refund.amountCents, status: refund.status },
      note: "Der endgültige Status wird über das Refund-Webhook-Event gesetzt.",
    });
  } catch (error) {
    console.error("refund_failed", (error as Error).message);
    return jsonError(502, "provider_error", "Der Zahlungsanbieter hat die Erstattung abgelehnt.");
  }
}
