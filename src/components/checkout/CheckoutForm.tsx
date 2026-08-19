"use client";

import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";

export type CheckoutPlan = {
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  features: string[];
};

const PAYMENT_METHODS = [
  { value: "card", label: "Karte", hint: "Visa, Mastercard, Amex" },
  { value: "sepa", label: "SEPA-Lastschrift", hint: "Sofern vom Anbieter unterstützt" },
  { value: "wallet", label: "Wallet", hint: "Apple Pay / Google Pay" },
] as const;

export function CheckoutForm({
  plans,
  initialPlanKey,
  lockedEmail,
  sandbox,
  providerConfigured,
}: {
  plans: CheckoutPlan[];
  initialPlanKey: string;
  lockedEmail: string | null;
  sandbox: boolean;
  providerConfigured: boolean;
}) {
  const [planKey, setPlanKey] = useState(initialPlanKey);
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [method, setMethod] = useState<string>("card");
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.key === planKey) ?? plans[0];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await apiSend<{ url: string }>("/api/checkout/session", {
      planKey,
      email: lockedEmail ?? email,
      paymentMethod: method,
      acceptTerms: accepted,
    });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    // Weiterleitung zum Zahlungsanbieter (bzw. zur Sandbox-Simulation).
    window.location.assign(result.data.url);
  }

  if (!plan) {
    return <p className="text-[var(--color-muted)]">Aktuell ist kein Plan verfügbar.</p>;
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-12 lg:grid-cols-[1.3fr_1fr]" noValidate>
      <div>
        {sandbox && (
          <div className="mb-8 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <strong className="font-bold">TESTMODUS (Sandbox).</strong> Es findet keine echte Zahlung
            statt. Der Ablauf wird vollständig simuliert – inklusive signiertem Webhook.
          </div>
        )}

        {!providerConfigured && (
          <div className="mb-8 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Der Zahlungsanbieter ist noch nicht konfiguriert. Bitte die Environment-Variablen
            hinterlegen.
          </div>
        )}

        <fieldset className="mb-10">
          <legend className="eyebrow mb-5">1 — Plan wählen</legend>
          <div className="grid gap-3">
            {plans.map((item) => (
              <label
                key={item.key}
                className={`card flex cursor-pointer items-start gap-4 p-5 ${
                  item.key === planKey ? "border-[var(--color-paper)]" : ""
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={item.key}
                  checked={item.key === planKey}
                  onChange={() => setPlanKey(item.key)}
                  className="mt-1 h-4 w-4 accent-white"
                />
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="text-lg font-bold">{item.name}</span>
                    <span className="font-mono text-sm">
                      {formatMoney(item.priceCents, item.currency)} / Monat
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[var(--color-muted)]">
                    {item.features.slice(0, 3).join(" · ")}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-10">
          <legend className="eyebrow mb-5">2 — E-Mail</legend>
          <label className="label" htmlFor="email">
            E-Mail-Adresse
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="field"
            autoComplete="email"
            value={lockedEmail ?? email}
            readOnly={Boolean(lockedEmail)}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className="mt-2 text-xs text-[var(--color-muted-2)]">
            An diese Adresse gehen Zugangsdaten, Rechnung und Bestellbestätigung.
          </p>
        </fieldset>

        <fieldset className="mb-10">
          <legend className="eyebrow mb-5">3 — Zahlungsart</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {PAYMENT_METHODS.map((item) => (
              <label
                key={item.value}
                className={`card cursor-pointer p-4 text-sm ${
                  method === item.value ? "border-[var(--color-paper)]" : ""
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={item.value}
                  checked={method === item.value}
                  onChange={() => setMethod(item.value)}
                  className="sr-only"
                />
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs text-[var(--color-muted-2)]">{item.hint}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--color-muted-2)]">
            Die endgültige Auswahl und Eingabe der Zahlungsdaten erfolgt beim Zahlungsanbieter.
            Diese Plattform speichert keine Kartendaten.
          </p>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="card p-7">
          <p className="eyebrow">Zusammenfassung</p>
          <p className="display mt-5 text-3xl">{plan.name}</p>

          <dl className="mt-6 space-y-3 border-t border-[var(--color-line)] pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Abrechnung</dt>
              <dd>monatlich</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Kündigung</dt>
              <dd>jederzeit</dd>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <dt>Gesamt</dt>
              <dd>{formatMoney(plan.priceCents, plan.currency)}</dd>
            </div>
          </dl>

          <label className="mt-7 flex cursor-pointer items-start gap-3 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-[3px] h-4 w-4 accent-white"
              required
            />
            <span>
              Ich akzeptiere die <a href="/agb" className="text-white underline">AGB</a> und habe die{" "}
              <a href="/widerruf" className="text-white underline">Widerrufsbelehrung</a> sowie die{" "}
              <a href="/datenschutz" className="text-white underline">Datenschutzhinweise</a>{" "}
              gelesen.
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-5 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary mt-7 w-full"
            disabled={pending || !accepted || !providerConfigured}
          >
            {pending ? "Weiterleitung …" : "Zahlungspflichtig bestellen"}
          </button>

          <p className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
            Zugang nach bestätigter Zahlung
          </p>
        </div>
      </aside>
    </form>
  );
}
