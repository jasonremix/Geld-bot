import "server-only";
import { prisma } from "./db";
import { businessConfig, getEnv } from "./env";
import { splitGross } from "./money";

/**
 * Rechnungserstellung.
 *
 * - Pro bezahlter Bestellung existiert genau eine Rechnung (idempotent).
 * - Die Rechnungsstellerdaten stammen ausschliesslich aus der Konfiguration.
 *   Nicht gesetzte Felder werden als "CONFIGURE_ME" markiert – es werden
 *   niemals Unternehmensdaten erfunden.
 */

const COUNTER_KEY = "invoice_counter";

async function nextInvoiceNumber(): Promise<string> {
  const env = getEnv();
  const year = new Date().getFullYear();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findUnique({ where: { key: COUNTER_KEY } });
    const state = (existing?.value as { year?: number; seq?: number } | undefined) ?? {};
    const seq = state.year === year ? (state.seq ?? 0) + 1 : 1;
    await tx.setting.upsert({
      where: { key: COUNTER_KEY },
      create: { key: COUNTER_KEY, value: { year, seq } },
      update: { value: { year, seq } },
    });
    return seq;
  });

  return `${env.INVOICE_NUMBER_PREFIX}-${year}-${String(result).padStart(5, "0")}`;
}

export function issuerSnapshot() {
  const business = businessConfig();
  const env = getEnv();
  const value = (v: string | null) => v ?? "CONFIGURE_ME";
  return {
    name: value(business.name),
    address: value(business.address),
    taxId: value(business.taxId),
    vatId: value(business.vatId),
    email: value(business.supportEmail),
    taxRateBp: env.INVOICE_TAX_RATE_BP,
    configured: business.isConfigured,
  };
}

export async function createInvoiceForOrder(orderId: string) {
  const existing = await prisma.invoice.findFirst({ where: { orderId } });
  if (existing) return existing;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true, plan: true },
  });
  if (!order) throw new Error(`Bestellung ${orderId} nicht gefunden.`);

  const env = getEnv();
  const taxRateBp = env.INVOICE_TAX_RATE_BP;
  const { netCents, taxCents } = splitGross(order.totalCents, taxRateBp);

  return prisma.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      customerId: order.customerId,
      orderId: order.id,
      subscriptionId: order.subscriptionId,
      status: "PAID",
      netCents,
      taxCents,
      taxRate: taxRateBp,
      totalCents: order.totalCents,
      currency: order.currency,
      paidAt: order.paidAt ?? new Date(),
      issuerSnapshot: issuerSnapshot(),
      buyerSnapshot: {
        email: order.email,
        name: order.customer?.name ?? null,
        company: order.customer?.company ?? null,
        country: order.customer?.country ?? null,
        vatId: order.customer?.vatId ?? null,
      },
      lines: order.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitAmountCents: item.unitAmountCents,
        totalCents: item.totalCents,
      })),
    },
  });
}
