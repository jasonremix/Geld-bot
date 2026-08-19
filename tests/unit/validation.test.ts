import { beforeEach, describe, expect, it } from "vitest";
import {
  checkoutSchema,
  loginSchema,
  passwordResetConfirmSchema,
  planUpdateSchema,
  productCreateSchema,
  refundSchema,
  registerSchema,
  formatZodError,
} from "../../src/lib/validation";
import { rateLimit, resetRateLimits } from "../../src/lib/security/rate-limit";
import { generateOrderNumber } from "../../src/lib/orders";

describe("Eingabevalidierung", () => {
  it("normalisiert E-Mail-Adressen", () => {
    const result = registerSchema.safeParse({
      email: "  MAX@Example.TEST ",
      password: "sicheres-passwort-1",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("max@example.test");
  });

  it("verlangt ausreichend starke Passwörter", () => {
    expect(registerSchema.safeParse({ email: "a@b.test", password: "kurz" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.test", password: "nurbuchstaben" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.test", password: "1234567890" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.test", password: "passwort-1234" }).success).toBe(true);
  });

  it("lehnt ungültige E-Mail-Adressen ab", () => {
    const result = registerSchema.safeParse({ email: "keine-email", password: "passwort-1234" });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatZodError(result.error).email).toBeTruthy();
  });

  it("verlangt die Zustimmung zu AGB und Widerruf im Checkout", () => {
    const base = { planKey: "pro", email: "a@b.test", paymentMethod: "card" as const };
    expect(checkoutSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, acceptTerms: true }).success).toBe(true);
  });

  it("akzeptiert im Login beliebige Passwortlängen, aber nicht leer", () => {
    expect(loginSchema.safeParse({ email: "a@b.test", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.test", password: "x" }).success).toBe(true);
  });

  it("begrenzt Plan-Preise auf sinnvolle Werte", () => {
    expect(planUpdateSchema.safeParse({ planId: "p1", priceCents: -100 }).success).toBe(false);
    expect(planUpdateSchema.safeParse({ planId: "p1", priceCents: 1999 }).success).toBe(true);
  });

  it("erzwingt saubere Produkt-Slugs", () => {
    const base = { title: "Neon Drums", type: "SAMPLE_PACK" as const, minTier: 1 };
    expect(productCreateSchema.safeParse({ ...base, slug: "Neon Drums" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...base, slug: "neon-drums" }).success).toBe(true);
    expect(productCreateSchema.safeParse({ ...base, slug: "neon-drums", minTier: 9 }).success).toBe(false);
  });

  it("lässt nur positive Erstattungsbeträge zu", () => {
    expect(refundSchema.safeParse({ paymentId: "pay_1", amountCents: 0 }).success).toBe(false);
    expect(refundSchema.safeParse({ paymentId: "pay_1", amountCents: 500 }).success).toBe(true);
    expect(refundSchema.safeParse({ paymentId: "pay_1" }).success).toBe(true);
  });

  it("verlangt beim Passwort-Reset Token und starkes Passwort", () => {
    expect(passwordResetConfirmSchema.safeParse({ token: "kurz", password: "passwort-1234" }).success).toBe(
      false,
    );
    expect(
      passwordResetConfirmSchema.safeParse({ token: "a".repeat(24), password: "passwort-1234" }).success,
    ).toBe(true);
  });
});

describe("Rate Limiting", () => {
  beforeEach(async () => {
    await resetRateLimits();
  });

  it("blockiert nach Erreichen des Limits", async () => {
    let last = await rateLimit("login", "ip-1");
    for (let i = 1; i < 8; i += 1) {
      last = await rateLimit("login", "ip-1");
      expect(last.allowed).toBe(true);
    }

    const blocked = await rateLimit("login", "ip-1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("zählt getrennt je Identifikator", async () => {
    for (let i = 0; i < 8; i += 1) await rateLimit("login", "ip-2");
    expect((await rateLimit("login", "ip-2")).allowed).toBe(false);
    expect((await rateLimit("login", "ip-3")).allowed).toBe(true);
  });

  it("lässt sich für Tests deaktivieren", async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await rateLimit("login", "ip-4", true)).allowed).toBe(true);
    }
  });
});

describe("Bestellnummern", () => {
  it("erzeugt eindeutige, nicht fortlaufende Nummern", () => {
    const numbers = new Set(Array.from({ length: 200 }, () => generateOrderNumber()));
    expect(numbers.size).toBe(200);
    expect([...numbers][0]).toMatch(/^GB-\d{8}-[0-9A-F]{8}$/);
  });
});
