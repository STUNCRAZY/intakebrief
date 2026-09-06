import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemorySlotStore } from '@/lib/booking/service';
import { _resetBookingServiceForTests, getBookingService } from '@/lib/calendar/service';
import type { FirmProfile } from '@/lib/firms/types';
import CaptureReturnPage from './page';

vi.mock('@/lib/firms/load', () => {
  const firm: FirmProfile = {
    id: 'fixture-firm', name: 'Synthetic Intake Firm', lane: 'criminal',
    location: { address: '100 Test Lane', city: 'Denton', county: 'Denton', state: 'TX', zip: '76201' },
    email: 'intake@example.invalid', phone: '(940) 555-0100', attorneys: [],
    practiceAreas: ['Criminal Defense'], yearEstablished: null, notableCases: [],
    website: 'https://example.invalid',
    websiteQuality: { classification: 'Adequate', rationale: 'Synthetic fixture', factors: {} },
    sources: [], unverified: [], notes: 'Synthetic test fixture only', researchedAt: '2026-09-06',
  };
  return { getFirm: (id: string) => id === firm.id ? firm : null };
});

const SLOT = '2026-09-09T15:00:00.000Z';
const CONFIGURED_STRIPE_KEY = 'sk_test_FAKE_readiness_only';

function holdSlot() {
  const booking = getBookingService();
  const holdId = booking.hold(SLOT, 15 * 60 * 1000);
  return { booking, holdId };
}

async function renderReturn(searchParams: Record<string, string>) {
  return renderToStaticMarkup(await CaptureReturnPage({
    params: Promise.resolve({ id: 'fixture-firm' }),
    searchParams: Promise.resolve(searchParams),
  }));
}

describe('deposit return demo boundary', () => {
  beforeEach(() => {
    _resetBookingServiceForTests(new InMemorySlotStore());
    vi.stubEnv('DEMO_MODE', undefined);
    vi.stubEnv('STRIPE_SECRET_KEY', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    { label: 'unset demo mode', demo: undefined, stripe: undefined },
    { label: 'disabled demo mode', demo: 'false', stripe: undefined },
    { label: 'configured Stripe despite enabled demo mode', demo: 'true', stripe: CONFIGURED_STRIPE_KEY },
  ])('does not confirm an unpaid booking for $label', async ({ demo, stripe }) => {
    vi.stubEnv('DEMO_MODE', demo);
    vi.stubEnv('STRIPE_SECRET_KEY', stripe);
    const { booking, holdId } = holdSlot();

    const html = await renderReturn({ demo: '1', slotId: SLOT, holdId });

    expect(booking.getConfirmed()).toEqual([]);
    expect(booking.isHeld(SLOT)).toBe(true);
    expect(html).not.toContain('Simulated checkout complete');
    expect(html).toContain('Nothing to verify');
  });

  it('confirms the explicitly enabled demo when no Stripe client is configured', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    const { booking, holdId } = holdSlot();

    const html = await renderReturn({ demo: '1', slotId: SLOT, holdId });

    expect(booking.getConfirmed()).toEqual([
      { slotId: SLOT, paymentRef: `demo-${holdId}`, confirmedAt: expect.any(Number) },
    ]);
    expect(booking.isHeld(SLOT)).toBe(false);
    expect(html).toContain('Simulated checkout complete');
    expect(html).toContain('Demo — no charge made');
  });

  it('keeps repeat demo returns idempotent', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    const { booking, holdId } = holdSlot();
    const query = { demo: '1', slotId: SLOT, holdId };

    await renderReturn(query);
    const first = booking.getConfirmed();
    const html = await renderReturn(query);

    expect(booking.getConfirmed()).toEqual(first);
    expect(html).toContain('this demo appointment was already booked');
  });

  it('leaves a normal production return awaiting payment verification', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', CONFIGURED_STRIPE_KEY);
    const { booking, holdId } = holdSlot();

    const html = await renderReturn({ session_id: 'cs_test_pending', slotId: SLOT, holdId });

    expect(booking.getConfirmed()).toEqual([]);
    expect(booking.isHeld(SLOT)).toBe(true);
    expect(html).toContain('Your deposit is being verified');
    expect(html).toContain('confirmed only after the payment is verified');
    expect(html).not.toContain('Simulated checkout complete');
  });

  it('ignores a forged demo flag on a real-payment return', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('STRIPE_SECRET_KEY', CONFIGURED_STRIPE_KEY);
    const { booking, holdId } = holdSlot();

    const html = await renderReturn({ demo: '1', session_id: 'cs_test_pending', slotId: SLOT, holdId });

    expect(booking.getConfirmed()).toEqual([]);
    expect(booking.isHeld(SLOT)).toBe(true);
    expect(html).toContain('Your deposit is being verified');
    expect(html).not.toContain('Simulated checkout complete');
  });

  it('does not confirm from an ordinary return even when demo mode is enabled', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    const { booking, holdId } = holdSlot();

    await renderReturn({ session_id: 'cs_test_pending', slotId: SLOT, holdId });

    expect(booking.getConfirmed()).toEqual([]);
    expect(booking.isHeld(SLOT)).toBe(true);
  });
});
