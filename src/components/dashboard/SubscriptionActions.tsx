"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";

export function SubscriptionActions({
  subscriptionId,
  cancelAtPeriodEnd,
  status,
  plans,
  currentPlanKey,
}: {
  subscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  status: string | null;
  plans: { key: string; name: string; tier: number }[];
  currentPlanKey: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "cancel" | "cancel_at_period_end" | "reactivate") {
    if (!subscriptionId) return;
    if (action !== "reactivate" && !confirm("Kündigung wirklich durchführen?")) return;

    setPending(action);
    setError(null);
    setMessage(null);

    const result = await apiSend("/api/account/subscription", { subscriptionId, action });
    setPending(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMessage(
      action === "reactivate"
        ? "Kündigung zurückgenommen."
        : "Kündigung erfasst. Der Zugang endet zum angegebenen Zeitpunkt.",
    );
    router.refresh();
  }

  async function changePlan(planKey: string) {
    setPending(`plan:${planKey}`);
    setError(null);
    setMessage(null);

    const result = await apiSend<{ redirect?: string }>("/api/account/plan", { planKey });
    setPending(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (result.data.redirect) {
      window.location.assign(result.data.redirect);
      return;
    }

    setMessage("Planwechsel übermittelt. Die Bestätigung erfolgt über den Zahlungsanbieter.");
    router.refresh();
  }

  return (
    <div>
      {message && (
        <p className="mb-5 border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-5 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => (
          <button
            key={plan.key}
            type="button"
            className={`btn ${plan.key === currentPlanKey ? "btn-primary" : "btn-ghost"} !py-3 text-[11px]`}
            disabled={plan.key === currentPlanKey || pending !== null}
            onClick={() => changePlan(plan.key)}
          >
            {pending === `plan:${plan.key}`
              ? "…"
              : plan.key === currentPlanKey
                ? `${plan.name} (aktiv)`
                : `Zu ${plan.name}`}
          </button>
        ))}
      </div>

      {subscriptionId && status !== "CANCELED" && (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-6">
          {cancelAtPeriodEnd ? (
            <button
              type="button"
              className="btn btn-ghost !px-5 !py-2.5 text-[11px]"
              disabled={pending !== null}
              onClick={() => act("reactivate")}
            >
              Kündigung zurücknehmen
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost !px-5 !py-2.5 text-[11px]"
              disabled={pending !== null}
              onClick={() => act("cancel_at_period_end")}
            >
              Zum Periodenende kündigen
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost !px-5 !py-2.5 text-[11px]"
            disabled={pending !== null}
            onClick={() => act("cancel")}
          >
            Sofort kündigen
          </button>
        </div>
      )}
    </div>
  );
}
