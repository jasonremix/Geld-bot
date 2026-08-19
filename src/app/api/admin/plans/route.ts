import { prisma } from "@/lib/db";
import { adminApi, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { formatZodError, planUpdateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

/** Preise und Inhalte der Pläne ändern (nur mit settings:write). */
export async function PATCH(request: Request) {
  const auth = await adminApi(request, "settings:write");
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = planUpdateSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte Eingaben prüfen.", formatZodError(parsed.error));
  }

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan) return jsonError(404, "plan_not_found", "Plan nicht gefunden.");

  const updated = await prisma.plan.update({
    where: { id: plan.id },
    data: {
      priceCents: parsed.data.priceCents,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.tagline !== undefined ? { tagline: parsed.data.tagline } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.features ? { features: parsed.data.features } : {}),
      ...(parsed.data.providerPriceId !== undefined
        ? { providerPriceId: parsed.data.providerPriceId || null }
        : {}),
    },
  });

  await writeAudit({
    actorUserId: auth.user.id,
    action: "plan.updated",
    entity: "Plan",
    entityId: plan.id,
    ip: clientIp(request),
    meta: { fromPriceCents: plan.priceCents, toPriceCents: updated.priceCents },
  });

  return jsonOk({ ok: true, plan: { id: updated.id, priceCents: updated.priceCents } });
}
