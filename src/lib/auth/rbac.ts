/**
 * Rollen- und rechtebasierte Zugriffskontrolle für den Admin-Bereich.
 *
 * OWNER   – volle Rechte inkl. Auszahlungen und Einstellungen
 * FINANCE – Umsatz, Rechnungen, Auszahlungen, Refunds
 * SUPPORT – Kunden, Bestellungen, Downloads (lesend), kein Geldfluss
 */
export type AdminRole = "SUPPORT" | "FINANCE" | "OWNER";

export const PERMISSIONS = [
  "dashboard:read",
  "orders:read",
  "orders:write",
  "customers:read",
  "customers:write",
  "subscriptions:read",
  "subscriptions:write",
  "products:read",
  "products:write",
  "content:write",
  "downloads:read",
  "revenue:read",
  "payouts:read",
  "payouts:write",
  "analytics:read",
  "settings:read",
  "settings:write",
  "refunds:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPPORT: [
    "dashboard:read",
    "orders:read",
    "customers:read",
    "subscriptions:read",
    "products:read",
    "downloads:read",
    "analytics:read",
  ],
  FINANCE: [
    "dashboard:read",
    "orders:read",
    "orders:write",
    "customers:read",
    "subscriptions:read",
    "subscriptions:write",
    "products:read",
    "downloads:read",
    "revenue:read",
    "payouts:read",
    "analytics:read",
    "refunds:write",
    "settings:read",
  ],
  OWNER: [...PERMISSIONS],
};

export function permissionsForRole(role: AdminRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(
  input: { adminRole: AdminRole | null; permissions: string[] },
  permission: Permission,
): boolean {
  if (!input.adminRole) return false;
  if (input.permissions.includes(permission)) return true;
  return permissionsForRole(input.adminRole).includes(permission);
}
