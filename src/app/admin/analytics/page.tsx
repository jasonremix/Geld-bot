import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Stat } from "@/components/ui/Stat";
import { RankedBars, RevenueBars } from "@/components/admin/Charts";
import {
  daysAgo,
  getDailyRevenue,
  getDashboardStats,
  getTopPlans,
  getTopProducts,
} from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [stats, daily, topPlans, topProducts, eventCounts, webhooks] = await Promise.all([
    getDashboardStats(),
    getDailyRevenue(30),
    getTopPlans(5),
    getTopProducts(5),
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      _count: true,
      where: { createdAt: { gte: daysAgo(30) } },
      orderBy: { _count: { type: "desc" } },
    }),
    prisma.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Analytics</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Umsatz heute" value={formatMoney(stats.today)} />
        <Stat label="Umsatz gestern" value={formatMoney(stats.yesterday)} />
        <Stat label="7 Tage" value={formatMoney(stats.last7Days)} />
        <Stat label="30 Tage" value={formatMoney(stats.last30Days)} />
        <Stat label="Kunden" value={stats.customers} />
        <Stat label="Aktive Abos" value={stats.activeSubscriptions} />
        <Stat label="Kündigungen (30 T.)" value={stats.cancellations30Days} />
        <Stat
          label="Conversion Rate"
          value={stats.conversionRatePercent === null ? "Nicht verfügbar" : `${stats.conversionRatePercent} %`}
          hint="Käufe / gestartete Checkouts"
        />
        <Stat label="Ø Bestellwert" value={formatMoney(stats.averageOrderValueCents)} />
        <Stat label="Wiederkehrender Umsatz" value={formatMoney(stats.mrrCents)} />
      </div>

      <div className="mt-8">
        <RevenueBars points={daily} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
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

        <div className="card p-7">
          <p className="eyebrow mb-6">Top-Produkte</p>
          <RankedBars
            items={topProducts.map((product) => ({
              label: product.title,
              sublabel: product.filename,
              value: product.downloads,
            }))}
            formatValue={(value) => `${value}×`}
          />
        </div>

        <div className="card p-7">
          <p className="eyebrow mb-6">Ereignisse (30 Tage)</p>
          <RankedBars
            items={eventCounts.map((event) => ({ label: event.type, value: event._count }))}
            formatValue={(value) => String(value)}
          />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Webhook-Events</h2>
        <p className="mt-2 text-xs text-[var(--color-muted-2)]">
          Jedes Event wird anhand seiner Event-ID genau einmal verarbeitet.
        </p>

        <div className="mt-5 overflow-x-auto border border-[var(--color-line)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Zeit</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Provider</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Typ</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Versuche</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Fehler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-muted)]">
                    Noch keine Webhook-Events empfangen.
                  </td>
                </tr>
              ) : (
                webhooks.map((event) => (
                  <tr key={event.id}>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="px-5 py-4">{event.provider}</td>
                    <td className="px-5 py-4 font-mono text-xs">{event.type}</td>
                    <td className="px-5 py-4">{event.status}</td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">{event.attempts}</td>
                    <td className="px-5 py-4 max-w-[220px] truncate text-xs text-[var(--color-muted-2)]">
                      {event.error ?? "—"}
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
