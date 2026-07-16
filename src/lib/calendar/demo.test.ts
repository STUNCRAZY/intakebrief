/**
 * Demo mode tests — the demo provider is deterministic, weekday-only, and
 * fixed to the listed sample hours in America/Chicago (explicit -05:00 CDT).
 */
import { describe, expect, it } from 'vitest';
import { DEMO_TIMEZONE, DemoCalendarProvider, isDemoMode } from './demo';

const DEMO_HOURS = [9, 10, 11, 13, 14, 15, 16];

// 2026-05-04 is a Monday; 2026-05-08 is a Friday; 2026-05-09/10 are Sat/Sun.
const FROM = '2026-05-04T00:00:00Z';
const TO = '2026-05-10T00:00:00Z';

describe('isDemoMode', () => {
  it('is true only for the exact string "true"', () => {
    expect(isDemoMode({ NODE_ENV: 'test', DEMO_MODE: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isDemoMode({ NODE_ENV: 'test', DEMO_MODE: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isDemoMode({ NODE_ENV: 'test', DEMO_MODE: '1' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isDemoMode({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe('DemoCalendarProvider', () => {
  it('returns only Mon–Fri 30-minute slots at the listed hours, in America/Chicago with explicit -05:00', async () => {
    const provider = new DemoCalendarProvider();
    const slots = await provider.getAvailableSlots('firm-x', FROM, TO);

    // Mon May 4 through Fri May 8, 7 sample hours each.
    expect(slots).toHaveLength(5 * DEMO_HOURS.length);

    for (const slot of slots) {
      expect(slot.timezone).toBe(DEMO_TIMEZONE);
      expect(slot.timezone).toBe('America/Chicago');

      const startMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00:00\.000-05:00$/.exec(slot.startISO);
      expect(startMatch, `startISO ${slot.startISO} carries explicit -05:00 offset`).toBeTruthy();
      const [, year, month, day, hour] = startMatch!;
      expect(DEMO_HOURS).toContain(Number(hour));

      // Weekday of the wall-clock date (noon UTC avoids edge effects).
      const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12)).getUTCDay();
      expect(weekday).toBeGreaterThanOrEqual(1);
      expect(weekday).toBeLessThanOrEqual(5);

      // Exactly 30 minutes, end also on the explicit offset.
      expect(slot.endISO).toMatch(/-05:00$/);
      expect(new Date(slot.endISO).getTime() - new Date(slot.startISO).getTime()).toBe(30 * 60 * 1000);
    }
  });

  it('is deterministic — two calls with the same range return identical slots', async () => {
    const provider = new DemoCalendarProvider();
    const first = await provider.getAvailableSlots('firm-x', FROM, TO);
    const second = await provider.getAvailableSlots('firm-x', FROM, TO);
    expect(second).toEqual(first);
  });

  it('returns no slots for a weekend-only range', async () => {
    const provider = new DemoCalendarProvider();
    // Sat 2026-05-09 00:00Z through Mon 2026-05-11 00:00Z covers only Sat/Sun.
    const slots = await provider.getAvailableSlots('firm-x', '2026-05-09T00:00:00Z', '2026-05-11T00:00:00Z');
    expect(slots).toEqual([]);
  });
});
