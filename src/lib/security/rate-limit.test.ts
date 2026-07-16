import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, clearRateLimitStore } from './rate-limit';

const env = { RATE_LIMIT_MAX: '5', RATE_LIMIT_WINDOW_MS: '600000' };

beforeEach(() => {
  clearRateLimitStore();
});

describe('checkRateLimit', () => {
  it('allows up to RATE_LIMIT_MAX in the window, then rejects with retryAfterMs', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('k', t0, env).ok).toBe(true);
    }
    const sixth = checkRateLimit('k', t0, env);
    expect(sixth.ok).toBe(false);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
    expect(sixth.retryAfterMs).toBe(120_000); // one token refills in window/max
  });

  it('refills tokens as the injected clock advances', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit('k', t0, env);
    expect(checkRateLimit('k', t0, env).ok).toBe(false);
    // one token after window/max
    expect(checkRateLimit('k', t0 + 120_000, env).ok).toBe(true);
    // full bucket after a whole window since the last update (t0 + 120_000)
    const t1 = t0 + 720_000;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('k', t1, env).ok).toBe(true);
    }
    expect(checkRateLimit('k', t1, env).ok).toBe(false);
  });

  it('honors env overrides for max', () => {
    const strict = { RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_MS: '60000' };
    const t0 = 5_000;
    expect(checkRateLimit('k', t0, strict).ok).toBe(true);
    expect(checkRateLimit('k', t0, strict).ok).toBe(true);
    expect(checkRateLimit('k', t0, strict).ok).toBe(false);
  });

  it('uses defaults when env vars are absent or invalid', () => {
    const t0 = 7_000;
    for (let i = 0; i < 5; i++) expect(checkRateLimit('k', t0, {}).ok).toBe(true);
    expect(checkRateLimit('k', t0, {}).ok).toBe(false);
    clearRateLimitStore();
    const bad = { RATE_LIMIT_MAX: 'abc', RATE_LIMIT_WINDOW_MS: '-1' };
    for (let i = 0; i < 5; i++) expect(checkRateLimit('k', t0, bad).ok).toBe(true);
    expect(checkRateLimit('k', t0, bad).ok).toBe(false);
  });

  it('tracks keys independently', () => {
    const t0 = 9_000;
    for (let i = 0; i < 5; i++) checkRateLimit('a', t0, env);
    expect(checkRateLimit('a', t0, env).ok).toBe(false);
    expect(checkRateLimit('b', t0, env).ok).toBe(true);
  });
});
