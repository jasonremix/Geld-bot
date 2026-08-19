import "server-only";
import { z } from "zod";

/**
 * Zentrale, validierte Konfiguration.
 *
 * Regeln:
 *  - Es stehen ausschliesslich Environment-Variablen als Quelle zur Verfuegung.
 *  - Es werden niemals Secrets geloggt oder an den Client gegeben.
 *  - Fehlende Pflichtwerte fuehren in Produktion zu einem harten Fehler,
 *    in Entwicklung/Test zu sicheren Dummy-Defaults.
 */

const isProd = process.env.NODE_ENV === "production";

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-please-override-32chars";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),

  // --- Auth / Krypto -------------------------------------------------------
  AUTH_SECRET: z.string().min(32),
  DOWNLOAD_SIGNING_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),

  // --- Payments ------------------------------------------------------------
  PAYMENT_PROVIDER: z.enum(["sandbox", "stripe", "revolut"]).default("sandbox"),
  PAYMENT_PROVIDER_SECRET: z.string().default(""),
  PAYMENT_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().default(""),

  // --- Revolut Merchant / Business ----------------------------------------
  REVOLUT_MERCHANT_API_KEY: z.string().default(""),
  REVOLUT_PUBLIC_KEY: z.string().default(""),
  REVOLUT_ACCOUNT_ID: z.string().default(""),
  REVOLUT_API_BASE: z.string().default("https://sandbox-merchant.revolut.com"),
  REVOLUT_BUSINESS_API_BASE: z.string().default("https://sandbox-b2b.revolut.com/api/1.0"),
  REVOLUT_BUSINESS_ACCESS_TOKEN: z.string().default(""),
  REVOLUT_WEBHOOK_SECRET: z.string().default(""),

  // --- Rechnungsdaten (Platzhalter bis konfiguriert) -----------------------
  BUSINESS_NAME: z.string().default("CONFIGURE_ME"),
  BUSINESS_ADDRESS: z.string().default("CONFIGURE_ME"),
  BUSINESS_EMAIL: z.string().default("CONFIGURE_ME"),
  TAX_ID: z.string().default("CONFIGURE_ME"),
  VAT_ID: z.string().default("CONFIGURE_ME"),
  SUPPORT_EMAIL: z.string().default("CONFIGURE_ME"),
  INVOICE_TAX_RATE_BP: z.coerce.number().int().min(0).max(10000).default(0),
  INVOICE_NUMBER_PREFIX: z.string().default("INV"),

  // --- E-Mail --------------------------------------------------------------
  MAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  MAIL_FROM: z.string().default("Geld-bot <no-reply@example.invalid>"),

  // --- Storage -------------------------------------------------------------
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().default(512 * 1024 * 1024),
  DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().default(300),

  // --- Betrieb -------------------------------------------------------------
  RATE_LIMIT_DISABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  GRACE_PERIOD_DAYS: z.coerce.number().int().min(0).default(3),
});

export type Env = z.infer<typeof schema>;

function devDefaults(): Record<string, string> {
  if (isProd) return {};
  return {
    AUTH_SECRET: DEV_FALLBACK_SECRET,
    DOWNLOAD_SIGNING_SECRET: DEV_FALLBACK_SECRET,
    CSRF_SECRET: DEV_FALLBACK_SECRET,
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/geldbot?schema=public",
  };
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const raw = { ...devDefaults(), ...process.env } as Record<string, string | undefined>;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    // Nur Variablennamen ausgeben – niemals Werte.
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Ungültige oder fehlende Environment-Variablen: ${missing}. Siehe .env.example.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Nur für Tests: erzwingt eine Neuvalidierung. */
export function resetEnvCache(): void {
  cached = null;
}

/** Rechnungs-/Impressumsdaten inkl. Kennzeichnung nicht konfigurierter Felder. */
export function businessConfig() {
  const env = getEnv();
  const value = (v: string) => (v && v !== "CONFIGURE_ME" ? v : null);
  return {
    name: value(env.BUSINESS_NAME),
    address: value(env.BUSINESS_ADDRESS),
    email: value(env.BUSINESS_EMAIL),
    taxId: value(env.TAX_ID),
    vatId: value(env.VAT_ID),
    supportEmail: value(env.SUPPORT_EMAIL),
    isConfigured:
      Boolean(value(env.BUSINESS_NAME)) &&
      Boolean(value(env.BUSINESS_ADDRESS)) &&
      Boolean(value(env.SUPPORT_EMAIL)),
  };
}
