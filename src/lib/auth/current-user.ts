import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { readSession } from "./session";
import type { SessionPayload } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: "CUSTOMER" | "ADMIN";
  sessionId: string;
  customerId: string | null;
  adminRole: "SUPPORT" | "FINANCE" | "OWNER" | null;
  permissions: string[];
  createdAt: Date;
};

/**
 * Auflösung des angemeldeten Nutzers. Das JWT allein reicht nicht:
 * bei jedem Zugriff wird geprüft, ob der Account noch existiert und aktiv ist.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session: SessionPayload | null = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { customer: { select: { id: true } }, adminUser: true },
  });

  if (!user || user.disabledAt) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
    sessionId: session.sid,
    customerId: user.customer?.id ?? null,
    adminRole: user.adminUser?.adminRole ?? null,
    permissions: user.adminUser?.permissions ?? [],
    createdAt: user.createdAt,
  };
});

export async function requireUser(nextPath = "/dashboard"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireAdmin(nextPath = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  // Admin-Bereiche sind niemals öffentlich: Rolle UND AdminUser-Datensatz nötig.
  if (user.role !== "ADMIN" || !user.adminRole) redirect("/dashboard?error=forbidden");
  return user;
}
