"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";

export function SandboxSimulator(props: {
  orderNumber: string;
  paymentId: string;
  planKey: string;
  email: string;
  amountCents: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(outcome: "success" | "failure") {
    setPending(outcome);
    setError(null);

    const result = await apiSend<{ redirect: string }>("/api/sandbox/simulate", {
      outcome,
      orderNumber: props.orderNumber,
      paymentId: props.paymentId,
      planKey: props.planKey,
      email: props.email,
      amountCents: props.amountCents,
      currency: props.currency,
    });

    if (!result.ok) {
      setError(result.message);
      setPending(null);
      return;
    }

    router.push(result.data.redirect);
    router.refresh();
  }

  return (
    <div className="mt-10">
      {error && (
        <p role="alert" className="mb-5 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending !== null}
          onClick={() => simulate("success")}
        >
          {pending === "success" ? "Wird verarbeitet …" : "Erfolgreiche Zahlung simulieren"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending !== null}
          onClick={() => simulate("failure")}
        >
          {pending === "failure" ? "Wird verarbeitet …" : "Fehlgeschlagene Zahlung simulieren"}
        </button>
      </div>
    </div>
  );
}
