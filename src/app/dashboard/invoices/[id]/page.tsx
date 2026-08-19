import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Rechnung", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type IssuerSnapshot = {
  name: string;
  address: string;
  taxId: string;
  vatId: string;
  email: string;
  configured?: boolean;
};

type InvoiceLine = {
  description: string;
  quantity: number;
  unitAmountCents: number;
  totalCents: number;
};

/** Druckbare Rechnungsansicht. Alle Angaben stammen aus dem Snapshot. */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser("/dashboard/invoices");

  const invoice = await prisma.invoice.findFirst({
    where: { id, customer: { userId: user.id } },
    include: { order: true },
  });
  if (!invoice) notFound();

  const issuer = invoice.issuerSnapshot as unknown as IssuerSnapshot;
  const buyer = invoice.buyerSnapshot as unknown as { email: string; name: string | null };
  const lines = invoice.lines as unknown as InvoiceLine[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/invoices" className="eyebrow hover:text-white">
        ← Rechnungen
      </Link>

      <article className="card mt-8 p-10 print:border-none print:bg-white print:text-black">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="eyebrow">Rechnung</p>
            <p className="display mt-3 text-3xl">{invoice.number}</p>
          </div>
          <div className="text-right text-sm">
            <p>{formatDate(invoice.issuedAt)}</p>
            <p className="text-[var(--color-muted)]">
              {invoice.status === "PAID" ? "Bezahlt" : invoice.status}
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <section>
            <p className="eyebrow mb-3">Rechnungssteller</p>
            <p className="text-sm leading-relaxed">
              {issuer.name}
              <br />
              {issuer.address}
              <br />
              {issuer.email}
            </p>
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Steuernummer: {issuer.taxId} · USt-IdNr.: {issuer.vatId}
            </p>
            {issuer.configured === false && (
              <p className="mt-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Hinweis: Die Rechnungsdaten sind noch nicht vollständig konfiguriert
                (CONFIGURE_ME).
              </p>
            )}
          </section>

          <section>
            <p className="eyebrow mb-3">Rechnungsempfänger</p>
            <p className="text-sm leading-relaxed">
              {buyer.name ?? "—"}
              <br />
              {buyer.email}
            </p>
          </section>
        </div>

        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left">
              <th className="py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Position</th>
              <th className="py-3 text-right text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Menge</th>
              <th className="py-3 text-right text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Betrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="py-3">{line.description}</td>
                <td className="py-3 text-right">{line.quantity}</td>
                <td className="py-3 text-right">{formatMoney(line.totalCents, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-8 space-y-2 border-t border-[var(--color-line)] pt-6 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted)]">Netto</dt>
            <dd>{formatMoney(invoice.netCents, invoice.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted)]">
              Umsatzsteuer ({(invoice.taxRate / 100).toFixed(2)} %)
            </dt>
            <dd>{formatMoney(invoice.taxCents, invoice.currency)}</dd>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <dt>Gesamt</dt>
            <dd>{formatMoney(invoice.totalCents, invoice.currency)}</dd>
          </div>
        </dl>

        {invoice.taxRate === 0 && (
          <p className="mt-6 text-xs text-[var(--color-muted-2)]">
            Es wird keine Umsatzsteuer ausgewiesen. Die korrekte steuerliche Behandlung ist über
            INVOICE_TAX_RATE_BP zu konfigurieren.
          </p>
        )}
      </article>
    </div>
  );
}
