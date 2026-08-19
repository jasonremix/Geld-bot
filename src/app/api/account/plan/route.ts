import { prisma } from "@/lib/db";
import { guard, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentProvider } from "@/lib/payments";
import { formatZodError, planChangeSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

/**
 * Upgrade / Downgrade eines laufenden Abos.
 *
 * Unterstützt der Provider keinen Planwechsel am laufenden Abo, wird der
 * Kunde zum regulären Checkout geleitet – es wird nichts stillschweigend
 * doppelt abgerechnet.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "unauthorized", "Bitte anmelden.");

  const blocked = await guard(request, { limit: "adminWrite", identifier: user.id });
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = planChangeSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Ungültige Anfrage.", formatZodError(parsed.error));
  }

  const plan = await prisma.plan.findFirst({ where: { key: parsed.data.planKey, active: true } });
  if (!plan) return jsonError(404, "plan_not_found", "Plan nicht verfügbar.");

  const subscription = await prisma.subscription.findFirst({
    where: { customer: { userId: user.id }, status: { in: ["ACTIVE", "GRACE", "PAST_DUE"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return jsonOk({ ok: true, redirect: `/checkout?plan=${plan.key}`, reason: "no_active_subscription" });
  }

  if (subscription.planId === plan.id) {
    return jsonError(409, "already_on_plan", "Dieser Plan ist bereits aktiv.");
  }

  const provider = getPaymentProvider();

  if (!provider.changeSubscriptionPlan || !subscription.providerSubscriptionId) {
    return jsonOk({
      ok: true,
      redirect: `/checkout?plan=${plan.key}`,
      reason: "provider_requires_new_checkout",
    });
  }

  try {
    await provider.changeSubscriptionPlan({
      subscriptionId: subscription.providerSubscriptionId,
      providerPriceId: plan.providerPriceId,
      amountCents: plan.priceCents,
      currency: plan.currency,
      planName: plan.name,
    });
  } catch (error) {
    console.error("plan_change_failed", (error as Error).message);
    return jsonError(502, "provider_error", "Der Planwechsel wurde vom Zahlungsanbieter abgelehnt.");
  }

  // Lokale Übernahme; die endgültige Bestätigung liefert der Webhook.
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { planId: plan.id },
  });

  await writeAudit({
    actorUserId: user.id,
    action: plan.tier > subscription.plan.tier ? "subscription.upgrade" : "subscription.downgrade",
    entity: "Subscription",
    entityId: subscription.id,
    ip: clientIp(request),
    meta: { from: subscription.plan.key, to: plan.key },
  });

  return jsonOk({ ok: true, planKey: plan.key });
}
