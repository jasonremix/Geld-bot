import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { OrderBadge } from "@/components/admin/StatusBadges";
import { RefundButton } from "@/components/admin/RefundButton";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const [params, admin] = await Promise.all([searchParams, requireAdmin("/admin/orders")]);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = params.status;

  const where = status ? { status: status as never } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { plan: true, payments: true },
    }),
    prisma.order.count({ where }),
  ]);

  const canRefund = hasPermission(
    { adminRole: admin.adminRole, permissions: admin.permissions },
    "refunds:write",
  );

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Orders</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        {total} Bestellungen · Seite {page}
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {["", "PAID", "PENDING", "FAILED", "REFUNDED"].map((value) => (
          <a
            key={value || "all"}
            href={`/admin/orders${value ? `?status=${value}` : ""}`}
            className={`border px-4 py-2 text-[11px] uppercase tracking-[0.14em] ${
              status === value || (!status && !value)
                ? "border-white text-white"
                : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-white hover:text-white"
            }`}
          >
            {value || "Alle"}
          </a>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto border border-[var(--color-line)]">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left">
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Nummer</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Kunde</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Plan</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Betrag</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Bezahlt am</th>
              {canRefund && <th className="px-5 py-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={canRefund ? 7 : 6} className="px-5 py-10 text-center text-[var(--color-muted)]">
                  Keine Bestellungen gefunden.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const payment = order.payments.find((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED");
                return (
                  <tr key={order.id}>
                    <td className="px-5 py-4 font-mono text-xs">{order.number}</td>
                    <td className="px-5 py-4">{order.email}</td>
                    <td className="px-5 py-4">{order.plan?.name ?? "—"}</td>
                    <td className="px-5 py-4">
                      {formatMoney(order.totalCents, order.currency)}
                      {order.refundedCents > 0 && (
                        <span className="ml-2 text-xs text-[var(--color-muted)]">
                          −{formatMoney(order.refundedCents, order.currency)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <OrderBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {order.paidAt ? formatDateTime(order.paidAt) : "—"}
                    </td>
                    {canRefund && (
                      <td className="px-5 py-4 text-right">
                        {payment ? (
                          <RefundButton
                            paymentId={payment.id}
                            maxCents={payment.amountCents - payment.refundedCents}
                            currency={payment.currency}
                          />
                        ) : (
                          <span className="text-xs text-[var(--color-muted-2)]">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex gap-3">
        {page > 1 && (
          <a href={`/admin/orders?page=${page - 1}${status ? `&status=${status}` : ""}`} className="btn btn-ghost !px-5 !py-2.5 text-[11px]">
            ← Zurück
          </a>
        )}
        {page * PAGE_SIZE < total && (
          <a href={`/admin/orders?page=${page + 1}${status ? `&status=${status}` : ""}`} className="btn btn-ghost !px-5 !py-2.5 text-[11px]">
            Weiter →
          </a>
        )}
      </div>
    </div>
  );
}
