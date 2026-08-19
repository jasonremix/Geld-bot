import "server-only";
import { prisma } from "./db";

/**
 * Zugriffslogik: Welche Inhalte darf ein Kunde laden?
 *
 * Jeder Plan hat ein Tier (Starter = 1, Pro = 2, Ultimate = 3). Ein Produkt
 * verlangt ein Mindest-Tier. Höhere Pläne schalten automatisch alle Inhalte
 * niedrigerer Tiers frei.
 */

export type Entitlement = {
  tier: number;
  hasAccess: boolean;
  planKey: string | null;
  planName: string | null;
  status: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  inGracePeriod: boolean;
};

export const NO_ENTITLEMENT: Entitlement = {
  tier: 0,
  hasAccess: false,
  planKey: null,
  planName: null,
  status: null,
  subscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  inGracePeriod: false,
};

/** Status, die grundsätzlich Zugriff gewähren. */
export const ACCESS_STATUSES = ["ACTIVE", "GRACE"] as const;

export async function getEntitlement(userId: string, now = new Date()): Promise<Entitlement> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!customer) return NO_ENTITLEMENT;

  const subscriptions = await prisma.subscription.findMany({
    where: { customerId: customer.id },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  let best: Entitlement = NO_ENTITLEMENT;

  for (const sub of subscriptions) {
    const inGrace =
      sub.status === "GRACE" ||
      (sub.status === "PAST_DUE" && !!sub.gracePeriodEndsAt && sub.gracePeriodEndsAt > now);

    const periodValid = !sub.currentPeriodEnd || sub.currentPeriodEnd > now;
    const active = sub.status === "ACTIVE" && periodValid;
    const graceValid = inGrace && (!sub.gracePeriodEndsAt || sub.gracePeriodEndsAt > now);

    if (!active && !graceValid) continue;
    if (sub.plan.tier <= best.tier) continue;

    best = {
      tier: sub.plan.tier,
      hasAccess: true,
      planKey: sub.plan.key,
      planName: sub.plan.name,
      status: sub.status,
      subscriptionId: sub.id,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      inGracePeriod: graceValid && !active,
    };
  }

  return best;
}

/** Reine Funktion – ohne Datenbankzugriff testbar. */
export function canAccess(tier: number, requiredTier: number): boolean {
  return tier >= requiredTier && requiredTier >= 0 && tier > 0;
}

export async function canUserDownloadFile(userId: string, productFileId: string): Promise<boolean> {
  const file = await prisma.productFile.findUnique({
    where: { id: productFileId },
    include: { product: { select: { minTier: true, published: true } } },
  });
  if (!file || !file.product.published) return false;

  const required = file.minTier ?? file.product.minTier;
  const entitlement = await getEntitlement(userId);
  return canAccess(entitlement.tier, required);
}
