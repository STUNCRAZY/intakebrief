import { beforeEach, describe, expect, it } from 'vitest';
import { InMemorySlotStore } from '@/lib/booking/service';
import { _resetBookingServiceForTests } from '@/lib/calendar/service';
import { GET } from './route';

const FIRM = 'biles-law'; // real researched firm id (research/firms/biles-law.json)

describe('GET /api/availability', () => {
  beforeEach(() => {
    _resetBookingServiceForTests(new InMemorySlotStore());
  });

  it('rejects an unknown firm with 400', async () => {
    const res = await GET(new Request(`http://test/api/availability?firmId=no-such-firm`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown-firm' });
  });

  it('is honestly blocked (503, zero slots) when no calendar provider is configured', async () => {
    const res = await GET(new Request(`http://test/api/availability?firmId=${FIRM}`));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('blocked');
    expect(body.detail).toContain('GOOGLE_CALENDAR_');
    expect(body).not.toHaveProperty('slots');
  });
});
