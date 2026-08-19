import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Stat } from "@/components/ui/Stat";
import { RankedBars, RevenueBars } from "@/components/admin/Charts";
import { getDailyRevenue, getRevenueSummary, getTopPlans } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Revenue", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  const [summary, daily, topPlans, payments, refunded] = await Promise.all([
    getRevenueSummary(),
    getDailyRevenue(30),
    getTopPlans(5),
    prisma.payment.findMany({
      where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      orderBy: { paidAt: "desc" },
      take: 25,
      include: { order: { select: { number: true, email: true } } },
    }),
    prisma.payment.aggregate({ _sum: { refundedCents: true } }),
  ]);

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Revenue</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        Nettobeträge nach Abzug erfasster Erstattungen.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Heute" value={formatMoney(summary.today)} />
        <Stat label="Letzte 7 Tage" value={formatMoney(summary.last7Days)} />
        <Stat label="Letzte 30 Tage" value={formatMoney(summary.last30Days)} />
        <Stat label="Gesamt" value={formatMoney(summary.allTime)} />
        <Stat label="Wiederkehrend (MRR)" value={formatMoney(summary.mrrCents)} />
        <Stat
          label="Ø Bestellwert"
          value={formatMoney(summary.averageOrderValueCents)}
          hint={`${summary.ordersLast30Days} Bestellungen (30 Tage)`}
        />
        <Stat label="Erstattet gesamt" value={formatMoney(refunded._sum.refundedCents ?? 0)} />
      </div>

      <div className="mt-8">
        <RevenueBars points={daily} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="card p-7">
          <p className="eyebrow mb-6">Top-Pläne</p>
          <RankedBars
            items={topPlans.map((plan) => ({
              label: plan.name,
              sublabel: `${plan.orders} Bestellungen`,
              value: plan.revenueCents,
            }))}
            formatValue={(value) => formatMoney(value)}
          />
        </div>

        <div className="overflow-x-auto border border-[var(--color-line)]">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Zeit</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Bestellung</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Betrag</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-[var(--color-muted)]">
                    Noch keine bestätigten Zahlungen.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs">{payment.order?.number ?? "—"}</span>
                      <p className="mt-1 text-xs text-[var(--color-muted-2)]">{payment.order?.email}</p>
                    </td>
                    <td className="px-5 py-4">{formatMoney(payment.amountCents, payment.currency)}</td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">{payment.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
