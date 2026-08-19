import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Stat } from "@/components/ui/Stat";
import { PayoutBadge } from "@/components/admin/StatusBadges";
import { PayoutSyncButton } from "@/components/admin/PayoutSyncButton";
import { getPaymentProvider, paymentProviderStatus } from "@/lib/payments";
import { getRevenueSummary } from "@/lib/analytics";
import { formatDateTime, NOT_AVAILABLE } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Payouts", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Auszahlungsübersicht.
 *
 * Grundsatz: Es werden ausschliesslich Werte angezeigt, die entweder aus
 * bestätigten Zahlungen in der eigenen Datenbank oder direkt vom Provider
 * stammen. Fehlt eine Information, steht dort „Nicht verfügbar“ – niemals ein
 * geschätzter oder erfundener Betrag.
 */
export default async function AdminPayoutsPage() {
  const admin = await requireAdmin("/admin/payouts");
  const canRead = hasPermission(
    { adminRole: admin.adminRole, permissions: admin.permissions },
    "payouts:read",
  );

  if (!canRead) {
    return (
      <div>
        <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Payouts</h1>
        <p className="mt-6 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Für diesen Bereich fehlt die Berechtigung „payouts:read“.
        </p>
      </div>
    );
  }

  const env = getEnv();
  const providerStatus = paymentProviderStatus();

  const [overview, revenue, storedPayouts, paidOut] = await Promise.all([
    getPaymentProvider()
      .getPayoutStatus()
      .catch((error: Error) => ({
        available: false as const,
        unavailableReason: `Provider-Abfrage fehlgeschlagen: ${error.message}`,
        balanceAvailableCents: null,
        balancePendingCents: null,
        currency: null,
        nextPayoutAt: null,
        payouts: [],
      })),
    getRevenueSummary(),
    prisma.payout.findMany({ orderBy: { initiatedAt: "desc" }, take: 25 }),
    prisma.payout.aggregate({ where: { status: "COMPLETED" }, _sum: { amountCents: true } }),
  ]);

  const lastPayout = storedPayouts.find((payout) => payout.status === "COMPLETED") ?? storedPayouts[0];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Payouts</h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">
            Auszahlungen werden vom Zahlungsanbieter auf das dort hinterlegte Geschäftskonto
            überwiesen. Bankverbindungen werden in dieser Anwendung weder gespeichert noch angezeigt.
          </p>
        </div>
        <PayoutSyncButton />
      </div>

      {!overview.available && (
        <p className="mt-8 border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-muted)]">
          <strong className="text-white">Keine Auszahlungsdaten vom Provider:</strong>{" "}
          {overview.unavailableReason ?? "Der Provider liefert keine Auszahlungsinformationen."}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Umsatz gesamt (bestätigt)"
          value={formatMoney(revenue.allTime)}
          hint="Eigene Daten aus verifizierten Zahlungen"
        />
        <Stat
          label="Verfügbar zur Auszahlung"
          value={
            overview.balanceAvailableCents !== null
              ? formatMoney(overview.balanceAvailableCents, overview.currency ?? "EUR")
              : NOT_AVAILABLE
          }
          hint="Angabe des Zahlungsanbieters"
        />
        <Stat
          label="Bereits ausgezahlt"
          value={formatMoney(paidOut._sum.amountCents ?? 0)}
          hint="Summe abgeschlossener Auszahlungen"
        />
        <Stat
          label="Nächste Auszahlung"
          value={overview.nextPayoutAt ? formatDateTime(overview.nextPayoutAt) : NOT_AVAILABLE}
          hint="Sofern vom Provider gemeldet"
        />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-x-auto border border-[var(--color-line)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Transaktions-ID</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Betrag</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Währung</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Ziel</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Gutschrift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {storedPayouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-muted)]">
                    Noch keine Auszahlungen erfasst.
                  </td>
                </tr>
              ) : (
                storedPayouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-5 py-4 font-mono text-xs">{payout.providerPayoutId}</td>
                    <td className="px-5 py-4">{formatMoney(payout.amountCents, payout.currency)}</td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">{payout.currency}</td>
                    <td className="px-5 py-4">
                      <PayoutBadge status={payout.status} />
                    </td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">
                      {payout.destinationHint ?? NOT_AVAILABLE}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {payout.arrivalAt ? formatDateTime(payout.arrivalAt) : NOT_AVAILABLE}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="card p-7">
            <p className="eyebrow">Letzte Auszahlung</p>
            {lastPayout ? (
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-muted)]">Betrag</dt>
                  <dd>{formatMoney(lastPayout.amountCents, lastPayout.currency)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-muted)]">Status</dt>
                  <dd>{lastPayout.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-muted)]">Ausgelöst</dt>
                  <dd>{lastPayout.initiatedAt ? formatDateTime(lastPayout.initiatedAt) : NOT_AVAILABLE}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-muted)]">ID</dt>
                  <dd className="font-mono text-xs">{lastPayout.providerPayoutId}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-muted)]">{NOT_AVAILABLE}</p>
            )}
          </div>

          <div className="card p-7">
            <p className="eyebrow">Konfiguration</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">Provider</dt>
                <dd>{providerStatus.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">Modus</dt>
                <dd>{providerStatus.mode}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">Credentials</dt>
                <dd>{providerStatus.configured ? "gesetzt" : "fehlen"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">Revolut Business</dt>
                <dd>{env.REVOLUT_BUSINESS_ACCESS_TOKEN ? "verbunden" : "nicht verbunden"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">Revolut Account-ID</dt>
                <dd className="font-mono text-xs">
                  {env.REVOLUT_ACCOUNT_ID ? `${env.REVOLUT_ACCOUNT_ID.slice(0, 6)}…` : NOT_AVAILABLE}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-xs text-[var(--color-muted-2)]">
              Das Auszahlungskonto (IBAN) wird ausschliesslich im Revolut-Business- bzw.
              Provider-Konto konfiguriert – niemals in dieser Anwendung.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
