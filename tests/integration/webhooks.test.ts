import { beforeEach, describe, expect, it } from "vitest";
import { db, createPendingOrderFor, resetDatabase } from "../helpers/db";
import { makeEvent } from "../helpers/events";
import { processWebhookEvent } from "../../src/lib/webhooks/process";
import { SandboxPaymentProvider, signSandboxPayload } from "../../src/lib/payments/sandbox";

const SECRET = process.env.PAYMENT_WEBHOOK_SECRET!;

describe("Webhook: Signaturprüfung im Adapter", () => {
  const provider = new SandboxPaymentProvider();

  it("verifiziert eine korrekt signierte Nutzlast", async () => {
    const payload = JSON.stringify({
      id: "evt_signed_1",
      type: "payment_succeeded",
      created: new Date().toISOString(),
      data: { orderReference: "GB-TEST-1", paymentId: "pay_1" },
    });

    const result = await provider.verifyWebhook({
      payload,
      headers: new Headers({ "x-sandbox-signature": signSandboxPayload(payload, SECRET) }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.id).toBe("evt_signed_1");
      expect(result.event.type).toBe("payment_succeeded");
      expect(result.event.data.orderReference).toBe("GB-TEST-1");
    }
  });

  it("weist eine unsignierte Nutzlast zurück", async () => {
    const result = await provider.verifyWebhook({
      payload: JSON.stringify({ id: "evt_x", type: "payment_succeeded" }),
      headers: new Headers(),
    });
    expect(result).toEqual({ ok: false, reason: "signature_missing" });
  });

  it("weist eine nach dem Signieren veränderte Nutzlast zurück", async () => {
    const payload = JSON.stringify({ id: "evt_1", type: "payment_succeeded", data: {} });
    const signature = signSandboxPayload(payload, SECRET);

    const result = await provider.verifyWebhook({
      payload: JSON.stringify({ id: "evt_1", type: "payment_succeeded", data: { hacked: true } }),
      headers: new Headers({ "x-sandbox-signature": signature }),
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });
});

describe("Webhook: erfolgreiche Zahlung", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("markiert die Bestellung als bezahlt, legt Account, Abo und Rechnung an", async () => {
    const order = await createPendingOrderFor("pro", "neu@example.test");

    const event = makeEvent("payment_succeeded", {
      orderReference: order.number,
      paymentId: "pay_success_1",
      subscriptionId: "sub_1",
      email: "neu@example.test",
      planKey: "pro",
      amountCents: 1999,
      currency: "EUR",
    });

    const result = await processWebhookEvent("sandbox", event, JSON.stringify(event));
    expect(result.status).toBe("processed");

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("PAID");
    expect(updated.paidAt).not.toBeNull();

    // Automatisch erstellter Account
    const user = await db.user.findUniqueOrThrow({
      where: { email: "neu@example.test" },
      include: { customer: true },
    });
    expect(user.customer).not.toBeNull();

    // Aktives Abo mit passendem Plan
    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_1" },
      include: { plan: true },
    });
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.plan.key).toBe("pro");
    expect(subscription.currentPeriodEnd).not.toBeNull();

    // Zahlung, Rechnung, Analytics
    const payment = await db.payment.findUniqueOrThrow({ where: { providerPaymentId: "pay_success_1" } });
    expect(payment.status).toBe("SUCCEEDED");

    const invoice = await db.invoice.findFirstOrThrow({ where: { orderId: order.id } });
    expect(invoice.totalCents).toBe(1999);
    // 19 % Steuersatz aus der Testkonfiguration
    expect(invoice.netCents + invoice.taxCents).toBe(1999);

    const purchase = await db.analyticsEvent.count({ where: { type: "purchase" } });
    expect(purchase).toBe(1);

    // Der neue Kunde erhält Registrierungs- und Passwortmail
    const mails = await db.emailMessage.findMany({ where: { to: "neu@example.test" } });
    expect(mails.map((m) => m.template)).toEqual(
      expect.arrayContaining(["registration", "password_reset", "purchase_success", "access_granted", "invoice"]),
    );
  });

  it("verarbeitet dasselbe Event nur einmal (Idempotenz)", async () => {
    const order = await createPendingOrderFor("starter", "doppelt@example.test");
    const event = makeEvent(
      "payment_succeeded",
      {
        orderReference: order.number,
        paymentId: "pay_dup",
        subscriptionId: "sub_dup",
        email: "doppelt@example.test",
        planKey: "starter",
        amountCents: 999,
        currency: "EUR",
      },
      "evt_duplicate",
    );

    const first = await processWebhookEvent("sandbox", event, JSON.stringify(event));
    const second = await processWebhookEvent("sandbox", event, JSON.stringify(event));
    const third = await processWebhookEvent("sandbox", event, JSON.stringify(event));

    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");
    expect(third.status).toBe("duplicate");

    expect(await db.invoice.count()).toBe(1);
    expect(await db.payment.count()).toBe(1);
    expect(await db.subscription.count()).toBe(1);
    expect(await db.webhookEvent.count()).toBe(1);
  });

  it("erzeugt bei erneuter Zustellung mit neuer Event-ID keine zweite Rechnung", async () => {
    const order = await createPendingOrderFor("pro", "retry@example.test");
    const data = {
      orderReference: order.number,
      paymentId: "pay_retry",
      subscriptionId: "sub_retry",
      email: "retry@example.test",
      planKey: "pro",
      amountCents: 1999,
      currency: "EUR",
    };

    await processWebhookEvent("sandbox", makeEvent("payment_succeeded", data, "evt_a"), "{}");
    const again = await processWebhookEvent("sandbox", makeEvent("payment_succeeded", data, "evt_b"), "{}");

    expect(again.status).toBe("processed");
    expect(await db.invoice.count()).toBe(1);
    expect(await db.order.count({ where: { status: "PAID" } })).toBe(1);
  });

  it("ignoriert Events zu unbekannten Bestellungen", async () => {
    const event = makeEvent("payment_succeeded", {
      orderReference: "GB-UNBEKANNT",
      paymentId: "pay_unknown",
    });

    const result = await processWebhookEvent("sandbox", event, "{}");
    expect(result).toMatchObject({ status: "ignored", reason: "order_not_found" });
    expect(await db.order.count()).toBe(0);
  });
});

describe("Webhook: fehlgeschlagene Zahlung", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("setzt Kulanzfrist und deaktiviert nach dem dritten Fehlversuch", async () => {
    const order = await createPendingOrderFor("pro", "fail@example.test");
    const paid = makeEvent("payment_succeeded", {
      orderReference: order.number,
      paymentId: "pay_ok",
      subscriptionId: "sub_fail",
      email: "fail@example.test",
      planKey: "pro",
      amountCents: 1999,
      currency: "EUR",
    });
    await processWebhookEvent("sandbox", paid, "{}");

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const failed = makeEvent("payment_failed", {
        subscriptionId: "sub_fail",
        paymentId: `pay_fail_${attempt}`,
        failureReason: "card_declined",
        amountCents: 1999,
        currency: "EUR",
      });
      await processWebhookEvent("sandbox", failed, "{}");

      const subscription = await db.subscription.findUniqueOrThrow({
        where: { providerSubscriptionId: "sub_fail" },
      });
      expect(subscription.status).toBe("PAST_DUE");
      expect(subscription.gracePeriodEndsAt).not.toBeNull();
      expect(subscription.failedPaymentCount).toBe(attempt);
    }

    await processWebhookEvent(
      "sandbox",
      makeEvent("payment_failed", {
        subscriptionId: "sub_fail",
        paymentId: "pay_fail_3",
        failureReason: "card_declined",
      }),
      "{}",
    );

    const finalState = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_fail" },
    });
    expect(finalState.status).toBe("EXPIRED");
    expect(finalState.gracePeriodEndsAt).toBeNull();
    expect(finalState.endedAt).not.toBeNull();

    const mails = await db.emailMessage.count({
      where: { to: "fail@example.test", template: "payment_failed" },
    });
    expect(mails).toBe(3);
  });

  it("markiert eine offene Bestellung als fehlgeschlagen", async () => {
    const order = await createPendingOrderFor("starter", "abbruch@example.test");
    await processWebhookEvent(
      "sandbox",
      makeEvent("payment_failed", {
        orderReference: order.number,
        paymentId: "pay_declined",
        failureReason: "insufficient_funds",
      }),
      "{}",
    );

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("FAILED");
    expect(await db.invoice.count()).toBe(0);
  });
});
