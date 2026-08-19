import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db";
import { getEnv } from "../env";
import { createPasswordResetToken } from "../auth/tokens";
import { hashPassword } from "../auth/password";
import { createInvoiceForOrder } from "../invoices";
import { sendMail } from "../email/mailer";
import { formatMoney } from "../money";
import { writeAudit } from "../security/audit";
import type { NormalizedWebhookEvent } from "../payments/types";

/**
 * Zentrale, idempotente Webhook-Verarbeitung.
 *
 * Ablauf:
 *  1. Event anhand von (provider, eventId) registrieren.
 *     Existiert es bereits als PROCESSED/IGNORED, wird es übersprungen.
 *  2. Fachliche Verarbeitung je Event-Typ.
 *  3. Ergebnis am Event-Datensatz festhalten (PROCESSED / FAILED).
 *
 * Eine Bestellung gilt ausschliesslich über diesen Weg als bezahlt – niemals
 * über eine clientseitige Erfolgsseite.
 */

export type ProcessResult =
  | { status: "processed"; type: string; detail?: string }
  | { status: "duplicate"; type: string }
  | { status: "ignored"; type: string; reason: string }
  | { status: "failed"; type: string; error: string };

export async function processWebhookEvent(
  provider: string,
  event: NormalizedWebhookEvent,
  rawPayload: string,
): Promise<ProcessResult> {
  const payloadHash = createHash("sha256").update(rawPayload).digest("hex");

  // --- Schritt 1: Idempotenz ------------------------------------------------
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider, eventId: event.id } },
  });

  if (existing && (existing.status === "PROCESSED" || existing.status === "IGNORED")) {
    return { status: "duplicate", type: event.type };
  }

  const record = existing
    ? await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: { attempts: { increment: 1 }, status: "RECEIVED", error: null },
      })
    : await prisma.webhookEvent.create({
        data: {
          provider,
          eventId: event.id,
          type: event.providerEventType,
          payloadHash,
          attempts: 1,
          status: "RECEIVED",
        },
      });

  // --- Schritt 2: Verarbeitung ---------------------------------------------
  try {
    const result = await dispatch(provider, event);

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: {
        status: result.status === "ignored" ? "IGNORED" : "PROCESSED",
        processedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: "FAILED", error: message },
    });
    return { status: "failed", type: event.type, error: message };
  }
}

async function dispatch(provider: string, event: NormalizedWebhookEvent): Promise<ProcessResult> {
  switch (event.type) {
    case "payment_succeeded":
      return handlePaymentSucceeded(provider, event);
    case "payment_failed":
      return handlePaymentFailed(provider, event);
    case "subscription_created":
    case "subscription_updated":
      return handleSubscriptionUpsert(provider, event);
    case "subscription_cancelled":
      return handleSubscriptionCancelled(event);
    case "refund_created":
      return handleRefund(event);
    case "chargeback_created":
      return handleChargeback(event);
    case "payout_created":
    case "payout_completed":
    case "payout_failed":
      return handlePayout(provider, event);
    default:
      return { status: "ignored", type: event.type, reason: "event_type_not_relevant" };
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

async function findOrder(event: NormalizedWebhookEvent) {
  const { orderReference, orderId, paymentId } = event.data;

  if (orderReference) {
    const byNumber = await prisma.order.findUnique({
      where: { number: orderReference },
      include: { plan: true, customer: true },
    });
    if (byNumber) return byNumber;
  }
  if (orderId) {
    const byId = await prisma.order.findUnique({
      where: { id: orderId },
      include: { plan: true, customer: true },
    });
    if (byId) return byId;
  }
  if (paymentId) {
    const bySession = await prisma.order.findFirst({
      where: { OR: [{ providerSessionId: paymentId }, { payments: { some: { providerPaymentId: paymentId } } }] },
      include: { plan: true, customer: true },
    });
    if (bySession) return bySession;
  }
  return null;
}

/** Legt bei Bedarf User + Customer an (automatische Kontoerstellung nach Kauf). */
async function ensureCustomer(email: string, providerCustomerRef?: string | null) {
  const normalized = email.toLowerCase().trim();

  let user = await prisma.user.findUnique({ where: { email: normalized }, include: { customer: true } });
  let created = false;

  if (!user) {
    // Zufälliges Passwort: der Kunde setzt es über den Einladungslink selbst.
    const placeholder = await hashPassword(randomBytes(32).toString("base64url"));
    user = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash: placeholder,
        role: "CUSTOMER",
        customer: { create: { email: normalized, providerCustomerId: providerCustomerRef ?? null } },
      },
      include: { customer: true },
    });
    created = true;
  }

  let customer = user.customer;
  if (!customer) {
    customer = await prisma.customer.create({
      data: { userId: user.id, email: normalized, providerCustomerId: providerCustomerRef ?? null },
    });
  } else if (providerCustomerRef && !customer.providerCustomerId) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { providerCustomerId: providerCustomerRef },
    });
  }

  return { user, customer, created };
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

// ---------------------------------------------------------------------------
// Event-Handler
// ---------------------------------------------------------------------------

async function handlePaymentSucceeded(
  provider: string,
  event: NormalizedWebhookEvent,
): Promise<ProcessResult> {
  const env = getEnv();
  const order = await findOrder(event);

  if (!order) {
    return { status: "ignored", type: event.type, reason: "order_not_found" };
  }

  const email = order.email || event.data.email || "";
  if (!email) return { status: "ignored", type: event.type, reason: "email_missing" };

  const { user, customer, created } = await ensureCustomer(email, event.data.customerRef);

  const plan =
    (order.planId ? order.plan : null) ??
    (event.data.planKey ? await prisma.plan.findUnique({ where: { key: event.data.planKey } }) : null);

  const amountCents = event.data.amountCents ?? order.totalCents;
  const currency = event.data.currency ?? order.currency;
  const periodStart = event.data.currentPeriodStart ?? new Date();
  const periodEnd = event.data.currentPeriodEnd ?? addMonths(periodStart, 1);

  const alreadyPaid = order.status === "PAID";

  // --- Zahlung (idempotent über providerPaymentId) --------------------------
  const providerPaymentId = event.data.paymentId ?? `${provider}_${event.id}`;
  const payment = await prisma.payment.upsert({
    where: { providerPaymentId },
    create: {
      orderId: order.id,
      provider,
      providerPaymentId,
      status: "SUCCEEDED",
      amountCents,
      currency,
      description: plan ? `Abo: ${plan.name}` : "Zahlung",
      paidAt: new Date(),
    },
    update: { status: "SUCCEEDED", paidAt: new Date(), orderId: order.id },
  });

  // --- Abonnement -----------------------------------------------------------
  let subscriptionId: string | null = order.subscriptionId;
  if (plan) {
    const providerSubscriptionId = event.data.subscriptionId ?? null;

    const existing = providerSubscriptionId
      ? await prisma.subscription.findUnique({ where: { providerSubscriptionId } })
      : await prisma.subscription.findFirst({
          where: { customerId: customer.id, planId: plan.id, status: { in: ["ACTIVE", "GRACE", "PAST_DUE", "INCOMPLETE"] } },
          orderBy: { createdAt: "desc" },
        });

    const subscription = existing
      ? await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            planId: plan.id,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            gracePeriodEndsAt: null,
            failedPaymentCount: 0,
            endedAt: null,
            ...(providerSubscriptionId ? { providerSubscriptionId } : {}),
          },
        })
      : await prisma.subscription.create({
          data: {
            customerId: customer.id,
            planId: plan.id,
            status: "ACTIVE",
            provider,
            providerSubscriptionId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
        });

    subscriptionId = subscription.id;
    await prisma.payment.update({ where: { id: payment.id }, data: { subscriptionId } });
  }

  // --- Bestellung -----------------------------------------------------------
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: order.paidAt ?? new Date(),
      customerId: customer.id,
      subscriptionId,
      totalCents: amountCents,
      subtotalCents: amountCents,
      currency,
    },
  });

  if (alreadyPaid) {
    // Erneute Zustellung desselben Zahlungsereignisses – Zustand bleibt gleich.
    return { status: "processed", type: event.type, detail: "order_already_paid" };
  }

  const invoice = await createInvoiceForOrder(order.id);

  await prisma.analyticsEvent.create({
    data: {
      type: "purchase",
      userId: user.id,
      planKey: plan?.key ?? null,
      valueCents: amountCents,
      meta: { orderNumber: order.number, provider },
    },
  });

  await writeAudit({
    action: "order.paid",
    entity: "Order",
    entityId: order.id,
    meta: { provider, eventId: event.id, amountCents, currency },
  });

  // --- Benachrichtigungen ---------------------------------------------------
  const money = formatMoney(amountCents, currency);
  if (created) {
    const token = await createPasswordResetToken(user.id, 60 * 24 * 7);
    await sendMail(user.email, "registration", { name: user.name });
    await sendMail(user.email, "password_reset", {
      resetUrl: `${env.APP_URL}/reset-password?token=${token}`,
    });
  }
  await sendMail(user.email, "purchase_success", {
    planName: plan?.name ?? "Plan",
    orderNumber: order.number,
    amount: money,
  });
  await sendMail(user.email, "access_granted", { planName: plan?.name ?? "Plan" });
  await sendMail(user.email, "invoice", { invoiceNumber: invoice.number, amount: money });

  return { status: "processed", type: event.type, detail: order.number };
}

async function handlePaymentFailed(
  provider: string,
  event: NormalizedWebhookEvent,
): Promise<ProcessResult> {
  const env = getEnv();
  const order = await findOrder(event);
  const providerPaymentId = event.data.paymentId ?? `${provider}_${event.id}`;

  await prisma.payment.upsert({
    where: { providerPaymentId },
    create: {
      orderId: order?.id ?? null,
      provider,
      providerPaymentId,
      status: "FAILED",
      amountCents: event.data.amountCents ?? order?.totalCents ?? 0,
      currency: event.data.currency ?? order?.currency ?? "EUR",
      failureReason: event.data.failureReason ?? null,
    },
    update: { status: "FAILED", failureReason: event.data.failureReason ?? null },
  });

  if (order && order.status === "PENDING") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
  }

  // Bestehendes Abo: Kulanzfrist starten bzw. endgültig deaktivieren.
  const subscription = event.data.subscriptionId
    ? await prisma.subscription.findUnique({
        where: { providerSubscriptionId: event.data.subscriptionId },
        include: { plan: true, customer: { include: { user: true } } },
      })
    : order?.subscriptionId
      ? await prisma.subscription.findUnique({
          where: { id: order.subscriptionId },
          include: { plan: true, customer: { include: { user: true } } },
        })
      : null;

  if (subscription) {
    const failures = subscription.failedPaymentCount + 1;
    const graceUntil = new Date(Date.now() + env.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const finalFailure = failures >= 3;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        failedPaymentCount: failures,
        // Nach dem dritten Fehlversuch wird der Zugang automatisch deaktiviert.
        status: finalFailure ? "EXPIRED" : "PAST_DUE",
        gracePeriodEndsAt: finalFailure ? null : graceUntil,
        endedAt: finalFailure ? new Date() : null,
      },
    });

    await sendMail(subscription.customer.user.email, "payment_failed", {
      planName: subscription.plan.name,
      graceUntil: finalFailure ? "abgelaufen" : graceUntil.toISOString().slice(0, 10),
    });

    await writeAudit({
      action: finalFailure ? "subscription.expired" : "subscription.past_due",
      entity: "Subscription",
      entityId: subscription.id,
      meta: { failures, eventId: event.id },
    });
  }

  return { status: "processed", type: event.type };
}

async function handleSubscriptionUpsert(
  provider: string,
  event: NormalizedWebhookEvent,
): Promise<ProcessResult> {
  const providerSubscriptionId = event.data.subscriptionId;
  if (!providerSubscriptionId) {
    return { status: "ignored", type: event.type, reason: "subscription_id_missing" };
  }

  const plan = event.data.planKey
    ? await prisma.plan.findUnique({ where: { key: event.data.planKey } })
    : null;

  const existing = await prisma.subscription.findUnique({
    where: { providerSubscriptionId },
    include: { plan: true },
  });

  const status = mapSubscriptionStatus(event.data.status);

  if (!existing) {
    // Ohne Kunde und Plan lässt sich kein Abo anlegen – der zugehörige
    // Zahlungs-Webhook erledigt das, sobald er eintrifft.
    const email = event.data.email;
    if (!email || !plan) {
      return { status: "ignored", type: event.type, reason: "customer_or_plan_unknown" };
    }
    const { customer } = await ensureCustomer(email, event.data.customerRef);
    await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: plan.id,
        provider,
        providerSubscriptionId,
        status,
        currentPeriodStart: event.data.currentPeriodStart ?? new Date(),
        currentPeriodEnd: event.data.currentPeriodEnd ?? addMonths(new Date(), 1),
        cancelAtPeriodEnd: event.data.cancelAtPeriodEnd ?? false,
      },
    });
    return { status: "processed", type: event.type, detail: "created" };
  }

  const planChanged = plan && plan.id !== existing.planId;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      status,
      ...(plan ? { planId: plan.id } : {}),
      ...(event.data.currentPeriodStart ? { currentPeriodStart: event.data.currentPeriodStart } : {}),
      ...(event.data.currentPeriodEnd ? { currentPeriodEnd: event.data.currentPeriodEnd } : {}),
      ...(event.data.cancelAtPeriodEnd !== null && event.data.cancelAtPeriodEnd !== undefined
        ? { cancelAtPeriodEnd: event.data.cancelAtPeriodEnd }
        : {}),
      ...(status === "ACTIVE" ? { gracePeriodEndsAt: null, failedPaymentCount: 0 } : {}),
    },
  });

  if (planChanged) {
    await writeAudit({
      action: plan.tier > existing.plan.tier ? "subscription.upgraded" : "subscription.downgraded",
      entity: "Subscription",
      entityId: existing.id,
      meta: { from: existing.plan.key, to: plan.key },
    });
  }

  return { status: "processed", type: event.type, detail: planChanged ? "plan_changed" : "updated" };
}

async function handleSubscriptionCancelled(event: NormalizedWebhookEvent): Promise<ProcessResult> {
  const providerSubscriptionId = event.data.subscriptionId;
  if (!providerSubscriptionId) {
    return { status: "ignored", type: event.type, reason: "subscription_id_missing" };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { providerSubscriptionId },
    include: { plan: true, customer: { include: { user: true } } },
  });
  if (!subscription) return { status: "ignored", type: event.type, reason: "subscription_unknown" };

  if (subscription.status === "CANCELED") {
    return { status: "processed", type: event.type, detail: "already_cancelled" };
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      endedAt: subscription.currentPeriodEnd ?? new Date(),
      cancelAtPeriodEnd: false,
    },
  });

  await sendMail(subscription.customer.user.email, "subscription_cancelled", {
    planName: subscription.plan.name,
    accessUntil: subscription.currentPeriodEnd
      ? subscription.currentPeriodEnd.toISOString().slice(0, 10)
      : "Nicht verfügbar",
  });

  await prisma.analyticsEvent.create({
    data: {
      type: "subscription_cancelled",
      userId: subscription.customer.userId,
      planKey: subscription.plan.key,
    },
  });

  return { status: "processed", type: event.type };
}

async function handleRefund(event: NormalizedWebhookEvent): Promise<ProcessResult> {
  const paymentId = event.data.paymentId;
  if (!paymentId) return { status: "ignored", type: event.type, reason: "payment_id_missing" };

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: paymentId },
    include: { order: true },
  });
  if (!payment) return { status: "ignored", type: event.type, reason: "payment_unknown" };

  const refunded = Math.min(
    payment.amountCents,
    event.data.refundedCents ?? event.data.amountCents ?? payment.amountCents,
  );
  const full = refunded >= payment.amountCents;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { refundedCents: refunded, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
  });

  if (payment.orderId) {
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { refundedCents: refunded, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
  }

  // Bei vollständiger Erstattung endet der Zugang sofort.
  if (full && payment.subscriptionId) {
    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: "CANCELED", canceledAt: new Date(), endedAt: new Date() },
    });
  }

  await writeAudit({
    action: "payment.refunded",
    entity: "Payment",
    entityId: payment.id,
    meta: { refunded, full, eventId: event.id },
  });

  return { status: "processed", type: event.type };
}

async function handleChargeback(event: NormalizedWebhookEvent): Promise<ProcessResult> {
  const paymentId = event.data.paymentId;
  if (!paymentId) return { status: "ignored", type: event.type, reason: "payment_id_missing" };

  const payment = await prisma.payment.findUnique({ where: { providerPaymentId: paymentId } });
  if (!payment) return { status: "ignored", type: event.type, reason: "payment_unknown" };

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "CHARGEBACK" } });

  // Zugang wird sofort deaktiviert; der Fall wird im Audit-Log dokumentiert.
  if (payment.subscriptionId) {
    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: "CANCELED", canceledAt: new Date(), endedAt: new Date() },
    });
  }

  await writeAudit({
    action: "payment.chargeback",
    entity: "Payment",
    entityId: payment.id,
    meta: { eventId: event.id },
  });

  return { status: "processed", type: event.type };
}

async function handlePayout(
  provider: string,
  event: NormalizedWebhookEvent,
): Promise<ProcessResult> {
  const payoutId = event.data.payoutId ?? event.data.paymentId;
  if (!payoutId) return { status: "ignored", type: event.type, reason: "payout_id_missing" };

  const status =
    event.type === "payout_completed" ? "COMPLETED" : event.type === "payout_failed" ? "FAILED" : "PENDING";

  await prisma.payout.upsert({
    where: { providerPayoutId: payoutId },
    create: {
      provider,
      providerPayoutId: payoutId,
      status,
      amountCents: event.data.amountCents ?? 0,
      currency: event.data.currency ?? "EUR",
      // Nur der vom Provider gelieferte maskierte Hinweis – niemals eine IBAN.
      destinationHint: event.data.destinationHint ?? null,
      initiatedAt: event.createdAt,
      arrivalAt: event.data.arrivalAt ?? null,
      failureReason: event.type === "payout_failed" ? (event.data.failureReason ?? null) : null,
    },
    update: {
      status,
      ...(event.data.amountCents ? { amountCents: event.data.amountCents } : {}),
      ...(event.data.arrivalAt ? { arrivalAt: event.data.arrivalAt } : {}),
      ...(event.type === "payout_failed" ? { failureReason: event.data.failureReason ?? null } : {}),
    },
  });

  return { status: "processed", type: event.type };
}

function mapSubscriptionStatus(
  raw: string | null | undefined,
): "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "GRACE" | "CANCELED" | "EXPIRED" {
  switch ((raw ?? "").toLowerCase()) {
    case "active":
    case "trialing":
    case "completed":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "cancelled":
      return "CANCELED";
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE";
    case "paused":
      return "GRACE";
    default:
      return "ACTIVE";
  }
}
