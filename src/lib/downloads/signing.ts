import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signierte, kurzlebige Download-Tokens.
 *
 * Ein Token bindet Datei-ID und Nutzer-ID zusammen und läuft nach kurzer Zeit
 * ab. Dateipfade sind dadurch weder erratbar noch teilbar: ohne gültige
 * Signatur UND passende Session gibt es keinen Zugriff.
 */
export type DownloadTokenPayload = {
  /** ProductFile-ID */
  f: string;
  /** User-ID */
  u: string;
  /** Ablaufzeitpunkt (Unix-Sekunden) */
  e: number;
  /** Token-ID für das Download-Log */
  j: string;
};

function sign(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createDownloadToken(
  input: { fileId: string; userId: string; ttlSeconds: number },
  secret: string,
  now = Date.now(),
): { token: string; tokenId: string; expiresAt: Date } {
  const tokenId = randomBytes(9).toString("base64url");
  const payload: DownloadTokenPayload = {
    f: input.fileId,
    u: input.userId,
    e: Math.floor(now / 1000) + input.ttlSeconds,
    j: tokenId,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${encoded}.${sign(secret, encoded)}`,
    tokenId,
    expiresAt: new Date(payload.e * 1000),
  };
}

export type TokenVerification =
  | { ok: true; payload: DownloadTokenPayload }
  | { ok: false; reason: "malformed" | "signature_invalid" | "expired" };

export function verifyDownloadToken(
  token: string,
  secret: string,
  now = Date.now(),
): TokenVerification {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return { ok: false, reason: "malformed" };

  const expected = sign(secret, encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_invalid" };
  }

  let payload: DownloadTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DownloadTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!payload.f || !payload.u || typeof payload.e !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (payload.e * 1000 <= now) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}
