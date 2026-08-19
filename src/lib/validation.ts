import { z } from "zod";

/**
 * Zentrale Eingabevalidierung (Zod). Jede Route parst ihre Eingaben hierüber;
 * unvalidierte Daten erreichen niemals die Datenbank.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "E-Mail ist zu kurz.")
  .max(254, "E-Mail ist zu lang.")
  .email("Bitte eine gültige E-Mail-Adresse angeben.");

export const passwordSchema = z
  .string()
  .min(10, "Passwort muss mindestens 10 Zeichen haben.")
  .max(200, "Passwort ist zu lang.")
  .regex(/[a-zA-Z]/, "Passwort muss mindestens einen Buchstaben enthalten.")
  .regex(/[0-9]/, "Passwort muss mindestens eine Ziffer enthalten.");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(120).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Passwort erforderlich.").max(200),
  next: z.string().max(200).optional(),
});

export const checkoutSchema = z.object({
  planKey: z.string().trim().min(1).max(40),
  email: emailSchema,
  // Nur informativ; die tatsächliche Auswahl trifft der Payment Provider.
  paymentMethod: z.enum(["card", "sepa", "wallet"]).default("card"),
  acceptTerms: z.literal(true, { message: "AGB und Widerrufsbelehrung müssen akzeptiert werden." }),
});

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10).max(400),
  password: passwordSchema,
});

export const planUpdateSchema = z.object({
  planId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  tagline: z.string().trim().max(160).optional(),
  priceCents: z.coerce.number().int().min(0).max(10_000_00),
  active: z.boolean().optional(),
  features: z.array(z.string().max(160)).max(20).optional(),
  providerPriceId: z.string().max(120).optional().or(z.literal("")),
});

export const productCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche."),
  subtitle: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  type: z.enum(["SAMPLE_PACK", "PRESET_PACK", "TEMPLATE", "MIDI_PACK", "STEM_PACK", "GUIDE", "OTHER"]),
  minTier: z.coerce.number().int().min(1).max(3),
  published: z.coerce.boolean().optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
});

export const refundSchema = z.object({
  paymentId: z.string().min(1),
  amountCents: z.coerce.number().int().positive().optional(),
  reason: z.string().max(200).optional(),
});

export const subscriptionActionSchema = z.object({
  subscriptionId: z.string().min(1),
  action: z.enum(["cancel", "cancel_at_period_end", "reactivate"]),
});

export const planChangeSchema = z.object({
  planKey: z.string().trim().min(1).max(40),
});

export const settingsSchema = z.object({
  checkoutNotice: z.string().max(400).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Vereinheitlichte Fehlerausgabe für API-Antworten. */
export function formatZodError(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
