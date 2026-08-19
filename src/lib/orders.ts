import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";

/** Bestellnummern-Format: GB-YYYYMMDD-XXXXXX (kollisionsarm, nicht erratbar). */
export function generateOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `GB-${date}-${suffix}`;
}

export type CreateOrderInput = {
  planId: string;
  planName: string;
  email: string;
  customerId: string | null;
  amountCents: number;
  currency: string;
  provider: string;
};

export async function createPendingOrder(input: CreateOrderInput) {
  return prisma.order.create({
    data: {
      number: generateOrderNumber(),
      email: input.email.toLowerCase(),
      customerId: input.customerId,
      planId: input.planId,
      status: "PENDING",
      subtotalCents: input.amountCents,
      totalCents: input.amountCents,
      currency: input.currency,
      provider: input.provider,
      items: {
        create: {
          description: `Abo: ${input.planName}`,
          quantity: 1,
          unitAmountCents: input.amountCents,
          totalCents: input.amountCents,
        },
      },
    },
    include: { items: true, plan: true },
  });
}
