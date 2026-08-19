import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 als Hex – gemeinsame Basis der Webhook-Signaturprüfung. */
export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Zeitkonstanter Vergleich zweier Hex-Signaturen. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Prüft eine Signatur der Form `t=<unix>,v1=<hex>` gegen
 * HMAC(secret, `${t}.${payload}`) und lehnt zu alte Zeitstempel ab
 * (Schutz gegen Replay-Angriffe).
 */
export function verifyTimestampedSignature(options: {
  header: string | null;
  payload: string;
  secret: string;
  toleranceSeconds?: number;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { header, payload, secret } = options;
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ?? Date.now();

  if (!secret) return { ok: false, reason: "webhook_secret_missing" };
  if (!header) return { ok: false, reason: "signature_missing" };

  const parts = Object.fromEntries(
    header
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((p) => p.length === 2) as [string, string][],
  );

  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return { ok: false, reason: "signature_malformed" };

  const ageSeconds = Math.abs(now / 1000 - timestamp);
  if (ageSeconds > tolerance) return { ok: false, reason: "signature_timestamp_out_of_tolerance" };

  const expected = hmacSha256Hex(secret, `${timestamp}.${payload}`);
  if (!safeCompare(signature, expected)) return { ok: false, reason: "signature_mismatch" };

  return { ok: true };
}

/** Erzeugt einen Signatur-Header im obigen Format (Sandbox/Tests). */
export function createTimestampedSignature(
  secret: string,
  payload: string,
  timestampSeconds = Math.floor(Date.now() / 1000),
): string {
  return `t=${timestampSeconds},v1=${hmacSha256Hex(secret, `${timestampSeconds}.${payload}`)}`;
}
