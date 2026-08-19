import bcrypt from "bcryptjs";

/**
 * Passwort-Hashing mit bcrypt (Cost 12). Klartext-Passwörter werden niemals
 * gespeichert, geloggt oder in Fehlermeldungen ausgegeben.
 */
const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Mindestanforderungen an Passwörter (zusätzlich zur Zod-Validierung). */
export function passwordIssues(plain: string): string[] {
  const issues: string[] = [];
  if (plain.length < 10) issues.push("mindestens 10 Zeichen");
  if (!/[a-zA-Z]/.test(plain)) issues.push("mindestens ein Buchstabe");
  if (!/[0-9]/.test(plain)) issues.push("mindestens eine Ziffer");
  return issues;
}
