import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
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
 * Revolut-Adapter (Merchant API + optional Business API für Auszahlungsdaten).
 *
 * Sicherheit:
 *  - Der Merchant Secret Key (`REVOLUT_MERCHANT_API_KEY`) wird ausschliesslich
 *    serverseitig verwendet. Der Public Key darf im Frontend erscheinen, wird
 *    hier aber nicht benötigt, da über Revolut Checkout weitergeleitet wird.
 *  - Es wird niemals eine IBAN gespeichert, geloggt oder angezeigt; das
 *    Auszahlungskonto wird ausschliesslich in Revolut Business konfiguriert.
 *  - Für Auszahlungen sind READ-Rechte ausreichend; PAY-Rechte werden von
 *    dieser Anwendung nicht verwendet.
 *
 * Hinweis zu Abos: Die Merchant API kennt keine vollautomatischen
 * Subscriptions wie Stripe. Wiederkehrende Zahlungen erfordern gespeicherte
 * Zahlungsmittel und einen eigenen Abrechnungslauf. Dieser Adapter erzeugt
 * daher Einmal-Orders; die Verlängerungslogik ist in
 * `docs/DEPLOYMENT.md` als offener Punkt dokumentiert.
 */

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

const API_VERSION = "2024-09-01";

const EVENT_MAP: Record<string, WebhookEventType> = {
  ORDER_COMPLETED: "payment_succeeded",
  ORDER_AUTHORISED: "payment_succeeded",
  ORDER_PAYMENT_AUTHENTICATED: "payment_succeeded",
  ORDER_PAYMENT_DECLINED: "payment_failed",
  ORDER_PAYMENT_FAILED: "payment_failed",
  ORDER_CANCELLED: "payment_failed",
  PAYMENT_COMPLETED: "payment_succeeded",
  PAYMENT_DECLINED: "payment_failed",
  PAYMENT_FAILED: "payment_failed",
  REFUND_COMPLETED: "refund_created",
  REFUND_FAILED: "unknown",
  CHARGEBACK_CREATED: "chargeback_created",
  PAYOUT_INITIATED: "payout_created",
  PAYOUT_COMPLETED: "payout_completed",
  PAYOUT_FAILED: "payout_failed",
};

export class RevolutPaymentProvider implements PaymentProvider {
  readonly id = "revolut" as const;
  readonly mode: "sandbox" | "live";

  constructor() {
    const base = getEnv().REVOLUT_API_BASE;
    this.mode = base.includes("sandbox") ? "sandbox" : "live";
  }

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.REVOLUT_MERCHANT_API_KEY && env.REVOLUT_WEBHOOK_SECRET);
  }

  private async call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const env = getEnv();
    if (!env.REVOLUT_MERCHANT_API_KEY) {
      throw new PaymentProviderError(
        "REVOLUT_MERCHANT_API_KEY ist nicht gesetzt.",
        "provider_not_configured",
        503,
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${env.REVOLUT_MERCHANT_API_KEY}`,
      "Revolut-Api-Version": API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

    const response = await fetch(`${env.REVOLUT_API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      // Antworttext kann Kundendaten enthalten – nur Status und Code melden.
      throw new PaymentProviderError(
        `Revolut API antwortete mit Status ${response.status}.`,
        "revolut_http_error",
        response.status >= 500 ? 502 : 400,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const order = await this.call<Rec>("/api/orders", {
      method: "POST",
      idempotencyKey: `order_${input.orderId}`,
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        description: input.planName,
        capture_mode: "automatic",
        merchant_order_data: {
          reference: input.orderNumber,
        },
        redirect_url: input.successUrl,
        customer: { email: input.email },
        metadata: { orderId: input.orderId, planKey: input.planKey, ...(input.metadata ?? {}) },
      }),
    });

    const id = str(order.id);
    const url = str(order.checkout_url);
    if (!id || !url) {
      throw new PaymentProviderError("Revolut lieferte keine Checkout-URL.", "no_checkout_url");
    }

    return { id, url, provider: this.id, mode: this.mode };
  }

  /**
   * Revolut signiert Webhooks mit `Revolut-Signature: v1=<hex>` über
   * `v1.<timestamp>.<rawBody>`. Der Zeitstempel wird gegen Replays geprüft.
   */
  async verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
    const secret = getEnv().REVOLUT_WEBHOOK_SECRET || getEnv().PAYMENT_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: "webhook_secret_missing" };

    const signatureHeader = input.headers.get("revolut-signature");
    const timestamp = input.headers.get("revolut-request-timestamp");
    if (!signatureHeader || !timestamp) return { ok: false, reason: "signature_missing" };

    const ageMs = Math.abs(Date.now() - Number(timestamp));
    if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
      return { ok: false, reason: "signature_timestamp_out_of_tolerance" };
    }

    const expected = createHmac("sha256", secret)
      .update(`v1.${timestamp}.${input.payload}`, "utf8")
      .digest("hex");

    // Der Header kann mehrere durch Komma getrennte Signaturen enthalten.
    const provided = signatureHeader
      .split(",")
      .map((s) => s.trim().replace(/^v1=/, ""))
      .filter(Boolean);

    const matches = provided.some((sig) => {
      const a = Buffer.from(sig, "utf8");
      const b = Buffer.from(expected, "utf8");
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!matches) return { ok: false, reason: "signature_mismatch" };

    let body: Rec;
    try {
      body = JSON.parse(input.payload) as Rec;
    } catch {
      return { ok: false, reason: "payload_not_json" };
    }

    return { ok: true, event: normalizeRevolutEvent(body, timestamp) };
  }

  async getPayment(paymentId: string): Promise<ProviderPayment | null> {
    try {
      const order = await this.call<Rec>(`/api/orders/${encodeURIComponent(paymentId)}`);
      const state = str(order.state) ?? "";
      const amount = num(order.amount) ?? 0;
      const refunded = num(order.refunded_amount) ?? 0;
      return {
        id: str(order.id) ?? paymentId,
        status: mapOrderState(state, refunded, amount),
        amountCents: amount,
        refundedCents: refunded,
        currency: (str(order.currency) ?? "EUR").toUpperCase(),
        orderReference: str(asRec(order.merchant_order_data).reference),
        createdAt: str(order.created_at) ? new Date(str(order.created_at)!) : null,
        paidAt: str(order.completed_at) ? new Date(str(order.completed_at)!) : null,
        failureReason: null,
      };
    } catch (error) {
      if (error instanceof PaymentProviderError && error.status === 400) return null;
      throw error;
    }
  }

  async refundPayment(input: RefundInput): Promise<ProviderRefund> {
    const payment = await this.getPayment(input.paymentId);
    const amount = input.amountCents ?? payment?.amountCents ?? 0;
    const currency = payment?.currency ?? "EUR";

    const refund = await this.call<Rec>(
      `/api/orders/${encodeURIComponent(input.paymentId)}/refund`,
      {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: JSON.stringify({ amount, currency, description: input.reason ?? "Refund" }),
      },
    );

    return {
      id: str(refund.id) ?? `rev_re_${input.idempotencyKey}`,
      paymentId: input.paymentId,
      amountCents: amount,
      currency,
      status: str(refund.state) === "completed" ? "succeeded" : "pending",
    };
  }

  /**
   * Auszahlungsdaten stammen aus der Revolut Business API (READ-Rechte).
   * Ohne Access Token werden KEINE Werte erfunden, sondern
   * `available: false` mit Begründung zurückgegeben.
   */
  async getPayoutStatus(): Promise<PayoutOverview> {
    const env = getEnv();
    const empty = (reason: string): PayoutOverview => ({
      available: false,
      unavailableReason: reason,
      balanceAvailableCents: null,
      balancePendingCents: null,
      currency: null,
      nextPayoutAt: null,
      payouts: [],
    });

    if (!env.REVOLUT_BUSINESS_ACCESS_TOKEN) {
      return empty(
        "Revolut Business ist nicht verbunden (REVOLUT_BUSINESS_ACCESS_TOKEN fehlt). Auszahlungsdaten sind daher nicht verfügbar.",
      );
    }

    try {
      const headers = {
        Authorization: `Bearer ${env.REVOLUT_BUSINESS_ACCESS_TOKEN}`,
        Accept: "application/json",
      };

      const accountsRes = await fetch(`${env.REVOLUT_BUSINESS_API_BASE}/accounts`, {
        headers,
        cache: "no-store",
      });
      if (!accountsRes.ok) {
        return empty(`Revolut Business API antwortete mit Status ${accountsRes.status}.`);
      }
      const accounts = (await accountsRes.json()) as Rec[];
      const account =
        accounts.find((a) => str(a.id) === env.REVOLUT_ACCOUNT_ID) ?? accounts[0] ?? null;

      const txRes = await fetch(
        `${env.REVOLUT_BUSINESS_API_BASE}/transactions?count=10${
          account && str(account.id) ? `&account=${encodeURIComponent(str(account.id)!)}` : ""
        }`,
        { headers, cache: "no-store" },
      );
      const transactions = txRes.ok ? ((await txRes.json()) as Rec[]) : [];

      const payouts = transactions
        .filter((t) => ["transfer", "payout", "card_payment"].includes(str(t.type) ?? ""))
        .map((t) => {
          const leg = asRec((t.legs as unknown[])?.[0]);
          return {
            id: str(t.id) ?? "unknown",
            status: mapBusinessState(str(t.state)),
            amountCents: num(leg.amount) !== null ? Math.round(num(leg.amount)! * 100) : null,
            currency: (str(leg.currency) ?? str(account?.currency) ?? "EUR").toUpperCase(),
            initiatedAt: str(t.created_at) ? new Date(str(t.created_at)!) : null,
            arrivalAt: str(t.completed_at) ? new Date(str(t.completed_at)!) : null,
            destinationHint: null,
          };
        });

      const balance = num(account?.balance);
      return {
        available: true,
        balanceAvailableCents: balance !== null ? Math.round(balance * 100) : null,
        balancePendingCents: null,
        currency: (str(account?.currency) ?? "EUR").toUpperCase(),
        // Revolut liefert keinen garantierten nächsten Auszahlungstermin.
        nextPayoutAt: null,
        payouts,
      };
    } catch (error) {
      return empty(`Revolut Business API nicht erreichbar: ${(error as Error).message}`);
    }
  }

  async cancelSubscription(): Promise<void> {
    // Die Merchant API verwaltet keine Abos; die Kündigung wird lokal
    // verarbeitet und verhindert die nächste Abbuchung.
  }
}

function mapOrderState(state: string, refunded: number, amount: number): ProviderPayment["status"] {
  if (refunded > 0) return refunded >= amount ? "refunded" : "partially_refunded";
  switch (state.toLowerCase()) {
    case "completed":
    case "authorised":
      return "succeeded";
    case "failed":
    case "cancelled":
      return "failed";
    default:
      return "pending";
  }
}

function mapBusinessState(state: string | null): PayoutOverview["payouts"][number]["status"] {
  switch ((state ?? "").toLowerCase()) {
    case "completed":
      return "completed";
    case "pending":
      return "pending";
    case "processing":
      return "in_transit";
    case "failed":
    case "declined":
    case "reverted":
      return "failed";
    default:
      return "unknown";
  }
}

/**
 * Revolut-Webhooks enthalten keine eigene Event-ID. Für die Idempotenz wird
 * daher ein stabiler Hash aus Event-Typ, Order-ID und Zeitstempel gebildet.
 */
export function normalizeRevolutEvent(body: Rec, timestamp: string): NormalizedWebhookEvent {
  const eventName = str(body.event) ?? "unknown";
  const orderId = str(body.order_id);
  const eventId =
    str(body.id) ??
    `rev_${createHash("sha256").update(`${eventName}.${orderId}.${timestamp}`).digest("hex").slice(0, 32)}`;

  return {
    id: eventId,
    type: EVENT_MAP[eventName] ?? "unknown",
    providerEventType: eventName,
    createdAt: new Date(Number(timestamp) || Date.now()),
    data: {
      orderReference: str(body.merchant_order_ext_ref) ?? str(asRec(body.merchant_order_data).reference),
      paymentId: orderId,
      subscriptionId: null,
      customerRef: str(body.customer_id),
      email: str(asRec(body.customer).email),
      amountCents: num(body.amount),
      currency: str(body.currency)?.toUpperCase() ?? null,
      status: str(body.state),
      failureReason: str(body.decline_reason),
      refundedCents: num(body.refunded_amount),
      payoutId: eventName.startsWith("PAYOUT") ? orderId : null,
      destinationHint: null,
      arrivalAt: null,
    },
  };
}
