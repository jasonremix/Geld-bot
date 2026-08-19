import "server-only";
import { PrismaClient } from "@prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "./env";

/**
 * Prisma-Singleton. Im Dev-Modus wird die Instanz am globalThis gecached,
 * damit Hot-Reloads keine Verbindungslecks erzeugen.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getEnv();
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
