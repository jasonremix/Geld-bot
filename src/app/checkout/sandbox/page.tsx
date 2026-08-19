import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SandboxSimulator } from "@/components/checkout/SandboxSimulator";
import { getEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Sandbox-Zahlung",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * TESTMODUS: Ersatz für die gehostete Zahlungsseite des Providers.
 * Nur erreichbar, wenn PAYMENT_PROVIDER=sandbox konfiguriert ist.
 */
export default async function SandboxCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (getEnv().PAYMENT_PROVIDER !== "sandbox") notFound();

  const params = await searchParams;
  const amount = Number(params.amount ?? 0);
  const currency = params.currency ?? "EUR";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-16">
      <div className="border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <strong className="font-bold">SANDBOX / TESTMODUS</strong> — hier fliesst kein echtes Geld.
      </div>

      <h1 className="display mt-10 text-4xl">Zahlung simulieren</h1>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Diese Seite ersetzt die gehostete Zahlungsseite des Anbieters. Das Ergebnis wird als
        signierter Webhook an den regulären Endpunkt gesendet und dort geprüft.
      </p>

      <dl className="mt-10 space-y-3 border-y border-[var(--color-line)] py-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Bestellnummer</dt>
          <dd className="font-mono">{params.order ?? "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Plan</dt>
          <dd>{params.plan ?? "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Betrag</dt>
          <dd>{Number.isFinite(amount) ? formatMoney(amount, currency) : "—"}</dd>
        </div>
      </dl>

      <SandboxSimulator
        orderNumber={params.order ?? ""}
        paymentId={params.payment ?? ""}
        planKey={params.plan ?? ""}
        email={params.email ?? ""}
        amountCents={Number.isFinite(amount) ? amount : 0}
        currency={currency}
      />
    </main>
  );
}
