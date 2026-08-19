import { beforeEach, describe, expect, it } from "vitest";
import { db, createPendingOrderFor, resetDatabase } from "../helpers/db";
import { makeEvent } from "../helpers/events";
import { processWebhookEvent } from "../../src/lib/webhooks/process";
import { SandboxPaymentProvider, sandboxReset } from "../../src/lib/payments/sandbox";

async function paidOrder(email: string, planKey: string, paymentId: string, subscriptionId: string) {
  const order = await createPendingOrderFor(planKey, email);
  await processWebhookEvent(
    "sandbox",
    makeEvent("payment_succeeded", {
      orderReference: order.number,
      paymentId,
      subscriptionId,
      email,
      planKey,
      amountCents: order.totalCents,
      currency: "EUR",
    }),
    "{}",
  );
  return order;
}

describe("Erstattungen", () => {
  beforeEach(async () => {
    await resetDatabase();
    sandboxReset();
  });

  it("löst eine Erstattung beim Provider aus", async () => {
    const provider = new SandboxPaymentProvider();
    const session = await provider.createCheckoutSession({
      orderId: "order_1",
      orderNumber: "GB-TEST-REFUND",
      email: "refund@example.test",
      planKey: "pro",
      planName: "Pro",
      amountCents: 1999,
      currency: "EUR",
      mode: "subscription",
      successUrl: "http://localhost:3111/checkout/success",
      cancelUrl: "http://localhost:3111/checkout/cancelled",
    });

    const paymentId = new URL(session.url).searchParams.get("payment")!;
    const refund = await provider.refundPayment({
      paymentId,
      amountCents: 1999,
      idempotencyKey: "test-key-1",
    });

    expect(refund.status).toBe("succeeded");
    expect(refund.amountCents).toBe(1999);

    const payment = await provider.getPayment(paymentId);
    expect(payment?.status).toBe("refunded");
    expect(payment?.refundedCents).toBe(1999);
  });

  it("setzt bei vollständiger Erstattung Bestellung und Abo zurück", async () => {
    const order = await paidOrder("full@example.test", "pro", "pay_full", "sub_full");

    const result = await processWebhookEvent(
      "sandbox",
      makeEvent("refund_created", {
        paymentId: "pay_full",
        refundedCents: 1999,
        amountCents: 1999,
        currency: "EUR",
      }),
      "{}",
    );
    expect(result.status).toBe("processed");

    const payment = await db.payment.findUniqueOrThrow({ where: { providerPaymentId: "pay_full" } });
    expect(payment.status).toBe("REFUNDED");
    expect(payment.refundedCents).toBe(1999);

    const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("REFUNDED");
    expect(updatedOrder.refundedCents).toBe(1999);

    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_full" },
    });
    expect(subscription.status).toBe("CANCELED");
  });

  it("erfasst eine Teilerstattung ohne den Zugang zu beenden", async () => {
    await paidOrder("part@example.test", "pro", "pay_part", "sub_part");

    await processWebhookEvent(
      "sandbox",
      makeEvent("refund_created", { paymentId: "pay_part", refundedCents: 500, currency: "EUR" }),
      "{}",
    );

    const payment = await db.payment.findUniqueOrThrow({ where: { providerPaymentId: "pay_part" } });
    expect(payment.status).toBe("PARTIALLY_REFUNDED");

    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_part" },
    });
    expect(subscription.status).toBe("ACTIVE");
  });

  it("deaktiviert den Zugang bei einem Chargeback", async () => {
    await paidOrder("charge@example.test", "ultimate", "pay_cb", "sub_cb");

    await processWebhookEvent(
      "sandbox",
      makeEvent("chargeback_created", { paymentId: "pay_cb", amountCents: 3999 }),
      "{}",
    );

    const payment = await db.payment.findUniqueOrThrow({ where: { providerPaymentId: "pay_cb" } });
    expect(payment.status).toBe("CHARGEBACK");

    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_cb" },
    });
    expect(subscription.status).toBe("CANCELED");

    const audit = await db.auditLog.findFirst({ where: { action: "payment.chargeback" } });
    expect(audit).not.toBeNull();
  });
});

describe("Auszahlungen", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("erfindet im Sandbox-Modus keine Auszahlungsdaten", async () => {
    const overview = await new SandboxPaymentProvider().getPayoutStatus();

    expect(overview.available).toBe(false);
    expect(overview.balanceAvailableCents).toBeNull();
    expect(overview.nextPayoutAt).toBeNull();
    expect(overview.payouts).toEqual([]);
    expect(overview.unavailableReason).toBeTruthy();
  });

  it("spiegelt Auszahlungs-Events in die Datenbank", async () => {
    await processWebhookEvent(
      "sandbox",
      makeEvent("payout_created", {
        payoutId: "po_1",
        amountCents: 12_345,
        currency: "EUR",
        destinationHint: "•••• 4242",
      }),
      "{}",
    );

    let payout = await db.payout.findUniqueOrThrow({ where: { providerPayoutId: "po_1" } });
    expect(payout.status).toBe("PENDING");
    expect(payout.amountCents).toBe(12_345);
    // Es wird ausschliesslich der maskierte Hinweis gespeichert.
    expect(payout.destinationHint).toBe("•••• 4242");

    await processWebhookEvent(
      "sandbox",
      makeEvent("payout_completed", { payoutId: "po_1", amountCents: 12_345, currency: "EUR" }),
      "{}",
    );

    payout = await db.payout.findUniqueOrThrow({ where: { providerPayoutId: "po_1" } });
    expect(payout.status).toBe("COMPLETED");
    expect(await db.payout.count()).toBe(1);
  });

  it("erfasst fehlgeschlagene Auszahlungen mit Grund", async () => {
    await processWebhookEvent(
      "sandbox",
      makeEvent("payout_failed", {
        payoutId: "po_2",
        amountCents: 5000,
        currency: "EUR",
        failureReason: "account_closed",
      }),
      "{}",
    );

    const payout = await db.payout.findUniqueOrThrow({ where: { providerPayoutId: "po_2" } });
    expect(payout.status).toBe("FAILED");
    expect(payout.failureReason).toBe("account_closed");
  });
});

describe("Kennzahlen", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("berücksichtigt nur bestätigte Zahlungen", async () => {
    const { getRevenueSummary } = await import("../../src/lib/analytics");

    await createPendingOrderFor("pro", "offen@example.test"); // bleibt PENDING
    await paidOrder("bezahlt@example.test", "pro", "pay_metrics", "sub_metrics");

    const summary = await getRevenueSummary();
    expect(summary.allTime).toBe(1999);
    expect(summary.today).toBe(1999);
    expect(summary.mrrCents).toBe(1999);
  });
});
