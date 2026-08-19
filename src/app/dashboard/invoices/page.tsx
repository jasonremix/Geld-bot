import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui/Stat";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Rechnungen", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const user = await requireUser("/dashboard/invoices");

  const invoices = await prisma.invoice.findMany({
    where: { customer: { userId: user.id } },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div>
      <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">Rechnungen</h1>

      <div className="mt-10">
        {invoices.length === 0 ? (
          <EmptyState
            title="Noch keine Rechnungen"
            body="Für jede bestätigte Zahlung wird automatisch eine Rechnung erstellt."
          />
        ) : (
          <div className="overflow-x-auto border border-[var(--color-line)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th className="px-5 py-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Nummer</th>
                  <th className="px-5 py-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Datum</th>
                  <th className="px-5 py-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Betrag</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-5 py-4 font-mono text-xs">{invoice.number}</td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">{formatDate(invoice.issuedAt)}</td>
                    <td className="px-5 py-4">{formatMoney(invoice.totalCents, invoice.currency)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)] hover:text-white"
                      >
                        Ansehen →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
