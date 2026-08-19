import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { createClient, startServer, type TestClient } from "../helpers/http";
import { db, resetDatabase } from "../helpers/db";

/**
 * End-to-End-Test über HTTP gegen den echten Next.js-Server.
 *
 * Abgedeckt: Registrierung, Login, CSRF-Schutz, Checkout, verifizierter
 * Webhook (Sandbox), automatische Freischaltung, geschützter Download und
 * Admin-Autorisierung.
 */
const PORT = 3111;

let server: { url: string; stop: () => void };
let client: TestClient;
let fileId: string;

beforeAll(async () => {
  await resetDatabase();

  // Testinhalt anlegen: Produkt (Tier 1) mit echter Datei im Test-Storage.
  const product = await db.product.create({
    data: {
      slug: "e2e-pack",
      title: "[TEST] E2E Pack",
      type: "SAMPLE_PACK",
      minTier: 1,
      published: true,
      isDemo: true,
    },
  });

  const storageKey = path.posix.join("products", product.id, "e2e-loop.wav");
  const target = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH!, storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  const content = Buffer.from("RIFF----WAVEfmt E2E-TESTDATEI");
  await writeFile(target, content);

  const file = await db.productFile.create({
    data: {
      productId: product.id,
      filename: "e2e-loop.wav",
      storageKey,
      mimeType: "audio/wav",
      kind: "WAV",
      sizeBytes: content.byteLength,
    },
  });
  fileId = file.id;

  // Admin-Account für die Autorisierungsprüfungen.
  const admin = await db.user.create({
    data: {
      email: "e2e-admin@example.test",
      passwordHash: await bcrypt.hash("admin-passwort-1", 10),
      role: "ADMIN",
      adminUser: { create: { adminRole: "OWNER" } },
    },
  });
  expect(admin.role).toBe("ADMIN");

  server = await startServer(PORT);
  client = createClient(server.url);
}, 180_000);

afterAll(() => {
  server?.stop();
});

describe("Öffentliche Seiten", () => {
  it("liefert die Landingpage mit Hero und Preisen aus", async () => {
    const response = await client.get("/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Make Music.");
    expect(html).toContain("Go Further.");
    // Preise aus der Datenbank
    expect(html).toContain("9,99");
    expect(html).toContain("19,99");
    expect(html).toContain("39,99");
  });

  it("setzt ein CSRF-Cookie", async () => {
    await client.get("/");
    expect(client.jar.get("gb_csrf")).toBeTruthy();
  });

  it("liefert robots.txt und sitemap.xml", async () => {
    const robots = await client.get("/robots.txt");
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await client.get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });

  it("zeigt rechtliche Seiten mit CONFIGURE_ME statt erfundener Angaben", async () => {
    for (const route of ["/impressum", "/datenschutz", "/agb", "/widerruf"]) {
      const response = await client.get(route);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("CONFIGURE_ME");
    }
  });
});

describe("Zugriffsschutz", () => {
  it("leitet /dashboard ohne Session zum Login", async () => {
    const response = await client.get("/dashboard");
    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("leitet /admin ohne Session zum Login", async () => {
    const response = await client.get("/admin");
    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("weist Anfragen ohne CSRF-Token ab", async () => {
    const response = await fetch(`${server.url}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "csrf@example.test", password: "passwort-1234" }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("csrf_failed");
  });

  it("weist Webhooks ohne gültige Signatur ab", async () => {
    const response = await fetch(`${server.url}/api/webhooks/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "evt_fake", type: "payment_succeeded", data: {} }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_signature");
  });
});

describe("Registrierung, Kauf und Zugang", () => {
  const email = "e2e-kunde@example.test";

  it("registriert einen neuen Kunden", async () => {
    await client.get("/");
    const response = await client.post("/api/auth/register", {
      email,
      password: "sicheres-passwort-1",
      name: "E2E Kunde",
    });

    expect(response.status).toBe(200);
    expect(await client.json<{ redirect: string }>(response)).toMatchObject({ redirect: "/dashboard" });
    expect(client.jar.get("gb_session")).toBeTruthy();
  });

  it("erlaubt Zugriff auf das Dashboard", async () => {
    const response = await client.get("/dashboard");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Kein aktives Abo");
  });

  it("verweigert den Download ohne Abo", async () => {
    const response = await client.post(`/api/downloads/${fileId}`);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("not_entitled");
  });

  it("startet den Checkout und erhält eine Sandbox-Zahlungs-URL", async () => {
    const response = await client.post("/api/checkout/session", {
      planKey: "pro",
      email,
      paymentMethod: "card",
      acceptTerms: true,
    });

    expect(response.status).toBe(200);
    const data = await client.json<{ url: string; orderNumber: string; sandbox: boolean }>(response);
    expect(data.sandbox).toBe(true);
    expect(data.url).toContain("/checkout/sandbox");

    const order = await db.order.findUniqueOrThrow({ where: { number: data.orderNumber } });
    // Vor der Zahlung ist die Bestellung ausdrücklich NICHT bezahlt.
    expect(order.status).toBe("PENDING");

    const params = new URL(data.url).searchParams;
    const simulate = await client.post("/api/sandbox/simulate", {
      outcome: "success",
      orderNumber: data.orderNumber,
      paymentId: params.get("payment"),
      planKey: "pro",
      email,
      amountCents: 1999,
      currency: "EUR",
    });

    expect(simulate.status).toBe(200);
    const result = await client.json<{ webhookStatus: number; redirect: string }>(simulate);
    expect(result.webhookStatus).toBe(200);

    const paid = await db.order.findUniqueOrThrow({ where: { number: data.orderNumber } });
    expect(paid.status).toBe("PAID");

    const success = await client.get(result.redirect);
    expect(await success.text()).toContain("Zugang freigeschaltet.");
  });

  it("schaltet die Library frei und liefert die Datei aus", async () => {
    const library = await client.get("/dashboard/library");
    expect(await library.text()).toContain("e2e-loop.wav");

    const link = await client.post(`/api/downloads/${fileId}`);
    expect(link.status).toBe(200);
    const { url } = await client.json<{ url: string }>(link);
    expect(url).toMatch(/^\/api\/files\//);

    const download = await client.get(url);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain("e2e-loop.wav");
    expect(await download.text()).toContain("E2E-TESTDATEI");

    const logged = await db.download.count();
    expect(logged).toBe(1);
  });

  it("verweigert einen fremden Download-Link", async () => {
    const link = await client.post(`/api/downloads/${fileId}`);
    const { url } = await client.json<{ url: string }>(link);

    const other = createClient(server.url);
    await other.get("/");
    await other.post("/api/auth/register", {
      email: "e2e-fremd@example.test",
      password: "sicheres-passwort-2",
    });

    const response = await other.get(url);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("token_user_mismatch");
  });

  it("erstellt eine Rechnung im Kundenbereich", async () => {
    const response = await client.get("/dashboard/invoices");
    const html = await response.text();
    expect(html).toContain("INV-");
    expect(html).toContain("19,99");
  });

  it("erlaubt die Kündigung zum Periodenende", async () => {
    const subscription = await db.subscription.findFirstOrThrow({
      where: { customer: { user: { email: "e2e-kunde@example.test" } } },
    });

    const response = await client.post("/api/account/subscription", {
      subscriptionId: subscription.id,
      action: "cancel_at_period_end",
    });
    expect(response.status).toBe(200);

    const updated = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(updated.cancelAtPeriodEnd).toBe(true);
    // Der Zugang bleibt bis zum Periodenende bestehen.
    expect(updated.status).toBe("ACTIVE");
  });
});

describe("Admin-Autorisierung", () => {
  it("versteckt Admin-APIs vor normalen Kunden (404)", async () => {
    const plan = await db.plan.findUniqueOrThrow({ where: { key: "pro" } });
    const response = await client.patch("/api/admin/plans", { planId: plan.id, priceCents: 100 });
    expect(response.status).toBe(404);

    const unchanged = await db.plan.findUniqueOrThrow({ where: { key: "pro" } });
    expect(unchanged.priceCents).toBe(1999);
  });

  it("leitet Kunden von /admin auf das Dashboard um", async () => {
    const response = await client.get("/admin");
    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("lässt Administratoren Preise ändern", async () => {
    const admin = createClient(server.url);
    await admin.get("/");

    const login = await admin.post("/api/auth/login", {
      email: "e2e-admin@example.test",
      password: "admin-passwort-1",
    });
    expect(login.status).toBe(200);
    expect(await admin.json<{ redirect: string }>(login)).toMatchObject({ redirect: "/admin" });

    const dashboard = await admin.get("/admin");
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain("Umsatz heute");

    const plan = await db.plan.findUniqueOrThrow({ where: { key: "starter" } });
    const update = await admin.patch("/api/admin/plans", { planId: plan.id, priceCents: 1199 });
    expect(update.status).toBe(200);

    const updated = await db.plan.findUniqueOrThrow({ where: { key: "starter" } });
    expect(updated.priceCents).toBe(1199);

    // Preisänderung wirkt sofort auf der Landingpage.
    const landing = await admin.get("/");
    expect(await landing.text()).toContain("11,99");

    const audit = await db.auditLog.findFirst({ where: { action: "plan.updated" } });
    expect(audit).not.toBeNull();
  });

  it("zeigt im Auszahlungsbereich keine erfundenen Werte", async () => {
    const admin = createClient(server.url);
    await admin.get("/");
    await admin.post("/api/auth/login", {
      email: "e2e-admin@example.test",
      password: "admin-passwort-1",
    });

    const response = await admin.get("/admin/payouts");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Nicht verfügbar");
    expect(html).toContain("Keine Auszahlungsdaten vom Provider");
  });

  it("weist falsche Zugangsdaten ab", async () => {
    const guest = createClient(server.url);
    await guest.get("/");
    const response = await guest.post("/api/auth/login", {
      email: "e2e-admin@example.test",
      password: "falsches-passwort",
    });

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("invalid_credentials");
    expect(guest.jar.get("gb_session")).toBeFalsy();
  });
});

describe("Abmelden", () => {
  it("beendet die Session", async () => {
    const response = await client.post("/api/auth/logout");
    expect(response.status).toBe(200);

    const dashboard = await client.get("/dashboard");
    expect([302, 307]).toContain(dashboard.status);
    expect(dashboard.headers.get("location")).toContain("/login");
  });
});
