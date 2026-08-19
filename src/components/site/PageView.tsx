"use client";

import { useEffect } from "react";

/**
 * Erfasst einen anonymen Seitenaufruf für die Conversion-Auswertung.
 * Es werden keine personenbezogenen Merkmale und keine Cookies Dritter genutzt;
 * die Session-ID ist eine zufällige ID im sessionStorage.
 */
export function PageView({ type = "page_view", planKey }: { type?: string; planKey?: string }) {
  useEffect(() => {
    let sessionId = sessionStorage.getItem("gb_anon");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("gb_anon", sessionId);
    }

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, path: window.location.pathname, planKey, sessionId }),
      keepalive: true,
    }).catch(() => {
      // Analytics darf die Seite niemals beeinträchtigen.
    });
  }, [type, planKey]);

  return null;
}
