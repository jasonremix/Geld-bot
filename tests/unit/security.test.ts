import { describe, expect, it } from "vitest";
import {
  createTimestampedSignature,
  hmacSha256Hex,
  safeCompare,
  verifyTimestampedSignature,
} from "../../src/lib/payments/signature";
import { isValidCsrfToken, issueCsrfToken, checkCsrf } from "../../src/lib/security/csrf";
import { createDownloadToken, verifyDownloadToken } from "../../src/lib/downloads/signing";
import { canAccess } from "../../src/lib/entitlements";
import { hasPermission, permissionsForRole } from "../../src/lib/auth/rbac";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password";
import { splitGross, parseMoneyToCents } from "../../src/lib/money";
import { validateUpload, sanitizeFilename } from "../../src/lib/downloads/storage";
import { redact } from "../../src/lib/security/audit";

const SECRET = "test-webhook-secret-0123456789";

describe("Webhook-Signaturen", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "payment_succeeded" });

  it("akzeptiert eine gültige Signatur", () => {
    const header = createTimestampedSignature(SECRET, payload);
    expect(verifyTimestampedSignature({ header, payload, secret: SECRET })).toEqual({ ok: true });
  });

  it("lehnt eine manipulierte Nutzlast ab", () => {
    const header = createTimestampedSignature(SECRET, payload);
    const result = verifyTimestampedSignature({
      header,
      payload: payload.replace("evt_1", "evt_2"),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("lehnt ein falsches Secret ab", () => {
    const header = createTimestampedSignature("anderes-secret-0123456789", payload);
    expect(verifyTimestampedSignature({ header, payload, secret: SECRET })).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
  });

  it("lehnt einen zu alten Zeitstempel ab (Replay-Schutz)", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const header = createTimestampedSignature(SECRET, payload, old);
    expect(verifyTimestampedSignature({ header, payload, secret: SECRET })).toEqual({
      ok: false,
      reason: "signature_timestamp_out_of_tolerance",
    });
  });

  it("lehnt eine fehlende Signatur ab", () => {
    expect(verifyTimestampedSignature({ header: null, payload, secret: SECRET })).toEqual({
      ok: false,
      reason: "signature_missing",
    });
  });

  it("lehnt ohne konfiguriertes Secret ab", () => {
    expect(verifyTimestampedSignature({ header: "t=1,v1=abc", payload, secret: "" })).toEqual({
      ok: false,
      reason: "webhook_secret_missing",
    });
  });

  it("vergleicht zeitkonstant und längensicher", () => {
    expect(safeCompare(hmacSha256Hex(SECRET, "a"), hmacSha256Hex(SECRET, "a"))).toBe(true);
    expect(safeCompare("kurz", "laenger")).toBe(false);
  });
});

describe("CSRF", () => {
  it("erkennt eigene Tokens und lehnt fremde ab", () => {
    const token = issueCsrfToken();
    expect(isValidCsrfToken(token)).toBe(true);
    expect(isValidCsrfToken("abc.def")).toBe(false);
    expect(isValidCsrfToken(undefined)).toBe(false);
  });

  it("verlangt Übereinstimmung von Header und Cookie", () => {
    const token = issueCsrfToken();
    const other = issueCsrfToken();

    const request = (headerToken?: string) =>
      new Request("http://localhost:3111/api/test", {
        method: "POST",
        headers: headerToken ? { "x-csrf-token": headerToken } : {},
      });

    expect(checkCsrf(request(token), token)).toEqual({ ok: true });
    expect(checkCsrf(request(other), token).ok).toBe(false);
    expect(checkCsrf(request(), token).ok).toBe(false);
    expect(checkCsrf(request(token), undefined).ok).toBe(false);
  });

  it("lehnt fremde Origins ab", () => {
    const token = issueCsrfToken();
    const request = new Request("http://localhost:3111/api/test", {
      method: "POST",
      headers: { "x-csrf-token": token, origin: "https://angreifer.example" },
    });
    expect(checkCsrf(request, token)).toEqual({ ok: false, reason: "origin_mismatch" });
  });
});

describe("Download-Tokens", () => {
  const secret = "download-secret-download-secret-0123456789";

  it("erzeugt und verifiziert ein Token", () => {
    const { token } = createDownloadToken({ fileId: "file_1", userId: "user_1", ttlSeconds: 300 }, secret);
    const result = verifyDownloadToken(token, secret);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.f).toBe("file_1");
      expect(result.payload.u).toBe("user_1");
    }
  });

  it("lehnt ein abgelaufenes Token ab", () => {
    const { token } = createDownloadToken(
      { fileId: "file_1", userId: "user_1", ttlSeconds: 60 },
      secret,
      Date.now() - 120_000,
    );
    expect(verifyDownloadToken(token, secret)).toEqual({ ok: false, reason: "expired" });
  });

  it("lehnt eine manipulierte Nutzlast ab", () => {
    const { token } = createDownloadToken({ fileId: "file_1", userId: "user_1", ttlSeconds: 300 }, secret);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ f: "file_2", u: "user_1", e: Math.floor(Date.now() / 1000) + 300, j: "x" }),
    ).toString("base64url");
    expect(verifyDownloadToken(`${forged}.${signature}`, secret)).toEqual({
      ok: false,
      reason: "signature_invalid",
    });
  });

  it("lehnt ein Token mit fremdem Secret ab", () => {
    const { token } = createDownloadToken({ fileId: "file_1", userId: "user_1", ttlSeconds: 300 }, secret);
    expect(verifyDownloadToken(token, "anderes-secret-anderes-secret-0123456789").ok).toBe(false);
  });
});

describe("Zugriffsstufen", () => {
  it("schaltet nur gleiche oder niedrigere Tiers frei", () => {
    expect(canAccess(3, 1)).toBe(true);
    expect(canAccess(2, 2)).toBe(true);
    expect(canAccess(1, 2)).toBe(false);
    expect(canAccess(0, 1)).toBe(false);
  });
});

describe("Rollen und Rechte", () => {
  it("gibt SUPPORT keine Geldflussrechte", () => {
    expect(hasPermission({ adminRole: "SUPPORT", permissions: [] }, "orders:read")).toBe(true);
    expect(hasPermission({ adminRole: "SUPPORT", permissions: [] }, "refunds:write")).toBe(false);
    expect(hasPermission({ adminRole: "SUPPORT", permissions: [] }, "payouts:read")).toBe(false);
  });

  it("gibt OWNER alle Rechte", () => {
    expect(hasPermission({ adminRole: "OWNER", permissions: [] }, "settings:write")).toBe(true);
    expect(permissionsForRole("OWNER").length).toBeGreaterThan(permissionsForRole("SUPPORT").length);
  });

  it("verweigert ohne Admin-Rolle alles", () => {
    expect(hasPermission({ adminRole: null, permissions: ["settings:write"] }, "settings:write")).toBe(
      false,
    );
  });

  it("berücksichtigt zusätzlich vergebene Einzelrechte", () => {
    expect(hasPermission({ adminRole: "SUPPORT", permissions: ["payouts:read"] }, "payouts:read")).toBe(
      true,
    );
  });
});

describe("Passwörter", () => {
  it("hasht und prüft Passwörter", async () => {
    const hash = await hashPassword("sicheres-passwort-1");
    expect(hash).not.toContain("sicheres-passwort-1");
    expect(await verifyPassword("sicheres-passwort-1", hash)).toBe(true);
    expect(await verifyPassword("falsch", hash)).toBe(false);
  });
});

describe("Beträge", () => {
  it("teilt Bruttobeträge korrekt", () => {
    expect(splitGross(1999, 1900)).toEqual({ netCents: 1680, taxCents: 319 });
    expect(splitGross(1999, 0)).toEqual({ netCents: 1999, taxCents: 0 });
  });

  it("liest deutsche und englische Eingaben", () => {
    expect(parseMoneyToCents("19,99")).toBe(1999);
    expect(parseMoneyToCents("19.99")).toBe(1999);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
});

describe("Upload-Validierung", () => {
  it("akzeptiert erlaubte Formate", () => {
    expect(
      validateUpload({ filename: "loop.wav", mimeType: "audio/wav", sizeBytes: 1024, maxBytes: 10_000 }),
    ).toEqual({ ok: true, kind: "WAV" });
  });

  it("lehnt ausführbare Dateien ab", () => {
    const result = validateUpload({
      filename: "böse.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 10,
      maxBytes: 10_000,
    });
    expect(result.ok).toBe(false);
  });

  it("lehnt eine unpassende Endung ab", () => {
    const result = validateUpload({
      filename: "loop.exe",
      mimeType: "audio/wav",
      sizeBytes: 10,
      maxBytes: 10_000,
    });
    expect(result.ok).toBe(false);
  });

  it("lehnt zu grosse Dateien ab", () => {
    const result = validateUpload({
      filename: "loop.wav",
      mimeType: "audio/wav",
      sizeBytes: 20_000,
      maxBytes: 10_000,
    });
    expect(result.ok).toBe(false);
  });

  it("entschärft Pfadangriffe im Dateinamen", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("mein sound.wav")).toBe("mein_sound.wav");
  });
});

describe("Audit-Log", () => {
  it("entfernt sensible Felder", () => {
    const result = redact({
      apiKey: "geheim",
      nested: { authorization: "Bearer x", ok: 1 },
      iban: "DE00",
      plan: "pro",
    });
    expect(result).toEqual({
      apiKey: "[redacted]",
      nested: { authorization: "[redacted]", ok: 1 },
      iban: "[redacted]",
      plan: "pro",
    });
  });
});
