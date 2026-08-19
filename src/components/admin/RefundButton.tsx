"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";

/** Löst eine Erstattung beim Payment Provider aus (nur mit refunds:write). */
export function RefundButton({
  paymentId,
  maxCents,
  currency,
}: {
  paymentId: string;
  maxCents: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (maxCents <= 0) {
    return <span className="text-xs text-[var(--color-muted-2)]">vollständig erstattet</span>;
  }

  async function refund() {
    if (!confirm(`Erstattung über ${formatMoney(maxCents, currency)} auslösen?`)) return;

    setPending(true);
    setMessage(null);

    const result = await apiSend<{ note: string }>("/api/admin/refunds", {
      paymentId,
      amountCents: maxCents,
      reason: "requested_by_customer",
    });

    setPending(false);
    setMessage(result.ok ? result.data.note : result.message);
    if (result.ok) router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-ghost !px-4 !py-2 text-[10px]"
        onClick={refund}
        disabled={pending}
      >
        {pending ? "…" : "Erstatten"}
      </button>
      {message && <span className="max-w-[220px] text-right text-[10px] text-[var(--color-muted)]">{message}</span>}
    </span>
  );
}
