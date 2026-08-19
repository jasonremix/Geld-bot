import { beforeEach, describe, expect, it } from "vitest";
import { db, createCustomer, createPendingOrderFor, resetDatabase } from "../helpers/db";
import { makeEvent } from "../helpers/events";
import { processWebhookEvent } from "../../src/lib/webhooks/process";
import { getEntitlement } from "../../src/lib/entitlements";

async function activateSubscription(email: string, planKey: string, subscriptionId: string) {
  const order = await createPendingOrderFor(planKey, email);
  await processWebhookEvent(
    "sandbox",
    makeEvent("payment_succeeded", {
      orderReference: order.number,
      paymentId: `pay_${subscriptionId}`,
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

describe("Abo-Lebenszyklus", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("legt ein Abo über subscription_created an", async () => {
    const result = await processWebhookEvent(
      "sandbox",
      makeEvent("subscription_created", {
        subscriptionId: "sub_created",
        email: "created@example.test",
        planKey: "starter",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      }),
      "{}",
    );

    expect(result.status).toBe("processed");
    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_created" },
      include: { plan: true },
    });
    expect(subscription.plan.key).toBe("starter");
    expect(subscription.status).toBe("ACTIVE");
  });

  it("führt ein Upgrade über subscription_updated durch", async () => {
    await activateSubscription("upgrade@example.test", "starter", "sub_up");

    await processWebhookEvent(
      "sandbox",
      makeEvent("subscription_updated", {
        subscriptionId: "sub_up",
        planKey: "ultimate",
        status: "active",
      }),
      "{}",
    );

    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_up" },
      include: { plan: true },
    });
    expect(subscription.plan.key).toBe("ultimate");

    const user = await db.user.findUniqueOrThrow({ where: { email: "upgrade@example.test" } });
    const entitlement = await getEntitlement(user.id);
    expect(entitlement.tier).toBe(3);

    const audit = await db.auditLog.findFirst({ where: { action: "subscription.upgraded" } });
    expect(audit).not.toBeNull();
  });

  it("führt ein Downgrade durch und protokolliert es", async () => {
    await activateSubscription("downgrade@example.test", "ultimate", "sub_down");

    await processWebhookEvent(
      "sandbox",
      makeEvent("subscription_updated", {
        subscriptionId: "sub_down",
        planKey: "starter",
        status: "active",
      }),
      "{}",
    );

    const audit = await db.auditLog.findFirst({ where: { action: "subscription.downgraded" } });
    expect(audit).not.toBeNull();

    const user = await db.user.findUniqueOrThrow({ where: { email: "downgrade@example.test" } });
    expect((await getEntitlement(user.id)).tier).toBe(1);
  });

  it("beendet den Zugang bei Kündigung", async () => {
    await activateSubscription("cancel@example.test", "pro", "sub_cancel");
    const user = await db.user.findUniqueOrThrow({ where: { email: "cancel@example.test" } });
    expect((await getEntitlement(user.id)).hasAccess).toBe(true);

    const result = await processWebhookEvent(
      "sandbox",
      makeEvent("subscription_cancelled", { subscriptionId: "sub_cancel" }),
      "{}",
    );
    expect(result.status).toBe("processed");

    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_cancel" },
    });
    expect(subscription.status).toBe("CANCELED");
    expect(subscription.canceledAt).not.toBeNull();

    const entitlement = await getEntitlement(user.id);
    expect(entitlement.hasAccess).toBe(false);
    expect(entitlement.tier).toBe(0);

    const mail = await db.emailMessage.findFirst({
      where: { to: "cancel@example.test", template: "subscription_cancelled" },
    });
    expect(mail).not.toBeNull();
  });

  it("verarbeitet eine erneute Kündigung ohne Zustandsänderung", async () => {
    await activateSubscription("cancel2@example.test", "pro", "sub_cancel2");
    await processWebhookEvent(
      "sandbox",
      makeEvent("subscription_cancelled", { subscriptionId: "sub_cancel2" }, "evt_c1"),
      "{}",
    );
    const result = await processWebhookEvent(
      "sandbox",
      makeEvent("subscription_cancelled", { subscriptionId: "sub_cancel2" }, "evt_c2"),
      "{}",
    );
    expect(result).toMatchObject({ status: "processed", detail: "already_cancelled" });
  });

  it("verlängert das Abo bei erneuter Zahlung", async () => {
    await activateSubscription("renew@example.test", "pro", "sub_renew");

    const nextPeriodEnd = new Date(Date.now() + 60 * 86_400_000);
    const order = await createPendingOrderFor("pro", "renew@example.test");
    await processWebhookEvent(
      "sandbox",
      makeEvent("payment_succeeded", {
        orderReference: order.number,
        paymentId: "pay_renew_2",
        subscriptionId: "sub_renew",
        email: "renew@example.test",
        planKey: "pro",
        amountCents: 1999,
        currency: "EUR",
        currentPeriodEnd: nextPeriodEnd,
      }),
      "{}",
    );

    const subscription = await db.subscription.findUniqueOrThrow({
      where: { providerSubscriptionId: "sub_renew" },
    });
    expect(subscription.currentPeriodEnd?.toISOString().slice(0, 10)).toBe(
      nextPeriodEnd.toISOString().slice(0, 10),
    );
    expect(await db.invoice.count()).toBe(2);
  });

  it("gewährt während der Kulanzfrist weiterhin Zugriff", async () => {
    const { user, customer } = await createCustomer("grace@example.test");
    const plan = await db.plan.findUniqueOrThrow({ where: { key: "pro" } });

    await db.subscription.create({
      data: {
        customerId: customer.id,
        planId: plan.id,
        status: "PAST_DUE",
        gracePeriodEndsAt: new Date(Date.now() + 86_400_000),
        currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000),
      },
    });

    const entitlement = await getEntitlement(user.id);
    expect(entitlement.hasAccess).toBe(true);
    expect(entitlement.inGracePeriod).toBe(true);
  });

  it("verweigert Zugriff nach abgelaufener Kulanzfrist", async () => {
    const { user, customer } = await createCustomer("expired@example.test");
    const plan = await db.plan.findUniqueOrThrow({ where: { key: "pro" } });

    await db.subscription.create({
      data: {
        customerId: customer.id,
        planId: plan.id,
        status: "PAST_DUE",
        gracePeriodEndsAt: new Date(Date.now() - 86_400_000),
      },
    });

    expect((await getEntitlement(user.id)).hasAccess).toBe(false);
  });
});
