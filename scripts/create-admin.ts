/**
 * Legt einen Administrator-Account an oder hebt einen bestehenden Account an.
 *
 * Verwendung:
 *   npm run create:admin -- admin@example.com "sicheres-passwort" [OWNER|FINANCE|SUPPORT]
 *
 * Das Passwort wird ausschliesslich als bcrypt-Hash gespeichert und nie geloggt.
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [email, password, roleArg] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Verwendung: npm run create:admin -- <email> "<passwort>" [OWNER|FINANCE|SUPPORT]');
    process.exitCode = 1;
    return;
  }

  if (password.length < 10) {
    console.error("Passwort muss mindestens 10 Zeichen haben.");
    process.exitCode = 1;
    return;
  }

  const adminRole = (["OWNER", "FINANCE", "SUPPORT"] as const).includes(
    roleArg as "OWNER" | "FINANCE" | "SUPPORT",
  )
    ? (roleArg as "OWNER" | "FINANCE" | "SUPPORT")
    : "OWNER";

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
    update: {
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, adminRole },
    update: { adminRole },
  });

  console.info(`✓ Admin bereit: ${user.email} (${adminRole})`);
}

main()
  .catch((error) => {
    console.error("Fehlgeschlagen:", (error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
