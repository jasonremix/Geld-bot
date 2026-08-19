import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, jsonError } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canUserDownloadFile } from "@/lib/entitlements";
import { verifyDownloadToken } from "@/lib/downloads/signing";
import { getStorage } from "@/lib/downloads/storage";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liefert eine Produktdatei aus.
 *
 * Vier Prüfungen, alle serverseitig:
 *  1. gültige, nicht abgelaufene Signatur
 *  2. angemeldete Session
 *  3. Session-Nutzer == Nutzer im Token
 *  4. aktuelles Abo schaltet die Datei frei (erneute Prüfung, nicht nur beim Ausstellen)
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const env = getEnv();
  const { token } = await context.params;

  const verification = verifyDownloadToken(token, env.DOWNLOAD_SIGNING_SECRET);
  if (!verification.ok) {
    return jsonError(403, `token_${verification.reason}`, "Download-Link ist ungültig oder abgelaufen.");
  }

  const user = await getCurrentUser();
  if (!user) return jsonError(401, "unauthorized", "Bitte anmelden.");
  if (user.id !== verification.payload.u) {
    return jsonError(403, "token_user_mismatch", "Dieser Link gehört zu einem anderen Konto.");
  }

  const limit = await rateLimit("download", user.id, env.RATE_LIMIT_DISABLED);
  if (!limit.allowed) {
    return jsonError(429, "rate_limited", "Zu viele Downloads. Bitte kurz warten.");
  }

  const fileId = verification.payload.f;
  if (!(await canUserDownloadFile(user.id, fileId))) {
    return jsonError(403, "not_entitled", "Dein Plan schaltet diese Datei nicht frei.");
  }

  const file = await prisma.productFile.findUnique({ where: { id: fileId } });
  if (!file) return jsonError(404, "file_not_found", "Datei nicht gefunden.");

  let stream: NodeJS.ReadableStream;
  try {
    stream = await getStorage().createStream(file.storageKey);
  } catch {
    return jsonError(404, "file_missing", "Die Datei ist im Speicher nicht vorhanden.");
  }

  // Jeder Download wird protokolliert (Missbrauchserkennung, Top-Produkte).
  await prisma.download.create({
    data: {
      userId: user.id,
      productFileId: file.id,
      tokenId: verification.payload.j,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      bytes: file.sizeBytes,
    },
  });

  const webStream = Readable.toWeb(stream as Readable) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
