import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm, type CheckoutPlan } from "@/components/checkout/CheckoutForm";
import { PageView } from "@/components/site/PageView";
import { PLAN_SEEDS } from "@/content/plans";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { paymentProviderStatus } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const [{ plan: requestedPlan }, user] = await Promise.all([searchParams, getCurrentUser()]);

  const dbPlans = await prisma.plan
    .findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })
    .catch(() => []);

  const plans: CheckoutPlan[] =
    dbPlans.length > 0
      ? dbPlans.map((plan) => ({
          key: plan.key,
          name: plan.name,
          priceCents: plan.priceCents,
          currency: plan.currency,
          features: plan.features,
        }))
      : PLAN_SEEDS.map((plan) => ({
          key: plan.key,
          name: plan.name,
          priceCents: plan.priceCents,
          currency: plan.currency,
          features: plan.features,
        }));

  const initialPlanKey =
    plans.find((plan) => plan.key === requestedPlan)?.key ?? plans[1]?.key ?? plans[0]?.key ?? "pro";

  const provider = paymentProviderStatus();

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <PageView type="checkout_view" planKey={initialPlanKey} />
      <Link href="/" className="eyebrow transition-colors hover:text-white">
        ← Zurück
      </Link>

      <h1 className="display mt-8 text-[clamp(2.25rem,7vw,4.5rem)]">Checkout</h1>
      <p className="mt-4 max-w-lg text-sm text-[var(--color-muted)]">
        Der Zugang wird automatisch freigeschaltet, sobald der Zahlungsanbieter die Zahlung
        serverseitig bestätigt hat.
      </p>

      <div className="mt-14">
        <CheckoutForm
          plans={plans}
          initialPlanKey={initialPlanKey}
          lockedEmail={user?.email ?? null}
          sandbox={provider.isSandbox}
          providerConfigured={provider.configured}
        />
      </div>
    </main>
  );
}
