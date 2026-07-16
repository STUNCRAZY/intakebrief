import { beforeEach, describe, expect, it } from 'vitest';
import { InMemorySlotStore } from '@/lib/booking/service';
import { _resetBookingServiceForTests } from '@/lib/calendar/service';
import { DELETE, POST } from './route';

const FIRM = 'biles-law'; // real researched firm id (research/firms/biles-law.json)
const SLOT = { slotStartISO: '2026-05-04T14:00:00.000Z', slotEndISO: '2026-05-04T15:00:00.000Z' };

function post(body: unknown) {
  return POST(
    new Request('http://test/api/holds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function del(body: unknown) {
  return DELETE(
    new Request('http://test/api/holds', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('/api/holds', () => {
  beforeEach(() => {
    _resetBookingServiceForTests(new InMemorySlotStore());
  });

  it('POST holds a slot and returns holdId + expiresAt', async () => {
    const res = await post({ firmId: FIRM, ...SLOT });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.holdId).toMatch(/^hold-/);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('POST rejects an unknown firm with 400', async () => {
    const res = await post({ firmId: 'no-such-firm', ...SLOT });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown-firm' });
  });

  it('a second POST on the same slot is 409 slot-unavailable', async () => {
    expect((await post({ firmId: FIRM, ...SLOT })).status).toBe(200);
    const res = await post({ firmId: FIRM, ...SLOT });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'slot-unavailable' });
  });

  it('DELETE releases a hold (200) and unknown holds are 404', async () => {
    const created = await (await post({ firmId: FIRM, ...SLOT })).json();
    const res = await del({ holdId: created.holdId });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ released: true });

    // slot can be held again after release
    expect((await post({ firmId: FIRM, ...SLOT })).status).toBe(200);

    expect((await del({ holdId: created.holdId })).status).toBe(404);
    expect((await del({ holdId: 'hold-nope' })).status).toBe(404);
  });
});
