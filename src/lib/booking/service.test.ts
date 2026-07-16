import { describe, expect, it } from 'vitest';
import { BookingService, InMemorySlotStore } from './service';

function makeService(start = 1_000_000) {
  let now = start;
  const service = new BookingService(new InMemorySlotStore(), () => now);
  return {
    service,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe('BookingService', () => {
  it('a hold blocks a second hold on the same slot (no double-booking)', () => {
    const { service } = makeService();
    service.hold('slot-1', 60_000);
    expect(() => service.hold('slot-1', 60_000)).toThrow(/already held/);
    expect(service.isHeld('slot-1')).toBe(true);
  });

  it('an expired hold auto-releases and the slot can be held again', () => {
    const { service, advance } = makeService();
    service.hold('slot-1', 60_000);
    advance(61_000);
    expect(service.isHeld('slot-1')).toBe(false);
    expect(() => service.hold('slot-1', 60_000)).not.toThrow();
  });

  it('confirm-after-hold works and consumes the hold', () => {
    const { service } = makeService();
    service.hold('slot-2', 60_000);
    const confirmed = service.confirmBooking('slot-2', 'pi_test_123');
    expect(confirmed.slotId).toBe('slot-2');
    expect(confirmed.paymentRef).toBe('pi_test_123');
    expect(service.isHeld('slot-2')).toBe(false);
    expect(service.getConfirmed()).toHaveLength(1);
  });

  it('confirm recheck rejects conflicts: a confirmed slot cannot be re-confirmed or held', () => {
    const { service } = makeService();
    service.confirmBooking('slot-3', 'pi_test_abc');
    expect(() => service.confirmBooking('slot-3', 'pi_test_def')).toThrow(/already confirmed/);
    expect(() => service.hold('slot-3', 60_000)).toThrow(/already confirmed/);
  });

  it('releaseHold frees only the matching hold', () => {
    const { service } = makeService();
    const holdId = service.hold('slot-4', 60_000);
    expect(service.releaseHold('unknown-hold')).toBe(false);
    expect(service.releaseHold(holdId)).toBe(true);
    expect(service.isHeld('slot-4')).toBe(false);
  });
});
