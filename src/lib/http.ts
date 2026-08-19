import { NextResponse } from "next/server";

export type ApiError = {
  error: string;
  message: string;
  details?: unknown;
};

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, { status: 200, ...init });
}

export function jsonError(
  status: number,
  error: string,
  message: string,
  details?: unknown,
): NextResponse {
  const body: ApiError = { error, message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

/** Client-IP aus den üblichen Proxy-Headern; fällt auf "unknown" zurück. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function tooManyRequests(resetAt: number): NextResponse {
  const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "rate_limited", message: `Zu viele Anfragen. Bitte in ${seconds} Sekunden erneut versuchen.` },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  );
}
