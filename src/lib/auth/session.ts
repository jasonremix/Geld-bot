import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { getEnv } from "../env";

export const SESSION_COOKIE = "gb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 Tage
const ISSUER = "geld-bot";

export type SessionPayload = {
  sub: string; // User-ID
  sid: string; // Session-ID (für Audit/Download-Logs)
  role: "CUSTOMER" | "ADMIN";
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ sid: payload.sid, role: payload.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: ISSUER,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    const role = payload.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
    return { sub: payload.sub, sid: payload.sid, role };
  } catch {
    return null;
  }
}

export function newSessionId(): string {
  return randomBytes(18).toString("base64url");
}

export async function startSession(userId: string, role: "CUSTOMER" | "ADMIN"): Promise<void> {
  const token = await createSessionToken({ sub: userId, sid: newSessionId(), role });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
