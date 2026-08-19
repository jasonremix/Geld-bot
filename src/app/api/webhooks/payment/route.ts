import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { clientIp } from "@/lib/http";
import { getPaymentProvider } from "@/lib/payments";
import { processWebhookEvent } from "@/lib/webhooks/process";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";
// Webhooks dürfen niemals aus einem Cache beantwortet werden.
export const dynamic = "force-dynamic";

/**
 * Zentraler Webhook-Endpunkt des Zahlungsanbieters.
 *
 * Ablauf: Rohtext lesen → Signatur prüfen → Event normalisieren →
 * idempotent verarbeiten. Ohne gültige Signatur passiert nichts.
 */
export async function POST(request: Request) {
  // Kein CSRF (serverseitiger Aufruf), aber ein grosszügiges Rate Limit.
  const blocked = await guard(request, { limit: "webhook", csrf: false });
  if (blocked) return blocked;

  const payload = await request.text();
  const provider = getPaymentProvider();

  const verification = await provider.verifyWebhook({ payload, headers: request.headers });

  if (!verification.ok) {
    await writeAudit({
      action: "webhook.rejected",
      entity: "WebhookEvent",
      ip: clientIp(request),
      meta: { provider: provider.id, reason: verification.reason },
    });
    // 400 signalisiert dem Provider eine ungültige Zustellung.
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const result = await processWebhookEvent(provider.id, verification.event, payload);

  if (result.status === "failed") {
    // 500 → der Provider stellt erneut zu; die Verarbeitung ist idempotent.
    return NextResponse.json({ status: "failed", error: result.error }, { status: 500 });
  }

  return NextResponse.json({ status: result.status, type: result.type }, { status: 200 });
}
