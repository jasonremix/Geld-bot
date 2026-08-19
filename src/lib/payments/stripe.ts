import "server-only";
import Stripe from "stripe";
import { getEnv } from "../env";
import {
  PaymentProviderError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type NormalizedWebhookEvent,
  type PaymentProvider,
  type PayoutOverview,
  type ProviderPayment,
  type ProviderRefund,
  type RefundInput,
  type VerifyWebhookInput,
  type WebhookEventType,
  type WebhookVerification,
} from "./types";

/**
 * Stripe-Adapter.
 *
 * Der Secret Key wird ausschliesslich serverseitig verwendet und niemals an den
 * Client ausgeliefert oder geloggt. Der Livemode ergibt sich aus dem Schlüssel
 * (`sk_live_…` = live, `sk_test_…` = sandbox).
 */

type Rec = Record<string, unknown>;

const asRec = (value: unknown): Rec => (value && typeof value === "object" ? (value as Rec) : {});
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" ? value : null);
const unix = (value: unknown): Date | null =>
  typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;

/** Referenz auf ein verschachteltes Objekt oder dessen ID. */
function refId(value: unknown): string | null {
  if (typeof value === "string") return value;
  const rec = asRec(value);
  return str(rec.id);
}

const EVENT_MAP: Record<string, WebhookEventType> = {
  "checkout.session.completed": "payment_succeeded",
  "checkout.session.async_payment_succeeded": "payment_succeeded",
  "checkout.session.async_payment_failed": "payment_failed",
  "payment_intent.succeeded": "payment_succeeded",
  "payment_intent.payment_failed": "payment_failed",
  "invoice.paid": "payment_succeeded",
  "invoice.payment_succeeded": "payment_succeeded",
  "invoice.payment_failed": "payment_failed",
  "customer.subscription.created": "subscription_created",
  "customer.subscription.updated": "subscription_updated",
  "customer.subscription.deleted": "subscription_cancelled",
  "charge.refunded": "refund_created",
  "refund.created": "refund_created",
  "charge.dispute.created": "chargeback_created",
  "payout.created": "payout_created",
  "payout.paid": "payout_completed",
  "payout.failed": "payout_failed",
};

export class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe" as const;
  readonly mode: "sandbox" | "live";
  private client: Stripe | null = null;

  constructor() {
    const key = getEnv().PAYMENT_PROVIDER_SECRET;
    this.mode = key.startsWith("sk_live_") ? "live" : "sandbox";
  }

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.PAYMENT_PROVIDER_SECRET && env.PAYMENT_WEBHOOK_SECRET);
  }

  private sdk(): Stripe {
    const key = getEnv().PAYMENT_PROVIDER_SECRET;
    if (!key) {
      throw new PaymentProviderError(
        "PAYMENT_PROVIDER_SECRET ist nicht gesetzt.",
        "provider_not_configured",
        503,
      );
    }
    if (!this.client) {
      this.client = new Stripe(key, {
        // Ohne feste API-Version gilt die im Stripe-Dashboard gepinnte Version.
        maxNetworkRetries: 2,
        timeout: 20_000,
        appInfo: { name: "Geld-bot Music Creator Hub" },
      });
    }
    return this.client;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const stripe = this.sdk();
    const currency = input.currency.toLowerCase();

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = input.providerPriceId
      ? { price: input.providerPriceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: input.amountCents,
            product_data: { name: input.planName },
            ...(input.mode === "subscription"
              ? { recurring: { interval: "month" as const } }
              : {}),
          },
        };

    const metadata: Record<string, string> = {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      planKey: input.planKey,
      ...(input.metadata ?? {}),
    };

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: input.mode,
          line_items: [lineItem],
          customer_email: input.email,
          client_reference_id: input.orderNumber,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata,
          ...(input.mode === "subscription" ? { subscription_data: { metadata } } : {}),
        },
        { idempotencyKey: `checkout_${input.orderId}` },
      );

      if (!session.url) {
        throw new PaymentProviderError("Stripe lieferte keine Checkout-URL.", "no_checkout_url");
      }

      return { id: session.id, url: session.url, provider: this.id, mode: this.mode };
    } catch (error) {
      throw wrap(error, "checkout_failed");
    }
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
    const secret = getEnv().PAYMENT_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: "webhook_secret_missing" };

    const signature = input.headers.get("stripe-signature");
    if (!signature) return { ok: false, reason: "signature_missing" };

    let event: Stripe.Event;
    try {
      event = this.sdk().webhooks.constructEvent(input.payload, signature, secret);
    } catch (error) {
      return { ok: false, reason: `signature_invalid:${(error as Error).name}` };
    }

    return { ok: true, event: normalizeStripeEvent(event) };
  }

  async getPayment(paymentId: string): Promise<ProviderPayment | null> {
    const stripe = this.sdk();
    try {
      if (paymentId.startsWith("pi_")) {
        const intent = await stripe.paymentIntents.retrieve(paymentId, { expand: ["latest_charge"] });
        const charge = asRec(intent.latest_charge);
        const refunded = num(charge.amount_refunded) ?? 0;
        const amount = intent.amount_received || intent.amount;
        return {
          id: intent.id,
          status: mapPaymentStatus(intent.status, refunded, amount),
          amountCents: amount,
          refundedCents: refunded,
          currency: intent.currency.toUpperCase(),
          orderReference: str(asRec(intent.metadata).orderNumber),
          createdAt: unix(intent.created),
          paidAt: intent.status === "succeeded" ? unix(intent.created) : null,
          failureReason: str(asRec(intent.last_payment_error).message),
        };
      }

      const charge = await stripe.charges.retrieve(paymentId);
      return {
        id: charge.id,
        status: mapPaymentStatus(charge.status, charge.amount_refunded, charge.amount),
        amountCents: charge.amount,
        refundedCents: charge.amount_refunded,
        currency: charge.currency.toUpperCase(),
        orderReference: str(asRec(charge.metadata).orderNumber),
        createdAt: unix(charge.created),
        paidAt: charge.paid ? unix(charge.created) : null,
        failureReason: charge.failure_message ?? null,
      };
    } catch (error) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) return null;
      throw wrap(error, "get_payment_failed");
    }
  }

  async refundPayment(input: RefundInput): Promise<ProviderRefund> {
    const stripe = this.sdk();
    try {
      const refund = await stripe.refunds.create(
        {
          ...(input.paymentId.startsWith("pi_")
            ? { payment_intent: input.paymentId }
            : { charge: input.paymentId }),
          ...(input.amountCents ? { amount: input.amountCents } : {}),
          ...(input.reason === "requested_by_customer" ? { reason: "requested_by_customer" } : {}),
        },
        { idempotencyKey: input.idempotencyKey },
      );

      return {
        id: refund.id,
        paymentId: input.paymentId,
        amountCents: refund.amount,
        currency: refund.currency.toUpperCase(),
        status:
          refund.status === "succeeded"
            ? "succeeded"
            : refund.status === "failed" || refund.status === "canceled"
              ? "failed"
              : "pending",
      };
    } catch (error) {
      throw wrap(error, "refund_failed");
    }
  }

  async getPayoutStatus(): Promise<PayoutOverview> {
    if (!this.isConfigured()) {
      return unavailablePayouts("Stripe ist nicht konfiguriert (PAYMENT_PROVIDER_SECRET fehlt).");
    }
    const stripe = this.sdk();
    try {
      const [balance, payouts] = await Promise.all([
        stripe.balance.retrieve(),
        stripe.payouts.list({ limit: 10 }),
      ]);

      const available = balance.available[0];
      const pending = balance.pending[0];
      const list = payouts.data.map((p) => ({
        id: p.id,
        status: mapPayoutStatus(p.status),
        amountCents: p.amount,
        currency: p.currency.toUpperCase(),
        initiatedAt: unix(p.created),
        arrivalAt: unix(p.arrival_date),
        // Nur die vom Provider gelieferte Maskierung – niemals eine volle IBAN.
        destinationHint: str(asRec(p.destination).last4)
          ? `•••• ${str(asRec(p.destination).last4)}`
          : null,
      }));

      return {
        available: true,
        balanceAvailableCents: available?.amount ?? null,
        balancePendingCents: pending?.amount ?? null,
        currency: (available?.currency ?? pending?.currency ?? null)?.toUpperCase() ?? null,
        nextPayoutAt: list.find((p) => p.status === "pending" || p.status === "in_transit")?.arrivalAt ?? null,
        payouts: list,
      };
    } catch (error) {
      return unavailablePayouts(
        `Stripe-Auszahlungsdaten konnten nicht geladen werden: ${(error as Error).message}`,
      );
    }
  }

  async changeSubscriptionPlan(input: {
    subscriptionId: string;
    providerPriceId: string | null;
    amountCents: number;
    currency: string;
    planName: string;
  }): Promise<void> {
    const stripe = this.sdk();
    if (!input.providerPriceId) {
      throw new PaymentProviderError(
        "Für den Planwechsel muss im Admin-Bereich eine Provider-Preis-ID (Stripe price id) hinterlegt sein.",
        "price_id_missing",
        400,
      );
    }
    try {
      const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
      const currentItem = subscription.items.data[0];
      if (!currentItem) {
        throw new PaymentProviderError("Abo enthält keine Position.", "subscription_empty", 400);
      }
      await stripe.subscriptions.update(input.subscriptionId, {
        items: [{ id: currentItem.id, price: input.providerPriceId }],
        // Anteilige Verrechnung des Restzeitraums.
        proration_behavior: "create_prorations",
      });
    } catch (error) {
      throw wrap(error, "change_plan_failed");
    }
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<void> {
    const stripe = this.sdk();
    try {
      if (atPeriodEnd) {
        await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      } else {
        await stripe.subscriptions.cancel(subscriptionId);
      }
    } catch (error) {
      throw wrap(error, "cancel_subscription_failed");
    }
  }
}

function unavailablePayouts(reason: string): PayoutOverview {
  return {
    available: false,
    unavailableReason: reason,
    balanceAvailableCents: null,
    balancePendingCents: null,
    currency: null,
    nextPayoutAt: null,
    payouts: [],
  };
}

function mapPaymentStatus(
  status: string,
  refunded: number,
  amount: number,
): ProviderPayment["status"] {
  if (refunded > 0) return refunded >= amount ? "refunded" : "partially_refunded";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "pending";
}

function mapPayoutStatus(status: string): PayoutOverview["payouts"][number]["status"] {
  switch (status) {
    case "paid":
      return "completed";
    case "in_transit":
      return "in_transit";
    case "pending":
      return "pending";
    case "failed":
    case "canceled":
      return "failed";
    default:
      return "unknown";
  }
}

function wrap(error: unknown, code: string): PaymentProviderError {
  const message = error instanceof Error ? error.message : "Unbekannter Provider-Fehler";
  return new PaymentProviderError(message, code);
}

/** Übersetzt ein Stripe-Event in das interne, provider-neutrale Format. */
export function normalizeStripeEvent(event: Stripe.Event): NormalizedWebhookEvent {
  const object = asRec((event.data as unknown as Rec).object);
  const metadata = asRec(object.metadata);
  const type = EVENT_MAP[event.type] ?? "unknown";

  // Stripe legt die Subscription je nach API-Version direkt oder unter `parent` ab.
  const invoiceParent = asRec(asRec(object.parent).subscription_details);
  const subscriptionId =
    refId(object.subscription) ??
    refId(invoiceParent.subscription) ??
    (event.type.startsWith("customer.subscription.") ? str(object.id) : null);

  // Ab neueren API-Versionen liegen die Periodenfelder am Subscription-Item.
  const itemsData = asRec(object.items).data;
  const firstItem = asRec(Array.isArray(itemsData) ? itemsData[0] : null);

  return {
    id: event.id,
    type,
    providerEventType: event.type,
    createdAt: unix(event.created) ?? new Date(),
    data: {
      orderReference: str(metadata.orderNumber) ?? str(object.client_reference_id),
      orderId: str(metadata.orderId),
      paymentId:
        refId(object.payment_intent) ??
        (event.type.startsWith("payment_intent.") || event.type.startsWith("charge.")
          ? str(object.id)
          : null),
      subscriptionId,
      customerRef: refId(object.customer),
      email:
        str(object.customer_email) ??
        str(asRec(object.customer_details).email) ??
        str(object.customer_email_address),
      planKey: str(metadata.planKey),
      amountCents:
        num(object.amount_total) ??
        num(object.amount_paid) ??
        num(object.amount_received) ??
        num(object.amount) ??
        null,
      currency: str(object.currency)?.toUpperCase() ?? null,
      status: str(object.status) ?? str(object.payment_status),
      failureReason:
        str(asRec(object.last_payment_error).message) ?? str(object.failure_message) ?? null,
      currentPeriodStart:
        unix(object.current_period_start) ?? unix(firstItem.current_period_start),
      currentPeriodEnd: unix(object.current_period_end) ?? unix(firstItem.current_period_end),
      cancelAtPeriodEnd:
        typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : null,
      refundedCents: num(object.amount_refunded),
      payoutId: event.type.startsWith("payout.") ? str(object.id) : null,
      destinationHint: str(asRec(object.destination).last4)
        ? `•••• ${str(asRec(object.destination).last4)}`
        : null,
      arrivalAt: unix(object.arrival_date),
    },
  };
}
