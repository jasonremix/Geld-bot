import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDailyRevenue, getDashboardStats } from "@/lib/analytics";
import { Stat } from "@/components/ui/Stat";
import { OrderBadge } from "@/components/admin/StatusBadges";
import { RevenueBars } from "@/components/admin/Charts";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, daily, recentOrders, failedWebhooks] = await Promise.all([
    getDashboardStats(),
    getDailyRevenue(30),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { plan: true },
    }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
  ]);

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Dashboard</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        Alle Zahlen basieren auf per Webhook bestätigten Zahlungen.
      </p>

      {failedWebhooks > 0 && (
        <p className="mt-8 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {failedWebhooks} Webhook-Event(s) konnten nicht verarbeitet werden. Details unter
          Analytics → Webhooks.
        </p>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Umsatz heute" value={formatMoney(stats.today)} />
        <Stat label="Umsatz gestern" value={formatMoney(stats.yesterday)} />
        <Stat label="Letzte 7 Tage" value={formatMoney(stats.last7Days)} />
        <Stat label="Letzte 30 Tage" value={formatMoney(stats.last30Days)} />
        <Stat label="Kunden" value={stats.customers} />
        <Stat label="Aktive Abos" value={stats.activeSubscriptions} />
        <Stat
          label="Wiederkehrender Umsatz"
          value={formatMoney(stats.mrrCents)}
          hint="Summe aktiver Abos pro Monat"
        />
        <Stat
          label="Conversion Rate"
          value={stats.conversionRatePercent === null ? "Nicht verfügbar" : `${stats.conversionRatePercent} %`}
          hint={`${stats.purchases30Days} Käufe / ${stats.checkoutsStarted30Days} Checkouts (30 Tage)`}
        />
      </div>

      <div className="mt-8">
        <RevenueBars points={daily} />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Letzte Bestellungen</h2>
          <Link href="/admin/orders" className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)] hover:text-white">
            Alle →
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto border border-[var(--color-line)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Nummer</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">E-Mail</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Plan</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Betrag</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Erstellt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[var(--color-muted)]">
                    Noch keine Bestellungen.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-4 font-mono text-xs">{order.number}</td>
                    <td className="px-5 py-4">{order.email}</td>
                    <td className="px-5 py-4">{order.plan?.name ?? "—"}</td>
                    <td className="px-5 py-4">{formatMoney(order.totalCents, order.currency)}</td>
                    <td className="px-5 py-4">
                      <OrderBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
