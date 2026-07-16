import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemorySlotStore } from '@/lib/booking/service';
import type { CalendarProvider, Slot } from './provider';
import {
  FileSlotStore,
  HOLD_TTL_MS,
  _resetBookingServiceForTests,
  getAvailability,
  getBookingService,
} from './service';

const ENV_WITHOUT_GOOGLE = { NODE_ENV: 'test', CALENDAR_TIMEZONE: 'America/Chicago' } as NodeJS.ProcessEnv;

function stubProvider(slots: Slot[]): CalendarProvider {
  return { getAvailableSlots: async () => slots };
}

function twoSlots(): Slot[] {
  return [
    { startISO: '2026-05-04T14:00:00.000Z', endISO: '2026-05-04T15:00:00.000Z', timezone: 'America/Chicago' },
    { startISO: '2026-05-04T15:00:00.000Z', endISO: '2026-05-04T16:00:00.000Z', timezone: 'America/Chicago' },
  ];
}

afterEach(() => {
  _resetBookingServiceForTests(new InMemorySlotStore());
});

describe('getAvailability', () => {
  it('is blocked with zero slots when no GOOGLE_CALENDAR_* env is configured (never fabricates)', async () => {
    const result = await getAvailability('firm-x', '2026-05-01T00:00:00Z', '2026-05-15T00:00:00Z', ENV_WITHOUT_GOOGLE);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.detail).toContain('GOOGLE_CALENDAR_');
    }
    expect(result).not.toHaveProperty('slots');
  });

  it('returns provider slots minus held and confirmed slots', async () => {
    let now = 1_000_000;
    const store = new InMemorySlotStore();
    _resetBookingServiceForTests(store, () => now);
    const slots = twoSlots();

    getBookingService().hold(slots[0].startISO, HOLD_TTL_MS);

    const result = await getAvailability('firm-x', '2026-05-01T00:00:00Z', '2026-05-15T00:00:00Z', ENV_WITHOUT_GOOGLE, stubProvider(slots));
    expect(result).toEqual({
      status: 'ok',
      timezone: 'America/Chicago',
      slots: [{ startISO: slots[1].startISO, endISO: slots[1].endISO }],
    });
  });

  it('an expired hold releases the slot back into availability', async () => {
    let now = 1_000_000;
    _resetBookingServiceForTests(new InMemorySlotStore(), () => now);
    const slots = twoSlots();

    getBookingService().hold(slots[0].startISO, HOLD_TTL_MS);
    now += HOLD_TTL_MS + 1; // let the hold expire

    const result = await getAvailability('firm-x', '2026-05-01T00:00:00Z', '2026-05-15T00:00:00Z', ENV_WITHOUT_GOOGLE, stubProvider(slots));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.slots).toHaveLength(2);
  });

  it('a confirmed slot is excluded from availability', async () => {
    _resetBookingServiceForTests(new InMemorySlotStore(), () => 1_000_000);
    const slots = twoSlots();
    getBookingService().confirmBooking(slots[0].startISO, 'pi_test_123');

    const result = await getAvailability('firm-x', '2026-05-01T00:00:00Z', '2026-05-15T00:00:00Z', ENV_WITHOUT_GOOGLE, stubProvider(slots));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.slots).toEqual([{ startISO: slots[1].startISO, endISO: slots[1].endISO }]);
    }
  });

  it('a hold blocks a second hold on the same slot', async () => {
    _resetBookingServiceForTests(new InMemorySlotStore(), () => 1_000_000);
    getBookingService().hold('slot-1', HOLD_TTL_MS);
    expect(() => getBookingService().hold('slot-1', HOLD_TTL_MS)).toThrow(/already held/);
  });

  it('releaseHold frees the slot', async () => {
    _resetBookingServiceForTests(new InMemorySlotStore(), () => 1_000_000);
    const holdId = getBookingService().hold('slot-1', HOLD_TTL_MS);
    expect(getBookingService().releaseHold(holdId)).toBe(true);
    expect(getBookingService().isHeld('slot-1')).toBe(false);
    expect(getBookingService().releaseHold(holdId)).toBe(false);
  });

  it('demo mode off without a provider is blocked exactly as before (no slots fabricated)', async () => {
    for (const env of [
      ENV_WITHOUT_GOOGLE,
      { ...ENV_WITHOUT_GOOGLE, DEMO_MODE: 'false' } as NodeJS.ProcessEnv,
    ]) {
      const result = await getAvailability('firm-x', '2026-05-01T00:00:00Z', '2026-05-15T00:00:00Z', env);
      expect(result.status).toBe('blocked');
      expect(result).not.toHaveProperty('slots');
      expect(result).not.toHaveProperty('demo');
    }
  });

  it('demo mode on without a provider returns ok demo:true with labeled sample slots', async () => {
    _resetBookingServiceForTests(new InMemorySlotStore());
    const env = { ...ENV_WITHOUT_GOOGLE, DEMO_MODE: 'true' } as NodeJS.ProcessEnv;
    const result = await getAvailability('firm-x', '2026-05-04T00:00:00Z', '2026-05-10T00:00:00Z', env);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.demo).toBe(true);
      expect(result.timezone).toBe('America/Chicago');
      expect(result.slots.length).toBeGreaterThan(0);
    }
  });

  it('a configured real provider always wins over demo mode (no demo flag)', async () => {
    _resetBookingServiceForTests(new InMemorySlotStore(), () => 1_000_000);
    const env = { ...ENV_WITHOUT_GOOGLE, DEMO_MODE: 'true' } as NodeJS.ProcessEnv;
    const slots = twoSlots();
    const result = await getAvailability('firm-x', '2026-05-01T00:00:00Z', '2026-05-15T00:00:00Z', env, stubProvider(slots));
    expect(result.status).toBe('ok');
    expect(result).not.toHaveProperty('demo');
    if (result.status === 'ok') {
      expect(result.slots).toHaveLength(2);
      // Real provider slots, not demo sample slots.
      expect(result.slots[0].startISO).toBe(slots[0].startISO);
    }
  });
});

describe('FileSlotStore', () => {
  it('persists state to disk and reloads it; tolerates missing/corrupt files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slots-'));
    const file = path.join(dir, 'nested', 'slots.json');

    const store = new FileSlotStore(file);
    store.set('slot-1', { hold: { holdId: 'hold-1', slotId: 'slot-1', expiresAt: 123 }, confirmed: null });

    const reloaded = new FileSlotStore(file);
    expect(reloaded.get('slot-1')?.hold?.holdId).toBe('hold-1');

    const corrupt = path.join(dir, 'corrupt.json');
    fs.writeFileSync(corrupt, '{not json');
    expect(() => new FileSlotStore(corrupt)).not.toThrow();
    expect(new FileSlotStore(corrupt).get('slot-1')).toBeUndefined();
    expect(new FileSlotStore(path.join(dir, 'absent.json')).get('x')).toBeUndefined();

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
