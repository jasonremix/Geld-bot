import { prisma } from "@/lib/db";
import { guard, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentProvider } from "@/lib/payments";
import { PaymentProviderError } from "@/lib/payments/types";
import { createPendingOrder } from "@/lib/orders";
import { checkoutSchema, formatZodError } from "@/lib/validation";
import { trackEvent } from "@/lib/analytics";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

/**
 * Startet den Checkout: legt eine Bestellung im Status PENDING an und erzeugt
 * beim Payment Provider eine Checkout-Session.
 *
 * Wichtig: Die Bestellung wird hier NICHT als bezahlt markiert. Das geschieht
 * ausschliesslich im signaturgeprüften Webhook.
 */
export async function POST(request: Request) {
  const blocked = await guard(request, { limit: "checkout" });
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = checkoutSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte Eingaben prüfen.", formatZodError(parsed.error));
  }

  const env = getEnv();
  const plan = await prisma.plan.findFirst({
    where: { key: parsed.data.planKey, active: true },
  });
  if (!plan) return jsonError(404, "plan_not_found", "Dieser Plan ist nicht verfügbar.");

  const user = await getCurrentUser();
  // Angemeldete Kunden kaufen immer auf ihre eigene Adresse.
  const email = user ? user.email : parsed.data.email;
  const customerId = user?.customerId ?? null;

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return jsonError(
      503,
      "provider_not_configured",
      "Der Zahlungsanbieter ist derzeit nicht konfiguriert. Bitte später erneut versuchen.",
    );
  }

  const order = await createPendingOrder({
    planId: plan.id,
    planName: plan.name,
    email,
    customerId,
    amountCents: plan.priceCents,
    currency: plan.currency,
    provider: provider.id,
  });

  try {
    const session = await provider.createCheckoutSession({
      orderId: order.id,
      orderNumber: order.number,
      email,
      planKey: plan.key,
      planName: `Music Creator Hub – ${plan.name}`,
      amountCents: plan.priceCents,
      currency: plan.currency,
      mode: "subscription",
      providerPriceId: plan.providerPriceId,
      successUrl: `${env.APP_URL}/checkout/success?order=${order.number}`,
      cancelUrl: `${env.APP_URL}/checkout/cancelled?order=${order.number}`,
      metadata: { planKey: plan.key },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { providerSessionId: session.id },
    });

    await trackEvent({
      type: "checkout_started",
      userId: user?.id ?? null,
      planKey: plan.key,
      valueCents: plan.priceCents,
      meta: { orderNumber: order.number, provider: provider.id },
    });

    await writeAudit({
      actorUserId: user?.id ?? null,
      action: "checkout.session_created",
      entity: "Order",
      entityId: order.id,
      ip: clientIp(request),
      meta: { provider: provider.id, mode: session.mode, planKey: plan.key },
    });

    return jsonOk({
      ok: true,
      url: session.url,
      orderNumber: order.number,
      sandbox: session.mode === "sandbox",
    });
  } catch (error) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELED" } });

    const message =
      error instanceof PaymentProviderError
        ? "Der Zahlungsanbieter konnte den Checkout nicht starten."
        : "Unerwarteter Fehler beim Start des Checkouts.";
    console.error("checkout_failed", (error as Error).message);
    return jsonError(502, "checkout_failed", message);
  }
}
