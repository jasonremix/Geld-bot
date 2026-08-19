import "server-only";
import { getEnv } from "../env";
import { SandboxPaymentProvider } from "./sandbox";
import { StripePaymentProvider } from "./stripe";
import { RevolutPaymentProvider } from "./revolut";
import type { PaymentProvider, PaymentProviderId } from "./types";

export * from "./types";

let cached: { id: PaymentProviderId; provider: PaymentProvider } | null = null;

/** Liefert den konfigurierten Payment Provider (Factory über PAYMENT_PROVIDER). */
export function getPaymentProvider(): PaymentProvider {
  const id = getEnv().PAYMENT_PROVIDER;
  if (cached?.id === id) return cached.provider;

  const provider: PaymentProvider =
    id === "stripe"
      ? new StripePaymentProvider()
      : id === "revolut"
        ? new RevolutPaymentProvider()
        : new SandboxPaymentProvider();

  cached = { id, provider };
  return provider;
}

/** Nur für Tests: Provider-Cache leeren. */
export function resetPaymentProviderCache(): void {
  cached = null;
}

/** Kurzinfo für UI und Admin – ohne jegliche Secrets. */
export function paymentProviderStatus() {
  const provider = getPaymentProvider();
  return {
    id: provider.id,
    mode: provider.mode,
    configured: provider.isConfigured(),
    isSandbox: provider.mode === "sandbox",
  };
}
