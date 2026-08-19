import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/db";
import { Badge, EmptyState, Stat } from "@/components/ui/Stat";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, user] = await Promise.all([searchParams, requireUser()]);
  const entitlement = await getEntitlement(user.id);

  const [availableFiles, newProducts, lastInvoice, downloads] = await Promise.all([
    prisma.productFile.count({
      where: {
        product: { published: true },
        OR: [
          { minTier: { lte: entitlement.tier } },
          { minTier: null, product: { published: true, minTier: { lte: entitlement.tier } } },
        ],
      },
    }),
    prisma.product.findMany({
      where: { published: true, minTier: { lte: entitlement.tier } },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { _count: { select: { files: true } } },
    }),
    prisma.invoice.findFirst({
      where: { customer: { userId: user.id } },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.download.count({ where: { userId: user.id } }),
  ]);

  return (
    <div>
      {error === "forbidden" && (
        <p className="mb-8 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Für diesen Bereich fehlt dir die Berechtigung.
        </p>
      )}

      <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">
        Hallo{user.name ? `, ${user.name}` : ""}.
      </h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Aktueller Plan"
          value={entitlement.planName ?? "Kein aktives Abo"}
          hint={entitlement.status ? `Status: ${entitlement.status}` : "Wähle einen Plan, um zu starten."}
        />
        <Stat label="Mitglied seit" value={formatDate(user.createdAt)} />
        <Stat
          label="Nächste Abrechnung"
          value={entitlement.currentPeriodEnd ? formatDate(entitlement.currentPeriodEnd) : "Nicht verfügbar"}
          hint={entitlement.cancelAtPeriodEnd ? "Kündigung zum Periodenende aktiv" : null}
        />
        <Stat
          label="Verfügbare Downloads"
          value={entitlement.hasAccess ? availableFiles : 0}
          hint={`${downloads} bisher geladen`}
        />
      </div>

      {entitlement.inGracePeriod && (
        <p className="mt-8 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Eine Zahlung ist offen. Dein Zugang bleibt vorerst aktiv – bitte aktualisiere dein
          Zahlungsmittel beim Anbieter.
        </p>
      )}

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-[0.16em]">Neue Produkte</h2>
          <Link href="/dashboard/library" className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)] hover:text-white">
            Zur Library →
          </Link>
        </div>

        <div className="mt-6">
          {!entitlement.hasAccess ? (
            <EmptyState
              title="Noch kein aktives Abo"
              body="Wähle einen Plan, um Zugriff auf Presets, Samples, Templates und Creator Assets zu erhalten."
            />
          ) : newProducts.length === 0 ? (
            <EmptyState
              title="Noch keine Produkte veröffentlicht"
              body="Sobald Inhalte für deinen Plan freigegeben sind, erscheinen sie hier."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {newProducts.map((product) => (
                <article key={product.id} className="card p-6">
                  <Badge>{product.type.replace(/_/g, " ")}</Badge>
                  <h3 className="mt-4 text-lg font-bold">{product.title}</h3>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {product._count.files} {product._count.files === 1 ? "Datei" : "Dateien"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="card p-7">
          <p className="eyebrow">Letzte Rechnung</p>
          {lastInvoice ? (
            <>
              <p className="mt-4 text-2xl font-bold">
                {formatMoney(lastInvoice.totalCents, lastInvoice.currency)}
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {lastInvoice.number} · {formatDate(lastInvoice.issuedAt)}
              </p>
              <Link href="/dashboard/invoices" className="btn btn-ghost mt-6 !px-5 !py-2.5 text-[11px]">
                Alle Rechnungen
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-muted)]">Noch keine Rechnung vorhanden.</p>
          )}
        </div>

        <div className="card p-7">
          <p className="eyebrow">Account</p>
          <p className="mt-4 text-sm text-[var(--color-muted)]">{user.email}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/account" className="btn btn-ghost !px-5 !py-2.5 text-[11px]">
              Verwalten
            </Link>
            <Link href="/dashboard/support" className="btn btn-ghost !px-5 !py-2.5 text-[11px]">
              Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
