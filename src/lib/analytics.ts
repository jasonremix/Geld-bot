import "server-only";
import { prisma } from "./db";

/**
 * Kennzahlen für das Admin-Dashboard.
 *
 * Grundlage sind ausschliesslich echte, per Webhook bestätigte Zahlungen
 * (Order.status = PAID). Es werden keine Werte geschätzt oder hochgerechnet.
 */

export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(days: number, from = new Date()): Date {
  const d = startOfDay(from);
  d.setDate(d.getDate() - days);
  return d;
}

async function revenueBetween(from: Date, to: Date): Promise<{ cents: number; orders: number }> {
  const result = await prisma.order.aggregate({
    where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gte: from, lt: to } },
    _sum: { totalCents: true, refundedCents: true },
    _count: true,
  });
  const gross = result._sum.totalCents ?? 0;
  const refunded = result._sum.refundedCents ?? 0;
  return { cents: gross - refunded, orders: result._count };
}

export type RevenueSummary = {
  today: number;
  yesterday: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
  ordersLast30Days: number;
  averageOrderValueCents: number;
  mrrCents: number;
};

export async function getRevenueSummary(now = new Date()): Promise<RevenueSummary> {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [todayR, yesterdayR, sevenR, thirtyR, allTime, activeSubs] = await Promise.all([
    revenueBetween(today, tomorrow),
    revenueBetween(daysAgo(1, now), today),
    revenueBetween(daysAgo(7, now), tomorrow),
    revenueBetween(daysAgo(30, now), tomorrow),
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      _sum: { totalCents: true, refundedCents: true },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "GRACE"] } },
      select: { plan: { select: { priceCents: true } } },
    }),
  ]);

  return {
    today: todayR.cents,
    yesterday: yesterdayR.cents,
    last7Days: sevenR.cents,
    last30Days: thirtyR.cents,
    allTime: (allTime._sum.totalCents ?? 0) - (allTime._sum.refundedCents ?? 0),
    ordersLast30Days: thirtyR.orders,
    averageOrderValueCents: thirtyR.orders > 0 ? Math.round(thirtyR.cents / thirtyR.orders) : 0,
    // Wiederkehrender Umsatz = Summe der Preise aller aktiven Abos.
    mrrCents: activeSubs.reduce((sum, s) => sum + s.plan.priceCents, 0),
  };
}

export type DashboardStats = RevenueSummary & {
  customers: number;
  activeSubscriptions: number;
  cancellations30Days: number;
  conversionRatePercent: number | null;
  checkoutsStarted30Days: number;
  purchases30Days: number;
};

export async function getDashboardStats(now = new Date()): Promise<DashboardStats> {
  const since = daysAgo(30, now);
  const [revenue, customers, activeSubscriptions, cancellations, started, purchases] =
    await Promise.all([
      getRevenueSummary(now),
      prisma.customer.count(),
      prisma.subscription.count({ where: { status: { in: ["ACTIVE", "GRACE"] } } }),
      prisma.subscription.count({ where: { canceledAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { type: "checkout_started", createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { type: "purchase", createdAt: { gte: since } } }),
    ]);

  return {
    ...revenue,
    customers,
    activeSubscriptions,
    cancellations30Days: cancellations,
    checkoutsStarted30Days: started,
    purchases30Days: purchases,
    // Ohne Checkout-Starts gibt es keine belastbare Conversion Rate.
    conversionRatePercent: started > 0 ? Math.round((purchases / started) * 1000) / 10 : null,
  };
}

export type DailyRevenuePoint = { date: string; cents: number; orders: number };

/** Tagesumsätze der letzten N Tage – Basis für die Charts. */
export async function getDailyRevenue(days = 30, now = new Date()): Promise<DailyRevenuePoint[]> {
  const from = daysAgo(days - 1, now);
  const orders = await prisma.order.findMany({
    where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gte: from } },
    select: { paidAt: true, totalCents: true, refundedCents: true },
  });

  const buckets = new Map<string, { cents: number; orders: number }>();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(from);
    day.setDate(day.getDate() + i);
    buckets.set(day.toISOString().slice(0, 10), { cents: 0, orders: 0 });
  }

  for (const order of orders) {
    if (!order.paidAt) continue;
    const key = order.paidAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.cents += order.totalCents - order.refundedCents;
    bucket.orders += 1;
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

export async function getTopPlans(limit = 5) {
  const grouped = await prisma.order.groupBy({
    by: ["planId"],
    where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, planId: { not: null } },
    _sum: { totalCents: true },
    _count: true,
    orderBy: { _sum: { totalCents: "desc" } },
    take: limit,
  });

  const plans = await prisma.plan.findMany({
    where: { id: { in: grouped.map((g) => g.planId!).filter(Boolean) } },
  });

  return grouped.map((g) => ({
    planId: g.planId,
    name: plans.find((p) => p.id === g.planId)?.name ?? "Unbekannt",
    orders: g._count,
    revenueCents: g._sum.totalCents ?? 0,
  }));
}

export async function getTopProducts(limit = 5) {
  const grouped = await prisma.download.groupBy({
    by: ["productFileId"],
    _count: true,
    orderBy: { _count: { productFileId: "desc" } },
    take: limit,
  });

  const files = await prisma.productFile.findMany({
    where: { id: { in: grouped.map((g) => g.productFileId) } },
    include: { product: { select: { title: true, slug: true } } },
  });

  return grouped.map((g) => {
    const file = files.find((f) => f.id === g.productFileId);
    return {
      productFileId: g.productFileId,
      title: file?.product.title ?? "Unbekannt",
      filename: file?.filename ?? "Unbekannt",
      downloads: g._count,
    };
  });
}

/** Erfasst ein Analytics-Ereignis; Fehler werden bewusst geschluckt. */
export async function trackEvent(input: {
  type: string;
  userId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  referrer?: string | null;
  planKey?: string | null;
  valueCents?: number | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        path: input.path ?? null,
        referrer: input.referrer ?? null,
        planKey: input.planKey ?? null,
        valueCents: input.valueCents ?? null,
        meta: (input.meta ?? {}) as object,
      },
    });
  } catch (error) {
    console.error("analytics_track_failed", (error as Error).message);
  }
}
