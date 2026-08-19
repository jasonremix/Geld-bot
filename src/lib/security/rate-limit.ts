/**
 * Schlanker In-Memory-Rate-Limiter (Sliding Window).
 *
 * Hinweis für den Betrieb: der Zähler gilt pro Prozess. Bei mehreren Instanzen
 * sollte ein gemeinsamer Store (Redis/Upstash) über dieselbe Schnittstelle
 * eingehängt werden – siehe `setRateLimitStore`.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  reset(key?: string): Promise<void>;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      this.buckets.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        resetAt: (timestamps[0] ?? now) + windowMs,
      };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);

    // Gelegentliches Aufräumen, damit die Map nicht unbegrenzt wächst.
    if (this.buckets.size > 5000) {
      for (const [k, v] of this.buckets) {
        if (v.every((t) => t <= cutoff)) this.buckets.delete(k);
      }
    }

    return { allowed: true, remaining: limit - timestamps.length, resetAt: now + windowMs };
  }

  async reset(key?: string): Promise<void> {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}

let store: RateLimitStore = new MemoryStore();

export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 10 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  checkout: { limit: 12, windowMs: 10 * 60 * 1000 },
  download: { limit: 60, windowMs: 10 * 60 * 1000 },
  webhook: { limit: 600, windowMs: 60 * 1000 },
  adminWrite: { limit: 120, windowMs: 10 * 60 * 1000 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export async function rateLimit(
  name: RateLimitName,
  identifier: string,
  disabled = false,
): Promise<RateLimitResult> {
  const cfg = RATE_LIMITS[name];
  if (disabled) {
    return { allowed: true, remaining: cfg.limit, resetAt: Date.now() + cfg.windowMs };
  }
  return store.hit(`${name}:${identifier}`, cfg.limit, cfg.windowMs);
}

export async function resetRateLimits(): Promise<void> {
  await store.reset();
}
