/**
 * In-memory token-bucket rate limiter, keyed by caller-supplied key (ip+firmId).
 * Bucket capacity = RATE_LIMIT_MAX (default 5), fully refilled over
 * RATE_LIMIT_WINDOW_MS (default 600000). Clock is injectable for tests.
 */

/** Loose env-map type — accepts process.env and plain test fixtures alike. */
export type EnvMap = Record<string, string | undefined>;

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_ENTRIES = 10_000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Test hook: clear all buckets. */
export function clearRateLimitStore(): void {
  buckets.clear();
}

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  env: EnvMap = process.env,
): { ok: boolean; retryAfterMs?: number } {
  const max = positiveInt(env.RATE_LIMIT_MAX, 5);
  const windowMs = positiveInt(env.RATE_LIMIT_WINDOW_MS, 600_000);

  // Opportunistic eviction when the store grows large.
  if (buckets.size > MAX_ENTRIES) {
    for (const [k, b] of buckets) {
      if (now - b.updatedAt > windowMs * 2) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);
  let tokens: number;
  if (!existing) {
    tokens = max;
  } else {
    const elapsed = Math.max(0, now - existing.updatedAt);
    tokens = Math.min(max, existing.tokens + (elapsed / windowMs) * max);
  }

  if (tokens >= 1) {
    buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    return { ok: true };
  }

  buckets.set(key, { tokens, updatedAt: now });
  const retryAfterMs = Math.ceil(((1 - tokens) * windowMs) / max);
  return { ok: false, retryAfterMs };
}
