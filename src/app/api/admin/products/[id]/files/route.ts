import { prisma } from "@/lib/db";
import { adminApi } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { getStorage, sanitizeFilename, validateUpload } from "@/lib/downloads/storage";
import { writeAudit } from "@/lib/security/audit";
import type { FileKind } from "@prisma-client";

export const runtime = "nodejs";

/**
 * Content-Upload.
 *
 * Ablauf: validieren → speichern (ausserhalb des Web-Roots) → Metadaten
 * ablegen → Produkt zuordnen → über das Produkt-Tier automatisch für die
 * passenden Mitgliedschaften freischalten.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await adminApi(request, "content:write");
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return jsonError(404, "not_found", "Produkt nicht gefunden.");

  const env = getEnv();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "invalid_form", "Upload konnte nicht gelesen werden.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "file_missing", "Keine Datei übermittelt.");

  const minTierRaw = form.get("minTier");
  const minTier = minTierRaw ? Number(minTierRaw) : null;
  if (minTier !== null && ![1, 2, 3].includes(minTier)) {
    return jsonError(400, "validation_failed", "minTier muss 1, 2 oder 3 sein.");
  }

  const validation = validateUpload({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    maxBytes: env.MAX_UPLOAD_BYTES,
  });
  if (!validation.ok) return jsonError(400, "upload_rejected", validation.reason);

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put({
    buffer,
    filename: file.name,
    productId: product.id,
  });

  const created = await prisma.productFile.create({
    data: {
      productId: product.id,
      filename: sanitizeFilename(file.name),
      storageKey: stored.key,
      mimeType: file.type || "application/octet-stream",
      kind: validation.kind as FileKind,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      minTier,
    },
  });

  await writeAudit({
    actorUserId: auth.user.id,
    action: "product_file.uploaded",
    entity: "ProductFile",
    entityId: created.id,
    ip: clientIp(request),
    meta: { productId: product.id, sizeBytes: stored.sizeBytes, kind: validation.kind },
  });

  return jsonOk({
    ok: true,
    file: {
      id: created.id,
      filename: created.filename,
      sizeBytes: created.sizeBytes,
      kind: created.kind,
      checksum: created.checksum,
    },
  });
}
