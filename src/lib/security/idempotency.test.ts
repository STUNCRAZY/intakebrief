import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearIdempotencyStore,
  get,
  IDEMPOTENCY_TTL_MS,
  remember,
  seen,
} from './idempotency';

beforeEach(() => {
  clearIdempotencyStore();
});

describe('idempotency store', () => {
  it('returns undefined/false for unknown keys', () => {
    expect(get('nope')).toBeUndefined();
    expect(seen('nope')).toBe(false);
  });

  it('remembers and replays a stored result', () => {
    const t0 = 1000;
    remember('k', { ok: true, n: 42 }, t0);
    expect(seen('k', t0)).toBe(true);
    expect(get<{ ok: boolean; n: number }>('k', t0)).toEqual({ ok: true, n: 42 });
    expect(get('k', t0 + IDEMPOTENCY_TTL_MS - 1)).toBeDefined();
  });

  it('expires entries after the 24h TTL (injectable clock)', () => {
    const t0 = 1000;
    remember('k', 'v', t0);
    expect(seen('k', t0 + IDEMPOTENCY_TTL_MS + 1)).toBe(false);
    expect(get('k', t0 + IDEMPOTENCY_TTL_MS + 1)).toBeUndefined();
  });

  it('stores arbitrary JSON-ish results', () => {
    const result = { firmNotification: { status: 'accepted' }, list: [1, 2, 3] };
    remember('k2', result);
    expect(get('k2')).toEqual(result);
  });
});
