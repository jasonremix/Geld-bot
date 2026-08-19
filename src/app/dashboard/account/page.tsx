import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/Stat";
import { SubscriptionActions } from "@/components/dashboard/SubscriptionActions";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/dashboard/account");
  const entitlement = await getEntitlement(user.id);

  const [plans, subscriptions] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.subscription.findMany({
      where: { customer: { userId: user.id } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">Account</h1>

      <section className="card mt-10 p-7">
        <p className="eyebrow">Zugangsdaten</p>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">E-Mail</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">Name</dt>
            <dd>{user.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">Mitglied seit</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
        <Link href="/forgot-password" className="btn btn-ghost mt-6 !px-5 !py-2.5 text-[11px]">
          Passwort ändern
        </Link>
      </section>

      <section className="card mt-6 p-7">
        <div className="flex items-center justify-between gap-4">
          <p className="eyebrow">Abonnement</p>
          {entitlement.hasAccess ? (
            <Badge tone={entitlement.inGracePeriod ? "warning" : "positive"}>
              {entitlement.status}
            </Badge>
          ) : (
            <Badge>Kein aktives Abo</Badge>
          )}
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">Plan</dt>
            <dd>{entitlement.planName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">Nächste Abrechnung</dt>
            <dd>
              {entitlement.currentPeriodEnd ? formatDate(entitlement.currentPeriodEnd) : "Nicht verfügbar"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">Kündigung zum Periodenende</dt>
            <dd>{entitlement.cancelAtPeriodEnd ? "Ja" : "Nein"}</dd>
          </div>
        </dl>

        <div className="mt-8">
          <SubscriptionActions
            subscriptionId={entitlement.subscriptionId}
            cancelAtPeriodEnd={entitlement.cancelAtPeriodEnd}
            status={entitlement.status}
            currentPlanKey={entitlement.planKey}
            plans={plans.map((p) => ({ key: p.key, name: p.name, tier: p.tier }))}
          />
        </div>
      </section>

      {subscriptions.length > 0 && (
        <section className="card mt-6 p-7">
          <p className="eyebrow">Verlauf</p>
          <ul className="mt-5 divide-y divide-[var(--color-line)] text-sm">
            {subscriptions.map((subscription) => (
              <li key={subscription.id} className="flex flex-wrap justify-between gap-3 py-3">
                <span>
                  {subscription.plan.name} ·{" "}
                  <span className="text-[var(--color-muted)]">
                    {formatMoney(subscription.plan.priceCents, subscription.plan.currency)}
                  </span>
                </span>
                <span className="text-[var(--color-muted)]">
                  {subscription.status} · seit {formatDate(subscription.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
