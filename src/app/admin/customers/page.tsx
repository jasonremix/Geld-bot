import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SubscriptionBadge } from "@/components/admin/StatusBadges";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Customers", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const query = params.q?.trim();

  // Suche über Prisma-Filter – keine string-konkatenierten SQL-Fragmente.
  const where = query
    ? { OR: [{ email: { contains: query, mode: "insensitive" as const } }, { name: { contains: query, mode: "insensitive" as const } }] }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        orders: { where: { status: "PAID" }, select: { totalCents: true, refundedCents: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Customers</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{total} Kunden</p>

      <form className="mt-8 flex max-w-md gap-3" action="/admin/customers">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="E-Mail oder Name"
          className="field"
        />
        <button type="submit" className="btn btn-ghost !px-5 !py-2.5 text-[11px]">
          Suchen
        </button>
      </form>

      <div className="mt-6 overflow-x-auto border border-[var(--color-line)]">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left">
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">E-Mail</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Name</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Plan</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Umsatz</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Kunde seit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[var(--color-muted)]">
                  Keine Kunden gefunden.
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const revenue = customer.orders.reduce(
                  (sum, order) => sum + order.totalCents - order.refundedCents,
                  0,
                );
                const subscription = customer.subscriptions[0];
                return (
                  <tr key={customer.id}>
                    <td className="px-5 py-4">{customer.email}</td>
                    <td className="px-5 py-4">{customer.name ?? "—"}</td>
                    <td className="px-5 py-4">
                      {subscription ? (
                        <span className="flex flex-wrap items-center gap-2">
                          {subscription.plan.name} <SubscriptionBadge status={subscription.status} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4">{formatMoney(revenue)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {formatDate(customer.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex gap-3">
        {page > 1 && (
          <a href={`/admin/customers?page=${page - 1}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="btn btn-ghost !px-5 !py-2.5 text-[11px]">
            ← Zurück
          </a>
        )}
        {page * PAGE_SIZE < total && (
          <a href={`/admin/customers?page=${page + 1}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="btn btn-ghost !px-5 !py-2.5 text-[11px]">
            Weiter →
          </a>
        )}
      </div>
    </div>
  );
}
