"use client";

import { useState } from "react";
import { apiSend } from "@/lib/client/api";

/**
 * Fordert eine signierte, kurzlebige Download-URL an und startet den Download.
 * Der Dateipfad selbst wird nie im Frontend offengelegt.
 */
export function DownloadButton({
  fileId,
  filename,
  disabled,
  className = "btn btn-ghost !px-5 !py-2.5 text-[11px]",
}: {
  fileId: string;
  filename: string;
  disabled?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);

    const result = await apiSend<{ url: string }>(`/api/downloads/${fileId}`, {});
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    window.location.assign(result.data.url);
    setPending(false);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} onClick={start} disabled={pending || disabled}>
        {pending ? "Link wird erstellt …" : `Download ${filename ? "" : ""}`.trim()}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </span>
  );
}
