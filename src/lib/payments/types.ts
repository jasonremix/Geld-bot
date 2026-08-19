/**
 * Provider-neutrale Zahlungsschnittstelle.
 *
 * Jede Integration (Sandbox, Stripe, Revolut Merchant) implementiert dieses
 * Interface. Die Anwendung kennt ausschliesslich diese Typen – Provider-Details
 * bleiben im jeweiligen Adapter.
 */

export type PaymentProviderId = "sandbox" | "stripe" | "revolut";

export type ProviderMode = "sandbox" | "live";

export type CheckoutMode = "subscription" | "payment";

export type CreateCheckoutInput = {
  /** Interne Bestellnummer – wird als Referenz beim Provider mitgegeben. */
  orderNumber: string;
  orderId: string;
  email: string;
  planKey: string;
  planName: string;
  amountCents: number;
  currency: string;
  mode: CheckoutMode;
  /** Preis-ID beim Provider, falls dort gepflegt (z.B. Stripe price id). */
  providerPriceId?: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Zusätzliche, nicht sensible Metadaten. */
  metadata?: Record<string, string>;
};

export type CheckoutSession = {
  /** Session-/Order-ID beim Provider. */
  id: string;
  /** URL, auf die der Kunde weitergeleitet wird. */
  url: string;
  provider: PaymentProviderId;
  mode: ProviderMode;
};

export type ProviderPaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "chargeback";

export type ProviderPayment = {
  id: string;
  status: ProviderPaymentStatus;
  amountCents: number;
  refundedCents: number;
  currency: string;
  orderReference?: string | null;
  createdAt?: Date | null;
  paidAt?: Date | null;
  failureReason?: string | null;
};

export type RefundInput = {
  paymentId: string;
  amountCents?: number;
  reason?: string;
  /** Idempotency-Key, damit ein wiederholter Aufruf keine zweite Gutschrift auslöst. */
  idempotencyKey: string;
};

export type ProviderRefund = {
  id: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed";
};

export type PayoutInfo = {
  id: string;
  status: "pending" | "in_transit" | "completed" | "failed" | "unknown";
  amountCents: number | null;
  currency: string | null;
  initiatedAt: Date | null;
  arrivalAt: Date | null;
  /** Maskierter Hinweis auf das Zielkonto. Niemals eine vollständige IBAN. */
  destinationHint: string | null;
};

export type PayoutOverview = {
  /** true, wenn der Provider echte Auszahlungsdaten geliefert hat. */
  available: boolean;
  /** Grund, falls keine Daten verfügbar sind (z.B. fehlende Credentials). */
  unavailableReason?: string;
  balanceAvailableCents: number | null;
  balancePendingCents: number | null;
  currency: string | null;
  nextPayoutAt: Date | null;
  payouts: PayoutInfo[];
};

/** Vereinheitlichte Webhook-Ereignistypen. */
export type WebhookEventType =
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_created"
  | "subscription_updated"
  | "subscription_cancelled"
  | "refund_created"
  | "chargeback_created"
  | "payout_created"
  | "payout_completed"
  | "payout_failed"
  | "unknown";

export type NormalizedWebhookEvent = {
  /** Eindeutige Event-ID des Providers – Basis der Idempotenz. */
  id: string;
  type: WebhookEventType;
  providerEventType: string;
  createdAt: Date;
  data: {
    orderReference?: string | null;
    orderId?: string | null;
    paymentId?: string | null;
    subscriptionId?: string | null;
    customerRef?: string | null;
    email?: string | null;
    planKey?: string | null;
    amountCents?: number | null;
    currency?: string | null;
    status?: string | null;
    failureReason?: string | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
    refundedCents?: number | null;
    payoutId?: string | null;
    destinationHint?: string | null;
    arrivalAt?: Date | null;
  };
};

export type WebhookVerification =
  | { ok: true; event: NormalizedWebhookEvent }
  | { ok: false; reason: string };

export type VerifyWebhookInput = {
  /** Rohtext des Requests – niemals das geparste JSON verwenden. */
  payload: string;
  headers: Headers;
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly mode: ProviderMode;
  /** true, wenn alle nötigen Credentials vorhanden sind. */
  isConfigured(): boolean;

  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification>;
  getPayment(paymentId: string): Promise<ProviderPayment | null>;
  refundPayment(input: RefundInput): Promise<ProviderRefund>;
  getPayoutStatus(): Promise<PayoutOverview>;
  cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<void>;

  /**
   * Optionaler Plan-Wechsel (Upgrade/Downgrade) am laufenden Abo.
   * Provider ohne native Abo-Verwaltung implementieren diese Methode nicht;
   * die Anwendung fällt dann auf einen neuen Checkout zurück.
   */
  changeSubscriptionPlan?(input: {
    subscriptionId: string;
    providerPriceId: string | null;
    amountCents: number;
    currency: string;
    planName: string;
  }): Promise<void>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly code: string = "provider_error",
    readonly status = 502,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
