import { prisma } from "@/lib/db";
import { adminApi } from "@/lib/api-guard";
import { clientIp, jsonError, jsonOk } from "@/lib/http";
import { getStorage } from "@/lib/downloads/storage";
import { writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const auth = await adminApi(request, "content:write");
  if (!auth.ok) return auth.response;

  const { fileId } = await context.params;
  const file = await prisma.productFile.findUnique({ where: { id: fileId } });
  if (!file) return jsonError(404, "not_found", "Datei nicht gefunden.");

  await getStorage().remove(file.storageKey);
  await prisma.productFile.delete({ where: { id: fileId } });

  await writeAudit({
    actorUserId: auth.user.id,
    action: "product_file.deleted",
    entity: "ProductFile",
    entityId: fileId,
    ip: clientIp(request),
    meta: { productId: file.productId },
  });

  return jsonOk({ ok: true });
}
