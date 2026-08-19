import { randomUUID } from "node:crypto";
import { guard, readJson } from "@/lib/api-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { signSandboxPayload, SANDBOX_SIGNATURE_HEADER } from "@/lib/payments/sandbox";
import { POST as webhookRoute } from "@/app/api/webhooks/payment/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TESTMODUS – simuliert die Rückmeldung des Zahlungsanbieters.
 *
 * Diese Route existiert ausschliesslich, damit der Ablauf ohne echte
 * Credentials vollständig durchgespielt werden kann. Sie ist nur aktiv, wenn
 * PAYMENT_PROVIDER=sandbox gesetzt ist, und erzeugt einen regulär signierten
 * Webhook – die Bestellung wird also über denselben verifizierten Pfad bezahlt
 * wie im Echtbetrieb.
 */
export async function POST(request: Request) {
  const env = getEnv();
  if (env.PAYMENT_PROVIDER !== "sandbox") {
    return jsonError(404, "not_found", "Nicht verfügbar.");
  }

  const blocked = await guard(request, { limit: "checkout" });
  if (blocked) return blocked;

  const body = await readJson<{
    outcome?: string;
    paymentId?: string;
    orderNumber?: string;
    planKey?: string;
    email?: string;
    amountCents?: number;
    currency?: string;
  }>(request);
  if (!body.ok) return body.response;

  const data = body.data;
  if (!data.orderNumber || !data.paymentId) {
    return jsonError(400, "validation_failed", "orderNumber und paymentId sind erforderlich.");
  }

  const success = data.outcome !== "failure";
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const event = {
    id: `sbx_evt_${randomUUID()}`,
    type: success ? "payment_succeeded" : "payment_failed",
    created: now.toISOString(),
    data: {
      orderReference: data.orderNumber,
      paymentId: data.paymentId,
      subscriptionId: success ? `sbx_sub_${data.orderNumber}` : null,
      email: data.email ?? null,
      planKey: data.planKey ?? null,
      amountCents: data.amountCents ?? null,
      currency: data.currency ?? "EUR",
      status: success ? "active" : "failed",
      failureReason: success ? null : "SANDBOX: simulierter Fehlschlag",
      currentPeriodStart: success ? now.toISOString() : null,
      currentPeriodEnd: success ? periodEnd.toISOString() : null,
    },
  };

  const payload = JSON.stringify(event);
  const signature = signSandboxPayload(payload, env.PAYMENT_WEBHOOK_SECRET);

  // Der simulierte Webhook durchläuft exakt denselben Endpunkt inklusive
  // Signaturprüfung und Idempotenz.
  const response = await webhookRoute(
    new Request(`${env.APP_URL}/api/webhooks/payment`, {
      method: "POST",
      headers: { "content-type": "application/json", [SANDBOX_SIGNATURE_HEADER]: signature },
      body: payload,
    }),
  );

  const result = (await response.json()) as Record<string, unknown>;

  return jsonOk({
    ok: response.status === 200,
    sandbox: true,
    webhookStatus: response.status,
    result,
    redirect: success
      ? `/checkout/success?order=${data.orderNumber}`
      : `/checkout/cancelled?order=${data.orderNumber}`,
  });
}
