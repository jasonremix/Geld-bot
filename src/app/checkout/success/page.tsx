import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Bestellung",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Erfolgsseite nach der Rückkehr vom Zahlungsanbieter.
 *
 * WICHTIG: Diese Seite markiert nichts als bezahlt. Sie zeigt ausschliesslich
 * den Zustand an, den der signaturgeprüfte Webhook gesetzt hat.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;

  const order = orderNumber
    ? await prisma.order.findUnique({
        where: { number: orderNumber },
        include: { plan: true },
      })
    : null;

  const paid = order?.status === "PAID";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-16">
      <p className="eyebrow">{paid ? "Zahlung bestätigt" : "Bestellung eingegangen"}</p>

      <h1 className="display mt-6 text-[clamp(2.25rem,7vw,4rem)]">
        {paid ? "Zugang freigeschaltet." : "Zahlung wird geprüft."}
      </h1>

      <p className="mt-6 text-[var(--color-muted)]">
        {paid
          ? "Deine Zahlung wurde vom Zahlungsanbieter bestätigt und dein Zugang ist aktiv. Zugangsdaten und Rechnung wurden per E-Mail versendet."
          : "Deine Bestellung ist angelegt. Der Zugang wird automatisch freigeschaltet, sobald der Zahlungsanbieter die Zahlung serverseitig bestätigt hat. Das dauert in der Regel nur wenige Sekunden."}
      </p>

      {order && (
        <dl className="mt-10 space-y-3 border-y border-[var(--color-line)] py-6 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted)]">Bestellnummer</dt>
            <dd className="font-mono">{order.number}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted)]">Plan</dt>
            <dd>{order.plan?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted)]">Betrag</dt>
            <dd>{formatMoney(order.totalCents, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted)]">Status</dt>
            <dd>{statusLabel(order.status)}</dd>
          </div>
        </dl>
      )}

      {!order && orderNumber && (
        <p className="mt-10 border border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-muted)]">
          Zu dieser Bestellnummer wurde nichts gefunden.
        </p>
      )}

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/dashboard" className="btn btn-primary">
          Zum Dashboard
        </Link>
        {!paid && (
          <Link href={`/checkout/success?order=${orderNumber ?? ""}`} className="btn btn-ghost">
            Status aktualisieren
          </Link>
        )}
      </div>

      <p className="mt-8 text-xs text-[var(--color-muted-2)]">
        Falls du noch keinen Account hattest, wurde einer für dich erstellt. Den Link zum Setzen
        deines Passworts findest du in deiner E-Mail.
      </p>
    </main>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "PAID":
      return "Bezahlt";
    case "PENDING":
      return "Zahlung ausstehend";
    case "FAILED":
      return "Fehlgeschlagen";
    case "REFUNDED":
      return "Erstattet";
    case "PARTIALLY_REFUNDED":
      return "Teilweise erstattet";
    case "CANCELED":
      return "Abgebrochen";
    default:
      return status;
  }
}
