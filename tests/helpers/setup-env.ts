/** Environment für alle Tests: Sandbox-Provider, Test-Datenbank, feste Secrets. */
const TEST_SECRET = "test-secret-test-secret-test-secret-0123456789";

// Object.assign statt Einzelzuweisungen: NODE_ENV ist in den Node-Typen read-only.
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/geldbot_test?schema=public",
  APP_URL: process.env.TEST_APP_URL ?? "http://127.0.0.1:3111",
  AUTH_SECRET: TEST_SECRET,
  CSRF_SECRET: TEST_SECRET,
  DOWNLOAD_SIGNING_SECRET: TEST_SECRET,
  PAYMENT_PROVIDER: "sandbox",
  PAYMENT_WEBHOOK_SECRET: "test-webhook-secret-0123456789",
  MAIL_TRANSPORT: "log",
  RATE_LIMIT_DISABLED: "true",
  STORAGE_LOCAL_PATH: "./storage-test",
  GRACE_PERIOD_DAYS: "3",
  INVOICE_TAX_RATE_BP: "1900",
});
