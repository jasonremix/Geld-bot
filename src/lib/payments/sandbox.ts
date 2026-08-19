import "server-only";
import { randomUUID } from "node:crypto";
import { getEnv } from "../env";
import {
  createTimestampedSignature,
  verifyTimestampedSignature,
} from "./signature";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  NormalizedWebhookEvent,
  PaymentProvider,
  PayoutOverview,
  ProviderPayment,
  ProviderRefund,
  RefundInput,
  VerifyWebhookInput,
  WebhookEventType,
  WebhookVerification,
} from "./types";

export const SANDBOX_SIGNATURE_HEADER = "x-sandbox-signature";

/**
 * SANDBOX-/TESTMODUS – erzeugt KEINE echten Zahlungen.
 *
 * Dieser Adapter existiert, damit der komplette Ablauf (Checkout → Webhook →
 * Freischaltung) ohne echte Credentials end-to-end getestet werden kann.
 * Er ist im UI und in allen Antworten deutlich als Testmodus gekennzeichnet
 * und darf in Produktion nicht aktiviert werden.
 */
type SandboxPaymentRecord = {
  id: string;
  orderReference: string;
  amountCents: number;
  currency: string;
  refundedCents: number;
  status: ProviderPayment["status"];
  createdAt: Date;
  paidAt: Date | null;
};

const payments = new Map<string, SandboxPaymentRecord>();

export function sandboxRecordPayment(record: SandboxPaymentRecord): void {
  payments.set(record.id, record);
}

export function sandboxReset(): void {
  payments.clear();
}

const EVENT_TYPES: WebhookEventType[] = [
  "payment_succeeded",
  "payment_failed",
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "refund_created",
  "chargeback_created",
  "payout_created",
  "payout_completed",
  "payout_failed",
];

function toEventType(value: unknown): WebhookEventType {
  return EVENT_TYPES.includes(value as WebhookEventType) ? (value as WebhookEventType) : "unknown";
}

function toDate(value: unknown): Date | null {
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = "sandbox" as const;
  readonly mode = "sandbox" as const;

  isConfigured(): boolean {
    return Boolean(getEnv().PAYMENT_WEBHOOK_SECRET);
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const env = getEnv();
    const sessionId = `sbx_cs_${randomUUID()}`;
    const paymentId = `sbx_pay_${randomUUID()}`;

    sandboxRecordPayment({
      id: paymentId,
      orderReference: input.orderNumber,
      amountCents: input.amountCents,
      currency: input.currency,
      refundedCents: 0,
      status: "pending",
      createdAt: new Date(),
      paidAt: null,
    });

    const params = new URLSearchParams({
      session: sessionId,
      payment: paymentId,
      order: input.orderNumber,
      plan: input.planKey,
      amount: String(input.amountCents),
      currency: input.currency,
      email: input.email,
      mode: input.mode,
    });

    return {
      id: sessionId,
      url: `${env.APP_URL}/checkout/sandbox?${params.toString()}`,
      provider: this.id,
      mode: this.mode,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
    const env = getEnv();
    const check = verifyTimestampedSignature({
      header: input.headers.get(SANDBOX_SIGNATURE_HEADER),
      payload: input.payload,
      secret: env.PAYMENT_WEBHOOK_SECRET,
    });
    if (!check.ok) return { ok: false, reason: check.reason };

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.payload) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: "payload_not_json" };
    }

    const id = typeof parsed.id === "string" ? parsed.id : null;
    if (!id) return { ok: false, reason: "event_id_missing" };

    const data = (parsed.data ?? {}) as Record<string, unknown>;
    const event: NormalizedWebhookEvent = {
      id,
      type: toEventType(parsed.type),
      providerEventType: String(parsed.type ?? "unknown"),
      createdAt: toDate(parsed.created) ?? new Date(),
      data: {
        orderReference: (data.orderReference as string) ?? null,
        paymentId: (data.paymentId as string) ?? null,
        subscriptionId: (data.subscriptionId as string) ?? null,
        customerRef: (data.customerRef as string) ?? null,
        email: (data.email as string) ?? null,
        planKey: (data.planKey as string) ?? null,
        amountCents: typeof data.amountCents === "number" ? data.amountCents : null,
        currency: (data.currency as string) ?? null,
        status: (data.status as string) ?? null,
        failureReason: (data.failureReason as string) ?? null,
        currentPeriodStart: toDate(data.currentPeriodStart),
        currentPeriodEnd: toDate(data.currentPeriodEnd),
        cancelAtPeriodEnd:
          typeof data.cancelAtPeriodEnd === "boolean" ? data.cancelAtPeriodEnd : null,
        refundedCents: typeof data.refundedCents === "number" ? data.refundedCents : null,
        payoutId: (data.payoutId as string) ?? null,
        destinationHint: (data.destinationHint as string) ?? null,
        arrivalAt: toDate(data.arrivalAt),
      },
    };

    if (event.type === "payment_succeeded" && event.data.paymentId) {
      const record = payments.get(event.data.paymentId);
      if (record) {
        record.status = "succeeded";
        record.paidAt = new Date();
      }
    }

    return { ok: true, event };
  }

  async getPayment(paymentId: string): Promise<ProviderPayment | null> {
    const record = payments.get(paymentId);
    if (!record) return null;
    return {
      id: record.id,
      status: record.status,
      amountCents: record.amountCents,
      refundedCents: record.refundedCents,
      currency: record.currency,
      orderReference: record.orderReference,
      createdAt: record.createdAt,
      paidAt: record.paidAt,
      failureReason: null,
    };
  }

  async refundPayment(input: RefundInput): Promise<ProviderRefund> {
    const record = payments.get(input.paymentId);
    const amount = input.amountCents ?? record?.amountCents ?? 0;
    if (record) {
      record.refundedCents = Math.min(record.amountCents, record.refundedCents + amount);
      record.status = record.refundedCents >= record.amountCents ? "refunded" : "partially_refunded";
    }
    return {
      id: `sbx_re_${input.idempotencyKey}`,
      paymentId: input.paymentId,
      amountCents: amount,
      currency: record?.currency ?? "EUR",
      status: "succeeded",
    };
  }

  async getPayoutStatus(): Promise<PayoutOverview> {
    // Im Sandbox-Modus gibt es keine echten Auszahlungsdaten. Es werden
    // bewusst KEINE Beispielwerte erfunden.
    return {
      available: false,
      unavailableReason:
        "Sandbox-Modus: Der Testadapter liefert keine Auszahlungsdaten. Für echte Werte einen Live-Provider konfigurieren.",
      balanceAvailableCents: null,
      balancePendingCents: null,
      currency: null,
      nextPayoutAt: null,
      payouts: [],
    };
  }

  async cancelSubscription(): Promise<void> {
    // Im Sandbox-Modus wird die Kündigung ausschliesslich lokal verarbeitet.
  }

  async changeSubscriptionPlan(): Promise<void> {
    // Im Sandbox-Modus wird der Planwechsel ausschliesslich lokal verarbeitet.
  }
}

/** Hilfsfunktion für Sandbox-Simulation und Tests: signierter Webhook-Body. */
export function signSandboxPayload(payload: string, secret: string): string {
  return createTimestampedSignature(secret, payload);
}
