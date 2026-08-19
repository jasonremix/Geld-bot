/**
 * Edge-taugliche CSRF-Token-Erzeugung (WebCrypto statt node:crypto).
 *
 * Format und Algorithmus sind identisch zu `security/csrf.ts`, damit ein in
 * der Middleware ausgestelltes Token serverseitig geprüft werden kann.
 */
function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function issueCsrfTokenEdge(secret: string): Promise<string> {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(18)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(nonce));
  return `${nonce}.${base64url(signature)}`;
}

/** Formprüfung ohne Signaturvergleich – reicht, um ein fehlendes Cookie zu erkennen. */
export function looksLikeCsrfToken(value: string | undefined): boolean {
  if (!value) return false;
  const [nonce, signature] = value.split(".");
  return Boolean(nonce && signature && nonce.length >= 16 && signature.length >= 32);
}
