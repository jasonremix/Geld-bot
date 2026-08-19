import { prisma } from "@/lib/db";
import { guard, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentProvider } from "@/lib/payments";
import { formatZodError, subscriptionActionSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/security/audit";
import { sendMail } from "@/lib/email/mailer";

export const runtime = "nodejs";

/** Kündigung, Kündigung zum Periodenende und Reaktivierung durch den Kunden. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "unauthorized", "Bitte anmelden.");

  const blocked = await guard(request, { limit: "adminWrite", identifier: user.id });
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = subscriptionActionSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Ungültige Anfrage.", formatZodError(parsed.error));
  }

  const subscription = await prisma.subscription.findFirst({
    where: { id: parsed.data.subscriptionId, customer: { userId: user.id } },
    include: { plan: true },
  });
  if (!subscription) return jsonError(404, "not_found", "Abo nicht gefunden.");

  const provider = getPaymentProvider();

  try {
    if (parsed.data.action === "cancel_at_period_end") {
      if (subscription.providerSubscriptionId) {
        await provider.cancelSubscription(subscription.providerSubscriptionId, true);
      }
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
      });
      await sendMail(user.email, "subscription_cancelled", {
        planName: subscription.plan.name,
        accessUntil: subscription.currentPeriodEnd
          ? subscription.currentPeriodEnd.toISOString().slice(0, 10)
          : "Nicht verfügbar",
      });
    } else if (parsed.data.action === "cancel") {
      if (subscription.providerSubscriptionId) {
        await provider.cancelSubscription(subscription.providerSubscriptionId, false);
      }
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELED", canceledAt: new Date(), endedAt: new Date() },
      });
      await sendMail(user.email, "subscription_cancelled", {
        planName: subscription.plan.name,
        accessUntil: new Date().toISOString().slice(0, 10),
      });
    } else {
      if (subscription.status !== "ACTIVE") {
        return jsonError(
          409,
          "not_reactivatable",
          "Dieses Abo ist beendet. Bitte einen neuen Plan wählen.",
        );
      }
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: false, canceledAt: null },
      });
    }
  } catch (error) {
    console.error("subscription_action_failed", (error as Error).message);
    return jsonError(502, "provider_error", "Der Zahlungsanbieter hat die Änderung abgelehnt.");
  }

  await writeAudit({
    actorUserId: user.id,
    action: `subscription.${parsed.data.action}`,
    entity: "Subscription",
    entityId: subscription.id,
    ip: clientIp(request),
  });

  await prisma.analyticsEvent.create({
    data: {
      type: parsed.data.action === "reactivate" ? "subscription_reactivated" : "subscription_cancel_requested",
      userId: user.id,
      planKey: subscription.plan.key,
    },
  });

  return jsonOk({ ok: true });
}
