import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PLAN_SEEDS } from "../../src/content/plans";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const db = new PrismaClient({ adapter });

/** Leert alle Tabellen und legt die Pläne neu an. */
export async function resetDatabase(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Download","AnalyticsEvent","AuditLog","EmailMessage","WebhookEvent","Payout",
      "Invoice","Payment","OrderItem","Order","Subscription","ProductFile","Product",
      "PasswordResetToken","AdminUser","Customer","User","Plan","Setting"
    RESTART IDENTITY CASCADE
  `);

  for (const plan of PLAN_SEEDS) {
    await db.plan.create({
      data: {
        key: plan.key,
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: plan.currency,
        tier: plan.tier,
        features: [...plan.features],
        highlighted: plan.highlighted,
        sortOrder: plan.sortOrder,
        active: true,
      },
    });
  }
}

export async function createCustomer(email = "kunde@example.test") {
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("test-passwort-1", 10),
      customer: { create: { email } },
    },
    include: { customer: true },
  });
  return { user, customer: user.customer! };
}

export async function createAdmin(
  email = "admin@example.test",
  adminRole: "OWNER" | "FINANCE" | "SUPPORT" = "OWNER",
) {
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("test-passwort-1", 10),
      role: "ADMIN",
      adminUser: { create: { adminRole } },
    },
    include: { adminUser: true },
  });
  return user;
}

export async function createPendingOrderFor(planKey: string, email: string) {
  const plan = await db.plan.findUniqueOrThrow({ where: { key: planKey } });
  return db.order.create({
    data: {
      number: `GB-TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      email,
      planId: plan.id,
      status: "PENDING",
      subtotalCents: plan.priceCents,
      totalCents: plan.priceCents,
      currency: plan.currency,
      provider: "sandbox",
      items: {
        create: {
          description: `Abo: ${plan.name}`,
          unitAmountCents: plan.priceCents,
          totalCents: plan.priceCents,
        },
      },
    },
    include: { plan: true },
  });
}
