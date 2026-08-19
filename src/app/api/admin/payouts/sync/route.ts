import { prisma } from "@/lib/db";
import { adminApi } from "@/lib/api-guard";
import { clientIp, jsonOk } from "@/lib/http";
import { getPaymentProvider } from "@/lib/payments";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

/**
 * Holt die Auszahlungsdaten beim Provider ab und spiegelt sie lokal.
 * Liefert der Provider keine Daten, wird nichts gespeichert und der Grund
 * unverändert weitergereicht – es werden keine Werte erfunden.
 */
export async function POST(request: Request) {
  const auth = await adminApi(request, "payouts:read");
  if (!auth.ok) return auth.response;

  const provider = getPaymentProvider();
  const overview = await provider.getPayoutStatus();

  if (!overview.available) {
    return jsonOk({
      ok: true,
      available: false,
      reason: overview.unavailableReason ?? "Keine Auszahlungsdaten verfügbar.",
      synced: 0,
    });
  }

  let synced = 0;
  for (const payout of overview.payouts) {
    await prisma.payout.upsert({
      where: { providerPayoutId: payout.id },
      create: {
        provider: provider.id,
        providerPayoutId: payout.id,
        status: payout.status.toUpperCase() as
          | "PENDING"
          | "IN_TRANSIT"
          | "COMPLETED"
          | "FAILED"
          | "UNKNOWN",
        amountCents: payout.amountCents ?? 0,
        currency: payout.currency ?? "EUR",
        destinationHint: payout.destinationHint,
        initiatedAt: payout.initiatedAt,
        arrivalAt: payout.arrivalAt,
      },
      update: {
        status: payout.status.toUpperCase() as
          | "PENDING"
          | "IN_TRANSIT"
          | "COMPLETED"
          | "FAILED"
          | "UNKNOWN",
        ...(payout.amountCents !== null ? { amountCents: payout.amountCents } : {}),
        ...(payout.arrivalAt ? { arrivalAt: payout.arrivalAt } : {}),
      },
    });
    synced += 1;
  }

  await writeAudit({
    actorUserId: auth.user.id,
    action: "payouts.synced",
    ip: clientIp(request),
    meta: { provider: provider.id, synced },
  });

  return jsonOk({ ok: true, available: true, synced });
}
