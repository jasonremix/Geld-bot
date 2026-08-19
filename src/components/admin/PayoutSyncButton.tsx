"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";

export function PayoutSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost !px-5 !py-2.5 text-[11px]"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage(null);
          const result = await apiSend<{ available: boolean; synced: number; reason?: string }>(
            "/api/admin/payouts/sync",
          );
          setPending(false);

          if (!result.ok) {
            setMessage(result.message);
            return;
          }

          setMessage(
            result.data.available
              ? `${result.data.synced} Auszahlung(en) synchronisiert.`
              : (result.data.reason ?? "Keine Auszahlungsdaten verfügbar."),
          );
          router.refresh();
        }}
      >
        {pending ? "Wird abgerufen …" : "Vom Provider aktualisieren"}
      </button>
      {message && <p className="mt-3 max-w-lg text-xs text-[var(--color-muted)]">{message}</p>}
    </div>
  );
}
