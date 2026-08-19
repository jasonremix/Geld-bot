"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { parseMoneyToCents } from "@/lib/money";

export type EditablePlan = {
  id: string;
  key: string;
  name: string;
  tagline: string | null;
  priceCents: number;
  currency: string;
  active: boolean;
  providerPriceId: string | null;
};

/** Preise und Stammdaten der Pläne bearbeiten. */
export function PlanEditor({ plan }: { plan: EditablePlan }) {
  const router = useRouter();
  const [price, setPrice] = useState((plan.priceCents / 100).toFixed(2).replace(".", ","));
  const [name, setName] = useState(plan.name);
  const [tagline, setTagline] = useState(plan.tagline ?? "");
  const [priceId, setPriceId] = useState(plan.providerPriceId ?? "");
  const [active, setActive] = useState(plan.active);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const cents = parseMoneyToCents(price);
    if (cents === null) {
      setError("Preis bitte im Format 19,99 angeben.");
      return;
    }

    setPending(true);
    const result = await apiSend(
      "/api/admin/plans",
      { planId: plan.id, priceCents: cents, name, tagline, active, providerPriceId: priceId },
      "PATCH",
    );
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMessage("Gespeichert.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card p-7">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">{plan.key}</p>
        <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 accent-white"
          />
          aktiv
        </label>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`name-${plan.id}`}>Name</label>
          <input
            id={`name-${plan.id}`}
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor={`price-${plan.id}`}>Preis ({plan.currency} / Monat)</label>
          <input
            id={`price-${plan.id}`}
            className="field"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`tagline-${plan.id}`}>Kurzbeschreibung</label>
          <input
            id={`tagline-${plan.id}`}
            className="field"
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`priceId-${plan.id}`}>
            Provider-Preis-ID (z.B. Stripe price id)
          </label>
          <input
            id={`priceId-${plan.id}`}
            className="field font-mono text-xs"
            placeholder="price_…"
            value={priceId}
            onChange={(event) => setPriceId(event.target.value)}
          />
          <p className="mt-2 text-xs text-[var(--color-muted-2)]">
            Ohne Preis-ID wird der Betrag beim Checkout dynamisch übergeben; für Planwechsel am
            laufenden Abo ist eine Preis-ID erforderlich.
          </p>
        </div>
      </div>

      {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
      {message && <p className="mt-5 text-sm text-emerald-300">{message}</p>}

      <button type="submit" className="btn btn-primary mt-6 !px-6 !py-3 text-[11px]" disabled={pending}>
        {pending ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}
