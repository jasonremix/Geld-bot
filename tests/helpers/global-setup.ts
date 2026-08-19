import { execSync } from "node:child_process";

/** Legt das Schema in der Testdatenbank an, bevor die Tests laufen. */
export default function setup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/geldbot_test?schema=public";

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}
