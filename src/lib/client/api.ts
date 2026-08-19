"use client";

/** Client-Helfer für API-Aufrufe inklusive CSRF-Header. */

export function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)gb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : "";
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message: string; details?: Record<string, string> };

export async function apiSend<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": readCsrfToken(),
      },
      body: method === "DELETE" && body === undefined ? undefined : JSON.stringify(body ?? {}),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false,
        error: String(data.error ?? "request_failed"),
        message: String(data.message ?? "Anfrage fehlgeschlagen."),
        details: (data.details as Record<string, string>) ?? undefined,
      };
    }

    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "network_error", message: "Netzwerkfehler. Bitte erneut versuchen." };
  }
}

export async function apiUpload<T = Record<string, unknown>>(
  url: string,
  form: FormData,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-csrf-token": readCsrfToken() },
      body: form,
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        error: String(data.error ?? "request_failed"),
        message: String(data.message ?? "Upload fehlgeschlagen."),
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "network_error", message: "Netzwerkfehler. Bitte erneut versuchen." };
  }
}
