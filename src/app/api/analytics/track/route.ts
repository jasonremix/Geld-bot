import { guard, readJson } from "@/lib/api-guard";
import { jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/current-user";
import { trackEvent } from "@/lib/analytics";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["page_view", "plan_view", "checkout_view"]);

/** Erfasst anonyme Nutzungsereignisse für die Conversion-Auswertung. */
export async function POST(request: Request) {
  const blocked = await guard(request, { limit: "checkout", csrf: false });
  if (blocked) return blocked;

  const body = await readJson<{ type?: string; path?: string; planKey?: string; sessionId?: string }>(
    request,
    4 * 1024,
  );
  if (!body.ok) return body.response;

  const type = body.data.type ?? "";
  if (!ALLOWED_TYPES.has(type)) return jsonOk({ ok: true, ignored: true });

  const user = await getCurrentUser();
  await trackEvent({
    type,
    userId: user?.id ?? null,
    sessionId: body.data.sessionId?.slice(0, 60) ?? null,
    path: body.data.path?.slice(0, 200) ?? null,
    referrer: request.headers.get("referer")?.slice(0, 200) ?? null,
    planKey: body.data.planKey?.slice(0, 40) ?? null,
  });

  return jsonOk({ ok: true });
}
