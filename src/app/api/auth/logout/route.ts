import { guard } from "@/lib/api-guard";
import { jsonOk } from "@/lib/http";
import { destroySession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = await guard(request, {});
  if (blocked) return blocked;

  await destroySession();
  return jsonOk({ ok: true, redirect: "/" });
}
