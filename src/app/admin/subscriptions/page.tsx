import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SubscriptionBadge } from "@/components/admin/StatusBadges";
import { Stat } from "@/components/ui/Stat";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Subscriptions", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const [subscriptions, active, pastDue, canceled] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { plan: true, customer: true },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: { in: ["PAST_DUE", "GRACE"] } } }),
    prisma.subscription.count({ where: { status: { in: ["CANCELED", "EXPIRED"] } } }),
  ]);

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Subscriptions</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Aktiv" value={active} />
        <Stat label="Zahlung offen" value={pastDue} hint="PAST_DUE / GRACE" />
        <Stat label="Beendet" value={canceled} />
      </div>

      <div className="mt-8 overflow-x-auto border border-[var(--color-line)]">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left">
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Kunde</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Plan</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Periode bis</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Kündigung</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Fehlversuche</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-muted)]">
                  Noch keine Abos.
                </td>
              </tr>
            ) : (
              subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="px-5 py-4">{subscription.customer.email}</td>
                  <td className="px-5 py-4">
                    {subscription.plan.name}
                    <span className="ml-2 text-xs text-[var(--color-muted)]">
                      {formatMoney(subscription.plan.priceCents, subscription.plan.currency)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <SubscriptionBadge status={subscription.status} />
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                    {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "—"}
                  </td>
                  <td className="px-5 py-4 text-[var(--color-muted)]">
                    {subscription.cancelAtPeriodEnd ? "zum Periodenende" : subscription.canceledAt ? formatDate(subscription.canceledAt) : "—"}
                  </td>
                  <td className="px-5 py-4 text-[var(--color-muted)]">{subscription.failedPaymentCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
