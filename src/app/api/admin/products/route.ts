import { prisma } from "@/lib/db";
import { adminApi, readJson } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { formatZodError, productCreateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

/** Legt ein Produkt an (Metadaten). Dateien folgen über den Upload-Endpunkt. */
export async function POST(request: Request) {
  const auth = await adminApi(request, "products:write");
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = productCreateSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "validation_failed", "Bitte Eingaben prüfen.", formatZodError(parsed.error));
  }

  const existing = await prisma.product.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return jsonError(409, "slug_taken", "Dieser Slug ist bereits vergeben.");

  const product = await prisma.product.create({
    data: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      description: parsed.data.description || null,
      type: parsed.data.type,
      minTier: parsed.data.minTier,
      published: parsed.data.published ?? false,
      tags: parsed.data.tags ?? [],
    },
  });

  await writeAudit({
    actorUserId: auth.user.id,
    action: "product.created",
    entity: "Product",
    entityId: product.id,
    ip: clientIp(request),
    meta: { slug: product.slug, minTier: product.minTier },
  });

  return jsonOk({ ok: true, product: { id: product.id, slug: product.slug } });
}

/** Veröffentlichen / Zurückziehen. */
export async function PATCH(request: Request) {
  const auth = await adminApi(request, "products:write");
  if (!auth.ok) return auth.response;

  const body = await readJson<{ productId?: string; published?: boolean; minTier?: number }>(request);
  if (!body.ok) return body.response;

  const { productId, published, minTier } = body.data;
  if (!productId) return jsonError(400, "validation_failed", "productId fehlt.");
  if (minTier !== undefined && ![1, 2, 3].includes(minTier)) {
    return jsonError(400, "validation_failed", "minTier muss 1, 2 oder 3 sein.");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return jsonError(404, "not_found", "Produkt nicht gefunden.");

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(published !== undefined ? { published } : {}),
      ...(minTier !== undefined ? { minTier } : {}),
    },
  });

  await writeAudit({
    actorUserId: auth.user.id,
    action: "product.updated",
    entity: "Product",
    entityId: product.id,
    ip: clientIp(request),
    meta: { published: updated.published, minTier: updated.minTier },
  });

  return jsonOk({ ok: true, published: updated.published, minTier: updated.minTier });
}
