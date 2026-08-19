import "server-only";
import { prisma } from "./db";

/** Kleiner Key-Value-Store für über das Admin-Dashboard änderbare Einstellungen. */
export type SettingsMap = Record<string, unknown>;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}

export const SETTING_KEYS = {
  checkoutNotice: "checkout_notice",
  invoiceCounter: "invoice_counter",
} as const;
