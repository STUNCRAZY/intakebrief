/**
 * In-memory idempotency store with a 24h TTL.
 * remember(key, result) stores the first-processing result; get/seen replay it.
 * Clock is injectable for tests. Entries are evicted lazily on access and on write.
 */

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 10_000;

function sweep(now: number): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const [k, e] of store) {
    if (e.expiresAt <= now) store.delete(k);
  }
}

/** Test hook: clear the store. */
export function clearIdempotencyStore(): void {
  store.clear();
}

export function remember(key: string, result: unknown, now: number = Date.now()): void {
  sweep(now);
  store.set(key, { value: result, expiresAt: now + IDEMPOTENCY_TTL_MS });
}

export function get<T = unknown>(key: string, now: number = Date.now()): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function seen(key: string, now: number = Date.now()): boolean {
  return get(key, now) !== undefined;
}
