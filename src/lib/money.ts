/** Geldbeträge werden ausschliesslich als Integer-Cent verarbeitet. */

export function formatMoney(cents: number, currency = "EUR", locale = "de-DE"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function parseMoneyToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number.parseFloat(normalized) * 100);
}

/** Netto/Steuer-Aufteilung aus einem Bruttobetrag; taxRateBp = Basispunkte (1900 = 19 %). */
export function splitGross(totalCents: number, taxRateBp: number) {
  if (taxRateBp <= 0) return { netCents: totalCents, taxCents: 0 };
  const netCents = Math.round((totalCents * 10000) / (10000 + taxRateBp));
  return { netCents, taxCents: totalCents - netCents };
}
