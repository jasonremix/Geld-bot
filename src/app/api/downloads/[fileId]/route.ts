import { prisma } from "@/lib/db";
import { guard } from "@/lib/api-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canUserDownloadFile } from "@/lib/entitlements";
import { createDownloadToken } from "@/lib/downloads/signing";

export const runtime = "nodejs";

/**
 * Gibt eine kurzlebige, signierte Download-URL aus.
 * Ohne aktives Abo mit passendem Tier gibt es keine URL.
 */
export async function POST(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "unauthorized", "Bitte anmelden.");

  const blocked = await guard(request, { limit: "download", identifier: user.id });
  if (blocked) return blocked;

  const { fileId } = await context.params;

  const file = await prisma.productFile.findUnique({
    where: { id: fileId },
    include: { product: { select: { title: true, minTier: true, published: true } } },
  });
  if (!file) return jsonError(404, "file_not_found", "Datei nicht gefunden.");

  const allowed = await canUserDownloadFile(user.id, fileId);
  if (!allowed) {
    return jsonError(403, "not_entitled", "Dein Plan schaltet diese Datei nicht frei.");
  }

  const env = getEnv();
  const { token, expiresAt } = createDownloadToken(
    { fileId, userId: user.id, ttlSeconds: env.DOWNLOAD_URL_TTL_SECONDS },
    env.DOWNLOAD_SIGNING_SECRET,
  );

  return jsonOk({
    ok: true,
    url: `/api/files/${token}`,
    filename: file.filename,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: env.DOWNLOAD_URL_TTL_SECONDS,
  });
}
